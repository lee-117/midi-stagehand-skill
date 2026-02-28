'use strict';

/**
 * utils.js
 * Shared utility functions used by all code generators.
 * Provides template resolution, code string conversion, and helper functions.
 */

/**
 * Resolve YAML ${var} template syntax into JS template literals.
 * ${ENV.XXX} and ${ENV:XXX} are converted to process.env.XXX.
 *
 * Returns:
 * - The original string if no templates found.
 * - { __expr: 'varName' } if the entire string is a single ${varName} expression.
 * - { __template: '`...`' } if the string contains embedded expressions.
 *
 * @param {*} str - Input value (only strings are processed).
 * @returns {string|object} Resolved value.
 */
function resolveTemplate(str) {
  if (typeof str !== 'string') return str;
  if (!str.includes('${')) return str;

  // Replace ${ENV.XXX} and ${ENV:XXX} -> ${process.env.XXX}
  let result = str.replace(/\$\{ENV\.(\w+)\}/g, '${process.env.$1}');
  result = result.replace(/\$\{ENV:(\w+)\}/g, '${process.env.$1}');

  // If the entire string is a single ${...} expression, return the inner expression directly
  const singleExprMatch = result.match(/^\$\{([^}]+)\}$/);
  if (singleExprMatch) {
    return { __expr: singleExprMatch[1] };
  }

  // Otherwise it's a template literal with embedded expressions
  return { __template: '`' + result + '`' };
}

/**
 * Convert a resolved template value to a code string.
 * - Plain strings are wrapped in single quotes.
 * - Template literals are returned as-is.
 * - Single expressions are returned as raw variable references.
 *
 * @param {*} val - A value (possibly resolved by resolveTemplate).
 * @returns {string} TypeScript code string.
 */
function toCodeString(val) {
  if (val === null || val === undefined) return 'undefined';
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  if (typeof val === 'object' && val.__template) return val.__template;
  if (typeof val === 'object' && val.__expr) return val.__expr;
  if (typeof val === 'string') {
    if (val.includes('${')) {
      let result = val.replace(/\$\{ENV\.(\w+)\}/g, '${process.env.$1}');
      result = result.replace(/\$\{ENV:(\w+)\}/g, '${process.env.$1}');
      return '`' + result + '`';
    }
    return "'" + val.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
  }
  return JSON.stringify(val);
}

/**
 * Extract a raw variable reference from a template string like "${items}".
 *
 * @param {*} str - Input string.
 * @returns {string|null} The variable name, or null if not a simple reference.
 */
function extractVarRef(str) {
  if (typeof str !== 'string') return null;
  const match = str.match(/^\$\{([a-zA-Z_$][a-zA-Z0-9_$.]*)\}$/);
  return match ? match[1] : null;
}

/**
 * Escape backticks and dollar-brace sequences in a string so it can be safely
 * embedded inside a JS template literal.
 *
 * @param {string} str - Input string.
 * @returns {string} Escaped string.
 */
function escapeForTemplateLiteral(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
}

/**
 * Escape a string for use in a RegExp.
 *
 * @param {string} str - Input string.
 * @returns {string} Escaped string safe for RegExp constructor.
 */
function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
  resolveTemplate,
  toCodeString,
  extractVarRef,
  escapeForTemplateLiteral,
  escapeRegExp,
};
