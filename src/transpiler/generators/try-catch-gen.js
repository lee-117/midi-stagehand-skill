'use strict';

/**
 * try-catch-gen.js
 * Converts `try/catch/finally` blocks from YAML into TypeScript try/catch/finally.
 */

const { getPad, sanitizeIdentifier } = require('./utils');
const { getNestedFlow } = require('../../utils/yaml-helpers');

/**
 * Generate TypeScript code for a `try/catch/finally` step.
 *
 * @param {object} step        - The YAML step: { try: { flow: [...] }, catch: { flow: [...] }, finally: { flow: [...] } }
 * @param {object} ctx         - Context: { indent: number, varScope: Set<string> }
 * @param {function} processStep - Callback (step, indent) => string for nested steps.
 * @returns {string} TypeScript code string.
 */
function generate(step, ctx, processStep) {
  const indent = ctx && ctx.indent || 0;
  const pad = getPad(indent);
  const lines = [];

  // --- try block ---
  const tryBlock = step.try;
  if (!tryBlock) {
    return pad + '// Invalid try-catch block: missing "try"';
  }

  const varScope = ctx && ctx.varScope || new Set();
  const tryFlow = getNestedFlow(tryBlock) || (Array.isArray(tryBlock) ? tryBlock : []);

  lines.push(pad + 'try {');
  for (const subStep of tryFlow) {
    const code = processStep(subStep, indent + 1, varScope);
    if (code) lines.push(code);
  }

  // --- catch block ---
  const catchBlock = step.catch;
  if (catchBlock) {
    const catchFlow = getNestedFlow(catchBlock) || (Array.isArray(catchBlock) ? catchBlock : []);
    const errorVar = sanitizeIdentifier(catchBlock.error || catchBlock.as || 'e');

    lines.push(pad + '} catch (' + errorVar + ') {');
    for (const subStep of catchFlow) {
      const code = processStep(subStep, indent + 1, varScope);
      if (code) lines.push(code);
    }
  }

  // If no catch and no finally, add an empty catch to avoid syntax error
  const finallyBlock = step.finally;
  if (!catchBlock && !finallyBlock) {
    lines.push(pad + '} catch (_e) { /* no catch/finally defined */ }');
    return lines.join('\n');
  }

  // --- finally block ---
  if (finallyBlock) {
    const finallyFlow = getNestedFlow(finallyBlock) || (Array.isArray(finallyBlock) ? finallyBlock : []);

    lines.push(pad + '} finally {');

    for (const subStep of finallyFlow) {
      const code = processStep(subStep, indent + 1, varScope);
      if (code) lines.push(code);
    }
  }

  lines.push(pad + '}');

  return lines.join('\n');
}

module.exports = { generate };
