'use strict';

/**
 * loop-gen.js
 * Converts `loop` blocks from YAML into TypeScript loop constructs:
 *   - for: iterates over an array
 *   - while: condition-based loop with max iteration guard
 *   - repeat: fixed count loop
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
 * Convert a resolved template to a code string.
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
 * Extract a raw variable reference from a template string like "${items}".
 * Returns the variable name if it's a simple reference, or null otherwise.
 */
function extractVarRef(str) {
  if (typeof str !== 'string') return null;
  const match = str.match(/^\$\{([a-zA-Z_$][a-zA-Z0-9_$.]*)\}$/);
  return match ? match[1] : null;
}

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
  const pad = '  '.repeat(indent);
  const loop = step.loop;

  if (!loop || !loop.type) {
    return pad + '// Invalid loop block: missing "type"';
  }

  const lines = [];
  const flow = loop.flow || loop.steps || [];

  switch (loop.type) {
    case 'for': {
      // for (const item of items) { ...flow }
      const itemVar = loop.as || loop.item || 'item';
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

      lines.push(pad + 'let _iter = 0;');
      lines.push(pad + 'while (await agent.aiBoolean(' + condition + ') && _iter < ' + maxIterations + ') {');

      for (const subStep of flow) {
        const code = processStep(subStep, indent + 1);
        if (code) lines.push(code);
      }

      lines.push(pad + '  _iter++;');
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
