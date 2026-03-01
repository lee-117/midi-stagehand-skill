'use strict';

/**
 * utils.js
 * Shared utility functions used by all code generators.
 * Provides template resolution, code string conversion, and helper functions.
 */

/**
 * Replace ${ENV.XXX} and ${ENV:XXX} patterns with ${process.env.XXX}.
 * This is the single source of truth for environment variable resolution.
 *
 * @param {string} str - Input string.
 * @returns {string} String with ENV references resolved.
 */
function resolveEnvRefs(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/\$\{ENV\.(\w+)\}/g, '${process.env.$1}')
    .replace(/\$\{ENV:(\w+)\}/g, '${process.env.$1}');
}

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

  const result = resolveEnvRefs(str);

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
 * Callers should always pre-resolve via resolveTemplate() first.
 * - Plain strings are wrapped in single quotes.
 * - Template literals ({__template}) are returned as-is.
 * - Single expressions ({__expr}) are returned as raw variable references.
 *
 * @param {*} val - A value (resolved by resolveTemplate).
 * @returns {string} TypeScript code string.
 */
function toCodeString(val) {
  if (val === null || val === undefined) return 'undefined';
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  if (typeof val === 'object' && val.__template) return val.__template;
  if (typeof val === 'object' && val.__expr) return val.__expr;
  if (typeof val === 'string') {
    return "'" + escapeStringLiteral(val) + "'";
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
 * Escape a string for safe use inside a single-quoted JS string literal.
 * Handles backslashes and single quotes.
 *
 * @param {string} str - Input string.
 * @returns {string} Escaped string (without surrounding quotes).
 */
function escapeStringLiteral(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
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

/**
 * Convert an indentation level to a whitespace string (2-space units).
 *
 * @param {number} indent - Number of indentation levels.
 * @returns {string} The whitespace string.
 */
function getPad(indent) {
  return '  '.repeat(indent || 0);
}

module.exports = {
  resolveEnvRefs,
  resolveTemplate,
  toCodeString,
  extractVarRef,
  escapeStringLiteral,
  escapeForTemplateLiteral,
  escapeRegExp,
  getPad,
};
