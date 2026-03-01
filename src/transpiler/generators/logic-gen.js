'use strict';

/**
 * logic-gen.js
 * Converts `logic` (if/else) blocks from YAML into TypeScript if/else statements
 * using agent.aiBoolean() for condition evaluation.
 */

const { resolveTemplate, toCodeString, getPad } = require('./utils');

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
  const pad = getPad(indent);
  const logic = step.logic;

  if (!logic || !logic.if) {
    return pad + '// Invalid logic block: missing "if" condition';
  }

  const condition = toCodeString(resolveTemplate(logic.if));
  const lines = [];

  // Opening if statement
  lines.push(pad + 'if (await agent.aiBoolean(' + condition + ')) {');

  const varScope = ctx && ctx.varScope || new Set();

  // Process "then" flow
  if (logic.then && Array.isArray(logic.then)) {
    for (const subStep of logic.then) {
      const code = processStep(subStep, indent + 1, varScope);
      if (code) lines.push(code);
    }
  }

  // Process "else" flow
  if (logic.else && Array.isArray(logic.else)) {
    lines.push(pad + '} else {');
    for (const subStep of logic.else) {
      const code = processStep(subStep, indent + 1, varScope);
      if (code) lines.push(code);
    }
  }

  lines.push(pad + '}');

  return lines.join('\n');
}

module.exports = { generate };
