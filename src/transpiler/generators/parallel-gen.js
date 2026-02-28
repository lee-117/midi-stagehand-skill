'use strict';

/**
 * parallel-gen.js
 * Converts `parallel` blocks from YAML into TypeScript Promise.all() constructs
 * for concurrent task execution.
 *
 * Variables produced inside parallel tasks (e.g. aiQuery with `name`) are hoisted
 * to the outer scope so they remain accessible after Promise.all completes.
 */

const { escapeRegExp } = require('./utils');

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
    if (!step || typeof step !== 'object') continue;

    // Direct variable producers
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
    if (step.data_transform) {
      const dtVar = step.data_transform.output || step.data_transform.name;
      if (dtVar) vars.push(dtVar);
    }
    if (step.variables && typeof step.variables === 'object') {
      for (const name of Object.keys(step.variables)) {
        vars.push(name);
      }
    }

    // Recurse into nested flows
    if (step.logic && typeof step.logic === 'object') {
      if (Array.isArray(step.logic.then)) {
        vars.push(...collectDeclaredVars(step.logic.then));
      }
      if (Array.isArray(step.logic.else)) {
        vars.push(...collectDeclaredVars(step.logic.else));
      }
    }
    if (step.loop && typeof step.loop === 'object') {
      const loopFlow = step.loop.flow || step.loop.steps;
      if (Array.isArray(loopFlow)) {
        vars.push(...collectDeclaredVars(loopFlow));
      }
    }
    if (step.try && typeof step.try === 'object') {
      const tryFlow = step.try.flow || step.try.steps;
      if (Array.isArray(tryFlow)) {
        vars.push(...collectDeclaredVars(tryFlow));
      }
    }
    if (step.catch && typeof step.catch === 'object') {
      const catchFlow = step.catch.flow || step.catch.steps;
      if (Array.isArray(catchFlow)) {
        vars.push(...collectDeclaredVars(catchFlow));
      }
    }
    if (step.parallel && typeof step.parallel === 'object') {
      const parTasks = step.parallel.tasks || step.parallel.branches;
      if (Array.isArray(parTasks)) {
        for (const t of parTasks) {
          const tFlow = t && (t.flow || t.steps || (Array.isArray(t) ? t : []));
          if (Array.isArray(tFlow)) {
            vars.push(...collectDeclaredVars(tFlow));
          }
        }
      }
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

  if (!parallel) {
    return pad + '// Invalid parallel block: missing definition';
  }
  const tasksArray = parallel.tasks || parallel.branches;
  if (!tasksArray || !Array.isArray(tasksArray)) {
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
