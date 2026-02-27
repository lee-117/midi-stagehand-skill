'use strict';

/**
 * import-gen.js
 * Converts `import` directives from YAML into TypeScript import/require statements.
 * Supports:
 *   - YAML file imports (inline or runYaml)
 *   - JSON file imports (require)
 *   - Other file type imports
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
 * Detect file type from a file path string.
 */
function getFileExtension(filePath) {
  const match = filePath.match(/\.([a-zA-Z0-9]+)$/);
  return match ? match[1].toLowerCase() : '';
}

/**
 * Generate TypeScript code for an `import` step.
 *
 * @param {object} step - The YAML step: { import: "path", as: "varName", with: { params } }
 * @param {object} ctx  - Context: { indent: number, varScope: Set<string> }
 * @returns {string} TypeScript code string.
 */
function generate(step, ctx) {
  const indent = ctx && ctx.indent || 0;
  const pad = '  '.repeat(indent);
  const varScope = ctx && ctx.varScope || new Set();

  const importPath = step.import;
  if (!importPath || typeof importPath !== 'string') {
    return pad + '// Invalid import: missing file path';
  }

  const ext = getFileExtension(importPath);
  const pathCode = toCodeString(resolveTemplate(importPath));

  // JSON imports: const varName = require('./file.json')
  if (ext === 'json') {
    const varName = step.as || 'importedData';
    varScope.add(varName);
    return pad + 'const ' + varName + ' = require(' + pathCode + ');';
  }

  // YAML/YML imports: inline via agent.runYaml or similar
  if (ext === 'yaml' || ext === 'yml') {
    const withParams = step.with;

    if (withParams && typeof withParams === 'object') {
      // Build params object
      const paramEntries = Object.entries(withParams).map(([k, v]) => {
        return k + ': ' + toCodeString(resolveTemplate(v));
      });
      const paramsStr = '{ ' + paramEntries.join(', ') + ' }';

      if (step.as) {
        varScope.add(step.as);
        return pad + 'const ' + step.as + ' = await agent.runYaml(' + pathCode + ', ' + paramsStr + ');';
      }
      return pad + 'await agent.runYaml(' + pathCode + ', ' + paramsStr + ');';
    }

    if (step.as) {
      varScope.add(step.as);
      return pad + 'const ' + step.as + ' = await agent.runYaml(' + pathCode + ');';
    }
    return pad + 'await agent.runYaml(' + pathCode + ');';
  }

  // JS/TS imports: require
  if (ext === 'js' || ext === 'ts') {
    const varName = step.as || 'importedModule';
    varScope.add(varName);
    return pad + 'const ' + varName + ' = require(' + pathCode + ');';
  }

  // Fallback: generic require
  if (step.as) {
    varScope.add(step.as);
    return pad + 'const ' + step.as + ' = require(' + pathCode + ');';
  }
  return pad + 'require(' + pathCode + ');';
}

module.exports = { generate };
