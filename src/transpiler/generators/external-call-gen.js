'use strict';

/**
 * external-call-gen.js
 * Converts `external_call` blocks from YAML into TypeScript code for HTTP requests
 * or shell command execution.
 */

const { resolveTemplate, toCodeString, getPad } = require('./utils');

// Max entries before switching to multi-line object literal formatting
const MAX_INLINE_HEADER_ENTRIES = 2;
const MAX_INLINE_BODY_ENTRIES = 3;
// Max nesting depth for bodyToCode to prevent stack overflow on pathological input
const MAX_BODY_DEPTH = 10;

/**
 * Convert a headers object into a TypeScript object literal string.
 */
function headersToCode(headers, pad) {
  if (!headers || typeof headers !== 'object') return null;

  const entries = Object.entries(headers).map(([k, v]) => {
    return "'" + k + "': " + toCodeString(resolveTemplate(v));
  });

  if (entries.length <= MAX_INLINE_HEADER_ENTRIES) {
    return '{ ' + entries.join(', ') + ' }';
  }

  // Multi-line for readability
  const innerPad = pad + '  ';
  return '{\n' + entries.map(e => innerPad + e).join(',\n') + '\n' + pad + '}';
}

/**
 * Convert a body object into a TypeScript object literal string,
 * resolving ${...} template variables in values.
 *
 * @param {*}      body  - The body value to convert.
 * @param {string} pad   - Current indentation string.
 * @param {number} depth - Current recursion depth (guarded by MAX_BODY_DEPTH).
 */
function bodyToCode(body, pad, depth) {
  if (depth === undefined) depth = 0;
  if (!body || typeof body !== 'object') return JSON.stringify(body);
  if (depth >= MAX_BODY_DEPTH) return JSON.stringify(body);

  if (Array.isArray(body)) {
    const items = body.map((item) => {
      if (typeof item === 'string') return toCodeString(resolveTemplate(item));
      if (typeof item === 'object' && item !== null) return bodyToCode(item, pad, depth + 1);
      return JSON.stringify(item);
    });
    return '[' + items.join(', ') + ']';
  }

  const entries = Object.entries(body).map(([k, v]) => {
    if (typeof v === 'string') {
      return "'" + k + "': " + toCodeString(resolveTemplate(v));
    }
    if (typeof v === 'object' && v !== null) {
      return "'" + k + "': " + bodyToCode(v, pad, depth + 1);
    }
    return "'" + k + "': " + JSON.stringify(v);
  });

  if (entries.length <= MAX_INLINE_BODY_ENTRIES) {
    return '{ ' + entries.join(', ') + ' }';
  }

  const innerPad = pad + '  ';
  return '{\n' + entries.map(e => innerPad + e).join(',\n') + '\n' + pad + '}';
}

/**
 * Generate TypeScript code for an `external_call` step.
 *
 * @param {object} step - The YAML step: { external_call: { type, url, method, headers, body, command, response_as } }
 * @param {object} ctx  - Context: { indent: number, varScope: Set<string> }
 * @returns {string} TypeScript code string.
 */
function generate(step, ctx) {
  const indent = ctx && ctx.indent || 0;
  const pad = getPad(indent);
  const varScope = ctx && ctx.varScope || new Set();
  const call = step.external_call;

  if (!call || !call.type) {
    return pad + '// Invalid external_call: missing type';
  }

  const responseVar = call.response_as || call.as || call.name || 'response';

  switch (call.type) {
    case 'http': {
      const url = toCodeString(resolveTemplate(call.url));
      const method = (call.method || 'GET').toUpperCase();
      const lines = [];

      // Build fetch options
      const fetchOptions = [];
      fetchOptions.push("method: '" + method + "'");

      if (call.headers) {
        const headersCode = headersToCode(call.headers, pad + '  ');
        fetchOptions.push('headers: ' + headersCode);
      }

      if (call.body) {
        if (typeof call.body === 'object') {
          const bodyCode = bodyToCode(call.body, pad + '  ');
          fetchOptions.push('body: JSON.stringify(' + bodyCode + ')');
        } else {
          const bodyCode = toCodeString(resolveTemplate(call.body));
          fetchOptions.push('body: JSON.stringify(' + bodyCode + ')');
        }
      }

      // Determine if we need multi-line options
      const optionsStr = '{ ' + fetchOptions.join(', ') + ' }';

      varScope.add(responseVar);

      if (method === 'GET' && !call.headers && !call.body) {
        // Simple GET request
        lines.push(pad + 'const ' + responseVar + ' = await fetch(' + url + ').then(r => r.json());');
      } else {
        lines.push(pad + 'const ' + responseVar + ' = await fetch(' + url + ', ' + optionsStr + ').then(r => r.json());');
      }

      return lines.join('\n');
    }

    case 'shell': {
      const command = toCodeString(resolveTemplate(call.command));
      varScope.add(responseVar);
      return pad + "const " + responseVar + " = execSync(" + command + ").toString();";
    }

    default:
      return pad + '// Unknown external_call type: ' + call.type;
  }
}

module.exports = { generate };
