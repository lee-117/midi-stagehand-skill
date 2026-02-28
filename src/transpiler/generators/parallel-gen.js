'use strict';

/**
 * parallel-gen.js
 * Converts `parallel` blocks from YAML into TypeScript Promise.all() constructs
 * for concurrent task execution.
 *
 * Variables produced inside parallel tasks (e.g. aiQuery with `name`) are hoisted
 * to the outer scope so they remain accessible after Promise.all completes.
 */

/**
 * Collect variable names that would be declared inside a flow.
 * These are steps like `aiQuery` with a `name` field, `import` with `as`,
 * or `external_call` with `response_as`.
 *
 * @param {Array} flow - Array of YAML step objects.
 * @returns {string[]} Variable names that need hoisting.
 */
function collectDeclaredVars(flow) {
  const vars = [];
  for (const step of flow) {
    if (step.aiQuery !== undefined && step.name) {
      vars.push(step.name);
    }
    if (step.external_call) {
      const ec = step.external_call;
      const ecVar = ec.response_as || ec.as || ec.name;
      if (ecVar) vars.push(ecVar);
    }
    if (step.import !== undefined && step.as) {
      vars.push(step.as);
    }
    if (step.data_transform && step.data_transform.output) {
      vars.push(step.data_transform.output);
    }
  }
  return vars;
}

/**
 * Rewrite a generated code line so that `const varName = ...` becomes
 * `varName = ...` for variables that were hoisted to the outer scope.
 *
 * @param {string} code - A line of generated TypeScript.
 * @param {Set<string>} hoisted - Set of hoisted variable names.
 * @returns {string} The potentially rewritten line.
 */
function rewriteHoistedDeclarations(code, hoisted) {
  if (hoisted.size === 0) return code;
  for (const name of hoisted) {
    // Match "const name = " or "let name = " with leading whitespace
    const pattern = new RegExp('^(\\s*)(const|let)\\s+' + escapeRegExp(name) + '\\s*=');
    if (pattern.test(code)) {
      return code.replace(pattern, '$1' + name + ' =');
    }
  }
  return code;
}

const { escapeRegExp } = require('./utils');

/**
 * Generate TypeScript code for a `parallel` step.
 *
 * @param {object} step        - The YAML step: { parallel: { tasks: [...], merge_results: bool } }
 * @param {object} ctx         - Context: { indent: number, varScope: Set<string> }
 * @param {function} processStep - Callback (step, indent) => string for nested steps.
 * @returns {string} TypeScript code string.
 */
function generate(step, ctx, processStep) {
  const indent = ctx && ctx.indent || 0;
  const pad = '  '.repeat(indent);
  const innerPad = '  '.repeat(indent + 1);
  const varScope = ctx && ctx.varScope || new Set();
  const parallel = step.parallel;

  const tasksArray = parallel.tasks || parallel.branches;
  if (!parallel || !tasksArray || !Array.isArray(tasksArray)) {
    return pad + '// Invalid parallel block: missing "tasks" or "branches" array';
  }

  const tasks = tasksArray;
  const mergeResults = parallel.merge_results !== undefined ? parallel.merge_results
    : parallel.waitAll !== undefined ? parallel.waitAll : false;
  const lines = [];

  // --- Hoist variable declarations from inside IIFEs to outer scope ---
  const allHoisted = new Set();
  for (const task of tasks) {
    const flow = task.flow || task.steps || (Array.isArray(task) ? task : [task]);
    for (const name of collectDeclaredVars(flow)) {
      allHoisted.add(name);
    }
  }

  // Emit `let` declarations before Promise.all so vars are accessible afterwards
  for (const name of allHoisted) {
    lines.push(pad + 'let ' + name + ';');
    varScope.add(name);
  }

  // Build each async IIFE for Promise.all
  const taskBlocks = tasks.map((task, index) => {
    const flow = task.flow || task.steps || (Array.isArray(task) ? task : [task]);
    const taskLines = [];

    taskLines.push(innerPad + '(async () => {');

    for (const subStep of flow) {
      let code = processStep(subStep, indent + 2);
      if (code) {
        // Rewrite "const hoistedVar = ..." to "hoistedVar = ..."
        code = rewriteHoistedDeclarations(code, allHoisted);
        taskLines.push(code);
      }
    }

    taskLines.push(innerPad + '})()');
    return taskLines.join('\n');
  });

  if (mergeResults) {
    const resultVars = tasks.map((task, i) => {
      const name = task.name || ('result' + i);
      varScope.add(name);
      return name;
    });

    lines.push(pad + 'const [' + resultVars.join(', ') + '] = await Promise.all([');
    lines.push(taskBlocks.join(',\n'));
    lines.push(pad + ']);');
  } else {
    lines.push(pad + 'await Promise.all([');
    lines.push(taskBlocks.join(',\n'));
    lines.push(pad + ']);');
  }

  return lines.join('\n');
}

module.exports = { generate };
