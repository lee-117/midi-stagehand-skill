'use strict';

/**
 * variable-gen.js
 * Converts `variables` declarations from YAML into TypeScript const/let declarations.
 */

const { resolveTemplate } = require('./utils');

/**
 * Convert a value into a TypeScript code representation.
 */
function valueToCode(val) {
  if (val === null || val === undefined) return 'undefined';
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);

  if (typeof val === 'string') {
    const resolved = resolveTemplate(val);
    if (typeof resolved === 'object' && resolved.__expr) return resolved.__expr;
    if (typeof resolved === 'object' && resolved.__template) return resolved.__template;
    // Plain string, wrap in single quotes
    return "'" + val.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
  }

  if (Array.isArray(val)) {
    const items = val.map(v => valueToCode(v));
    return '[' + items.join(', ') + ']';
  }

  if (typeof val === 'object') {
    const entries = Object.entries(val).map(([k, v]) => {
      const key = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(k) ? k : "'" + k + "'";
      return key + ': ' + valueToCode(v);
    });
    return '{ ' + entries.join(', ') + ' }';
  }

  return JSON.stringify(val);
}

/**
 * Generate TypeScript code for a `variables` declaration step.
 *
 * @param {object} step - The YAML step object: { variables: { key: value, ... } }
 * @param {object} ctx  - Context: { indent: number, varScope: Set<string> }
 * @returns {string} TypeScript code string.
 */
function generate(step, ctx) {
  const indent = ctx && ctx.indent || 0;
  const pad = '  '.repeat(indent);
  const varScope = ctx && ctx.varScope || new Set();
  const variables = step.variables;

  if (!variables || typeof variables !== 'object') {
    return pad + '// Invalid variables declaration';
  }

  const lines = [];

  for (const [name, value] of Object.entries(variables)) {
    const codeValue = valueToCode(value);

    // Use `let` if the variable was already declared (reassignment), otherwise `const`
    if (varScope.has(name)) {
      lines.push(pad + name + ' = ' + codeValue + ';');
    } else {
      varScope.add(name);
      lines.push(pad + 'const ' + name + ' = ' + codeValue + ';');
    }
  }

  return lines.join('\n');
}

module.exports = { generate, resolveTemplate, valueToCode };
