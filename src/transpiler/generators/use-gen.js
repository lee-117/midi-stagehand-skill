'use strict';

/**
 * use-gen.js
 * Generates TypeScript code for `use` steps that invoke previously imported
 * YAML sub-flows with optional parameters.
 *
 * YAML example:
 *   - use: "${loginFlow}"
 *     with:
 *       username: "admin"
 *       password: "secret"
 *
 * Generated code:
 *   await agent.runYaml(loginFlow, { username: 'admin', password: 'secret' });
 */

const { resolveTemplate, toCodeString, getPad } = require('./utils');

/**
 * Generate TypeScript code for a `use` step.
 *
 * @param {object} step - The YAML step: { use: "${flowRef}", with: { params } }
 * @param {object} ctx  - Context: { indent, varScope }
 * @returns {string} TypeScript code string.
 */
function generate(step, ctx) {
  const indent = (ctx && ctx.indent) || 0;
  const pad = getPad(indent);

  const useRef = step.use;
  if (!useRef) {
    return pad + '// Invalid use: missing flow reference';
  }

  // Resolve the flow reference (usually a template like "${loginFlow}")
  const resolved = resolveTemplate(useRef);
  const flowCode = toCodeString(resolved);

  const withParams = step.with;

  if (withParams && typeof withParams === 'object') {
    const paramEntries = Object.entries(withParams).map(([k, v]) => {
      return k + ': ' + toCodeString(resolveTemplate(v));
    });
    const paramsStr = '{ ' + paramEntries.join(', ') + ' }';
    return pad + 'await agent.runYaml(' + flowCode + ', ' + paramsStr + ');';
  }

  return pad + 'await agent.runYaml(' + flowCode + ');';
}

module.exports = { generate };
