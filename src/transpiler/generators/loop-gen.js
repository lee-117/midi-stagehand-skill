'use strict';

/**
 * loop-gen.js
 * Converts `loop` blocks from YAML into TypeScript loop constructs:
 *   - for: iterates over an array
 *   - while: condition-based loop with max iteration guard
 *   - repeat: fixed count loop
 */

const { resolveTemplate, toCodeString, extractVarRef, getPad } = require('./utils');
const { getNestedFlow, getLoopItemVar } = require('../../utils/yaml-helpers');

/**
 * Generate TypeScript code for a `loop` step.
 *
 * @param {object} step        - The YAML step: { loop: { type, ... } }
 * @param {object} ctx         - Context: { indent: number, varScope: Set<string> }
 * @param {function} processStep - Callback (step, indent) => string for nested steps.
 * @returns {string} TypeScript code string.
 */
function generate(step, ctx, processStep) {
  const indent = ctx && ctx.indent || 0;
  const pad = getPad(indent);
  const varScope = ctx && ctx.varScope || new Set();
  const loop = step.loop;

  if (!loop || !loop.type) {
    return pad + '// Invalid loop block: missing "type"';
  }

  const lines = [];
  const flow = getNestedFlow(loop) || [];

  switch (loop.type) {
    case 'for': {
      // for (const item of items) { ...flow }
      const itemVar = getLoopItemVar(loop);
      varScope.add(itemVar);
      const iterableRaw = loop.items || loop.in || loop.collection;
      const varRef = extractVarRef(iterableRaw);
      const iterable = varRef || toCodeString(resolveTemplate(iterableRaw));

      lines.push(pad + 'for (const ' + itemVar + ' of ' + iterable + ') {');

      for (const subStep of flow) {
        const code = processStep(subStep, indent + 1);
        if (code) lines.push(code);
      }

      lines.push(pad + '}');
      break;
    }

    case 'while': {
      // while loop with iteration guard
      const condition = toCodeString(resolveTemplate(loop.condition));
      const maxIterRaw = loop.maxIterations || loop.max_iterations || 100;
      const maxIterRef = typeof maxIterRaw === 'string' ? extractVarRef(maxIterRaw) : null;
      const maxIterations = maxIterRef || maxIterRaw;

      // Generate a unique iteration counter (_i0, _i1, _i2, ...) to avoid
      // collisions with sibling while loops sharing the same varScope.
      let iterSuffix = 0;
      while (varScope.has('_i' + iterSuffix)) {
        iterSuffix++;
      }
      const iterVar = '_i' + iterSuffix;
      varScope.add(iterVar);

      lines.push(pad + 'let ' + iterVar + ' = 0;');
      lines.push(pad + 'while (await agent.aiBoolean(' + condition + ') && ' + iterVar + ' < ' + maxIterations + ') {');

      for (const subStep of flow) {
        const code = processStep(subStep, indent + 1);
        if (code) lines.push(code);
      }

      lines.push(pad + '  ' + iterVar + '++;');
      lines.push(pad + '}');
      break;
    }

    case 'repeat': {
      // for (let i = 0; i < count; i++) { ...flow }
      const count = loop.count || loop.times || 1;
      const indexVar = loop.indexVar || 'i';

      lines.push(pad + 'for (let ' + indexVar + ' = 0; ' + indexVar + ' < ' + count + '; ' + indexVar + '++) {');

      for (const subStep of flow) {
        const code = processStep(subStep, indent + 1);
        if (code) lines.push(code);
      }

      lines.push(pad + '}');
      break;
    }

    default:
      lines.push(pad + '// Unknown loop type: ' + loop.type);
  }

  return lines.join('\n');
}

module.exports = { generate };
