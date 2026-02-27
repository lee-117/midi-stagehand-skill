'use strict';

/**
 * logic-gen.js
 * Converts `logic` (if/else) blocks from YAML into TypeScript if/else statements
 * using agent.aiBoolean() for condition evaluation.
 */

/**
 * Resolve YAML ${var} template syntax into JS template literals.
 * ${ENV.XXX} is converted to process.env.XXX.
 */
function resolveTemplate(str) {
  if (typeof str !== 'string') return str;
  if (!str.includes('${')) return str;

  let result = str.replace(/\$\{ENV\.(\w+)\}/g, '${process.env.$1}');

  const singleExprMatch = result.match(/^\$\{([^}]+)\}$/);
  if (singleExprMatch) {
    return { __expr: singleExprMatch[1] };
  }

  return { __template: '`' + result + '`' };
}

/**
 * Convert a resolved template to a code string for use as a prompt.
 */
function toCodeString(val) {
  if (val === null || val === undefined) return 'undefined';
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  if (typeof val === 'object' && val.__template) return val.__template;
  if (typeof val === 'object' && val.__expr) return val.__expr;
  if (typeof val === 'string') {
    if (val.includes('${')) {
      let result = val.replace(/\$\{ENV\.(\w+)\}/g, '${process.env.$1}');
      return '`' + result + '`';
    }
    return "'" + val.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
  }
  return JSON.stringify(val);
}

/**
 * Generate TypeScript code for a `logic` (if/else) step.
 *
 * @param {object} step        - The YAML step: { logic: { if: "condition", then: [...], else: [...] } }
 * @param {object} ctx         - Context: { indent: number, varScope: Set<string> }
 * @param {function} processStep - Callback (step, indent) => string to recursively process nested steps.
 * @returns {string} TypeScript code string.
 */
function generate(step, ctx, processStep) {
  const indent = ctx && ctx.indent || 0;
  const pad = '  '.repeat(indent);
  const logic = step.logic;

  if (!logic || !logic.if) {
    return pad + '// Invalid logic block: missing "if" condition';
  }

  const condition = toCodeString(resolveTemplate(logic.if));
  const lines = [];

  // Opening if statement
  lines.push(pad + 'if (await agent.aiBoolean(' + condition + ')) {');

  // Process "then" flow
  if (logic.then && Array.isArray(logic.then)) {
    for (const subStep of logic.then) {
      const code = processStep(subStep, indent + 1);
      if (code) lines.push(code);
    }
  }

  // Process "else" flow
  if (logic.else && Array.isArray(logic.else)) {
    lines.push(pad + '} else {');
    for (const subStep of logic.else) {
      const code = processStep(subStep, indent + 1);
      if (code) lines.push(code);
    }
  }

  lines.push(pad + '}');

  return lines.join('\n');
}

module.exports = { generate };
