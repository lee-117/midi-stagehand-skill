'use strict';

/**
 * native-gen.js
 * Converts native Midscene YAML actions into TypeScript agent calls.
 */

/**
 * Resolve YAML ${var} template syntax into JS template literals.
 * ${ENV.XXX} is converted to process.env.XXX.
 * Other ${var} references are passed through as JS template literal expressions.
 */
function resolveTemplate(str) {
  if (typeof str !== 'string') return str;
  // Check if the string contains any template expressions
  if (!str.includes('${')) return str;

  // Replace ${ENV.XXX} -> ${process.env.XXX}
  let result = str.replace(/\$\{ENV\.(\w+)\}/g, '${process.env.$1}');

  // If the entire string is a single template expression, return just the expression
  // e.g. "${myVar}" -> myVar (no backticks needed when used as a standalone value)
  const singleExprMatch = result.match(/^\$\{([^}]+)\}$/);
  if (singleExprMatch) {
    return { __expr: singleExprMatch[1], __template: '`' + result + '`' };
  }

  // Otherwise wrap in backticks for a template literal
  return { __template: '`' + result + '`' };
}

/**
 * Convert a resolved template value to a string suitable for code generation.
 * If the value is a plain string, wrap it in single quotes.
 * If it contains template expressions, return the template literal.
 */
function toCodeString(val) {
  if (val === null || val === undefined) return 'undefined';
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  if (typeof val === 'object' && val.__template) return val.__template;
  if (typeof val === 'string') {
    // Check for template expressions that were not caught
    if (val.includes('${')) {
      let result = val.replace(/\$\{ENV\.(\w+)\}/g, '${process.env.$1}');
      return '`' + result + '`';
    }
    return "'" + val.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
  }
  return JSON.stringify(val);
}

/**
 * Generate TypeScript code for a native Midscene action step.
 *
 * @param {object} step - The YAML step object with an `action` property.
 * @param {object} ctx  - Context: { indent: number, varScope: Set<string> }
 * @returns {string} TypeScript code string.
 */
function generate(step, ctx) {
  const indent = ctx && ctx.indent || 0;
  const pad = '  '.repeat(indent);
  const action = step.action || step.ai || step.aiAct;
  const varScope = ctx && ctx.varScope || new Set();

  // Determine which native action this is
  if (step.sleep !== undefined) {
    const ms = typeof step.sleep === 'number' ? step.sleep : toCodeString(resolveTemplate(String(step.sleep)));
    return pad + 'await new Promise(r => setTimeout(r, ' + ms + '));';
  }

  if (step.javascript !== undefined) {
    const code = step.javascript;
    return pad + 'await agent.evaluateJavaScript(`' + code + '`);';
  }

  if (step.recordToReport !== undefined) {
    const title = toCodeString(resolveTemplate(step.recordToReport));
    const content = step.content ? toCodeString(resolveTemplate(step.content)) : "''";
    return pad + 'await agent.recordToReport(' + title + ', { content: ' + content + ' });';
  }

  // All ai* actions
  if (step.aiQuery !== undefined) {
    const prompt = toCodeString(resolveTemplate(step.aiQuery));
    const varName = step.name || 'queryResult';
    varScope.add(varName);
    return pad + 'const ' + varName + ' = await agent.aiQuery(' + prompt + ');';
  }

  if (step.aiAssert !== undefined) {
    const prompt = toCodeString(resolveTemplate(step.aiAssert));
    return pad + 'await agent.aiAssert(' + prompt + ');';
  }

  if (step.aiWaitFor !== undefined) {
    const prompt = toCodeString(resolveTemplate(step.aiWaitFor));
    if (step.timeout !== undefined) {
      return pad + 'await agent.aiWaitFor(' + prompt + ', { timeoutMs: ' + step.timeout + ' });';
    }
    return pad + 'await agent.aiWaitFor(' + prompt + ');';
  }

  if (step.aiTap !== undefined) {
    const prompt = toCodeString(resolveTemplate(step.aiTap));
    return pad + 'await agent.aiTap(' + prompt + ');';
  }

  if (step.aiHover !== undefined) {
    const prompt = toCodeString(resolveTemplate(step.aiHover));
    return pad + 'await agent.aiHover(' + prompt + ');';
  }

  if (step.aiInput !== undefined) {
    const prompt = toCodeString(resolveTemplate(step.aiInput));
    const value = toCodeString(resolveTemplate(step.value));
    return pad + 'await agent.aiInput(' + prompt + ', { value: ' + value + ' });';
  }

  if (step.aiKeyboardPress !== undefined) {
    const key = toCodeString(resolveTemplate(step.aiKeyboardPress));
    return pad + 'await agent.aiKeyboardPress(' + key + ');';
  }

  if (step.aiScroll !== undefined) {
    const direction = step.aiScroll.direction || step.aiScroll;
    const distance = step.aiScroll.distance;
    if (typeof step.aiScroll === 'object') {
      const parts = [];
      if (direction) parts.push("direction: '" + direction + "'");
      if (distance !== undefined) parts.push('distance: ' + distance);
      return pad + 'await agent.aiScroll({ ' + parts.join(', ') + ' });';
    }
    return pad + "await agent.aiScroll({ direction: '" + step.aiScroll + "' });";
  }

  // ai / aiAct (general action prompt)
  if (step.ai !== undefined) {
    const prompt = toCodeString(resolveTemplate(step.ai));
    return pad + 'await agent.aiAct(' + prompt + ');';
  }

  if (step.aiAct !== undefined) {
    const prompt = toCodeString(resolveTemplate(step.aiAct));
    return pad + 'await agent.aiAct(' + prompt + ');';
  }

  // Fallback: unknown native action
  return pad + '// Unknown native action: ' + JSON.stringify(step);
}

module.exports = { generate, resolveTemplate, toCodeString };
