'use strict';

/**
 * external-call-gen.js
 * Converts `external_call` blocks from YAML into TypeScript code for HTTP requests
 * or shell command execution.
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
 * Convert a headers object into a TypeScript object literal string.
 */
function headersToCode(headers, pad) {
  if (!headers || typeof headers !== 'object') return null;

  const entries = Object.entries(headers).map(([k, v]) => {
    return "'" + k + "': " + toCodeString(resolveTemplate(v));
  });

  if (entries.length <= 2) {
    return '{ ' + entries.join(', ') + ' }';
  }

  // Multi-line for readability
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
  const pad = '  '.repeat(indent);
  const varScope = ctx && ctx.varScope || new Set();
  const call = step.external_call;

  if (!call || !call.type) {
    return pad + '// Invalid external_call: missing type';
  }

  const responseVar = call.response_as || call.as || 'response';

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
          fetchOptions.push('body: JSON.stringify(' + JSON.stringify(call.body) + ')');
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
      return pad + "const " + responseVar + " = require('child_process').execSync(" + command + ").toString();";
    }

    default:
      return pad + '// Unknown external_call type: ' + call.type;
  }
}

module.exports = { generate };
