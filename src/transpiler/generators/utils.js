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
 * Check if a template expression is safe (simple identifier/property path only).
 * Allows: variable names, dot access, bracket notation with numeric indices or simple strings.
 * Rejects: function calls, require, eval, import, __proto__, constructor, prototype.
 *
 * @param {string} expr - The expression inside ${...}.
 * @returns {boolean}
 */
const UNSAFE_EXPR_PATTERN = /[()`;]|\b(require|eval|import|Function|__proto__|constructor|prototype)\b/;
function isSafeTemplateExpr(expr) {
  if (typeof expr !== 'string') return false;
  return !UNSAFE_EXPR_PATTERN.test(expr);
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
 * Security: rejects expressions containing function calls or dangerous identifiers
 * (require, process, eval, import, Function, __proto__, constructor, prototype).
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
    const expr = singleExprMatch[1];
    // Allow process.env.XXX (already resolved by resolveEnvRefs) but block other unsafe expressions
    if (!expr.startsWith('process.env.') && !isSafeTemplateExpr(expr)) {
      throw new Error(`Unsafe template expression rejected: \${${expr}}. Only simple variable references are allowed.`);
    }
    return { __expr: expr };
  }

  // Validate all embedded expressions in the template
  const exprPattern = /\$\{([^}]+)\}/g;
  let match;
  while ((match = exprPattern.exec(result)) !== null) {
    const expr = match[1];
    if (!expr.startsWith('process.env.') && !isSafeTemplateExpr(expr)) {
      throw new Error(`Unsafe template expression rejected: \${${expr}}. Only simple variable references are allowed.`);
    }
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
    .replace(/`/g, '\\`')
    .replace(/\$\{/g, '\\${')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

/**
 * Validate that a string is a safe JavaScript identifier.
 * Used to prevent code injection via variable names from YAML.
 *
 * @param {string} name - The candidate identifier.
 * @returns {boolean}
 */
function isValidIdentifier(name) {
  return typeof name === 'string' && /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(name);
}

/**
 * Sanitize a string to be a valid JavaScript identifier.
 * Replaces invalid characters with underscores.
 *
 * @param {string} name - The candidate identifier.
 * @returns {string} A valid identifier.
 */
function sanitizeIdentifier(name) {
  if (typeof name !== 'string' || name.trim() === '') return '_unnamed';
  if (isValidIdentifier(name)) return name;
  // Replace invalid chars with underscore, ensure starts with letter/_/$
  let sanitized = name.replace(/[^a-zA-Z0-9_$]/g, '_');
  if (/^[0-9]/.test(sanitized)) sanitized = '_' + sanitized;
  return sanitized || '_unnamed';
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
  return str
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$\{/g, '\\${')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
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
  isValidIdentifier,
  sanitizeIdentifier,
};
