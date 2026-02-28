'use strict';

/**
 * native-gen.js
 * Converts native Midscene YAML actions into TypeScript agent calls.
 */

const { resolveTemplate, toCodeString, escapeForTemplateLiteral } = require('./utils');

/**
 * Build an array of "key: value" option entries from action options like deepThink, xpath, timeout.
 * Returns an empty array if no options are found.
 */
function buildOptionEntries(step, extra) {
  const opts = [];
  if (step.deepThink === true) opts.push('deepThink: true');
  if (step.xpath) opts.push('xpath: ' + toCodeString(resolveTemplate(step.xpath)));
  if (step.timeout !== undefined) opts.push('timeoutMs: ' + step.timeout);
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      opts.push(k + ': ' + v);
    }
  }
  return opts;
}

/**
 * Build an options object string from action options like deepThink, xpath, timeout.
 */
function buildOptions(step, extra) {
  const entries = buildOptionEntries(step, extra);
  if (entries.length === 0) return null;
  return '{ ' + entries.join(', ') + ' }';
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
  const varScope = ctx && ctx.varScope || new Set();

  // --- sleep ---
  if (step.sleep !== undefined) {
    const ms = typeof step.sleep === 'number' ? step.sleep : toCodeString(resolveTemplate(String(step.sleep)));
    return pad + 'await new Promise(r => setTimeout(r, ' + ms + '));';
  }

  // --- javascript ---
  if (step.javascript !== undefined) {
    const code = escapeForTemplateLiteral(step.javascript);
    return pad + 'await agent.evaluateJavaScript(`' + code + '`);';
  }

  // --- recordToReport ---
  if (step.recordToReport !== undefined) {
    const title = toCodeString(resolveTemplate(step.recordToReport));
    const content = step.content ? toCodeString(resolveTemplate(step.content)) : "''";
    return pad + 'await agent.recordToReport(' + title + ', { content: ' + content + ' });';
  }

  // --- aiQuery ---
  if (step.aiQuery !== undefined) {
    let prompt;
    let varName = 'queryResult';

    if (typeof step.aiQuery === 'object' && step.aiQuery !== null) {
      // Object syntax: aiQuery: { query: "...", name: "..." }
      prompt = toCodeString(resolveTemplate(step.aiQuery.query || ''));
      varName = step.aiQuery.name || step.name || 'queryResult';
    } else {
      // String syntax: aiQuery: "..."
      prompt = toCodeString(resolveTemplate(step.aiQuery));
      varName = step.name || 'queryResult';
    }

    varScope.add(varName);
    return pad + 'const ' + varName + ' = await agent.aiQuery(' + prompt + ');';
  }

  // --- aiAssert ---
  if (step.aiAssert !== undefined) {
    let prompt;
    let errorMsg = null;

    if (typeof step.aiAssert === 'object' && step.aiAssert !== null) {
      // Object syntax: aiAssert: { assertion: "...", errorMessage: "..." }
      prompt = toCodeString(resolveTemplate(step.aiAssert.assertion || ''));
      if (step.aiAssert.errorMessage) {
        errorMsg = toCodeString(resolveTemplate(step.aiAssert.errorMessage));
      }
    } else {
      prompt = toCodeString(resolveTemplate(step.aiAssert));
    }

    if (errorMsg) {
      return pad + 'await agent.aiAssert(' + prompt + ', { errorMessage: ' + errorMsg + ' });';
    }
    return pad + 'await agent.aiAssert(' + prompt + ');';
  }

  // --- aiWaitFor ---
  if (step.aiWaitFor !== undefined) {
    let prompt;
    let timeout = step.timeout;

    if (typeof step.aiWaitFor === 'object' && step.aiWaitFor !== null) {
      // Object syntax: aiWaitFor: { condition: "...", timeout: 10000 }
      prompt = toCodeString(resolveTemplate(step.aiWaitFor.condition || ''));
      timeout = step.aiWaitFor.timeout || timeout;
    } else {
      prompt = toCodeString(resolveTemplate(step.aiWaitFor));
    }

    if (timeout !== undefined) {
      return pad + 'await agent.aiWaitFor(' + prompt + ', { timeoutMs: ' + timeout + ' });';
    }
    return pad + 'await agent.aiWaitFor(' + prompt + ');';
  }

  // --- aiTap ---
  if (step.aiTap !== undefined) {
    let prompt;

    if (typeof step.aiTap === 'object' && step.aiTap !== null) {
      // Object syntax: aiTap: { locator: "...", deepThink: true, xpath: "..." }
      if (step.aiTap.xpath) {
        return pad + 'await agent.aiTap({ xpath: ' + toCodeString(resolveTemplate(step.aiTap.xpath)) + ' });';
      }
      prompt = toCodeString(resolveTemplate(step.aiTap.locator || ''));
      const opts = buildOptions(step.aiTap);
      if (opts) {
        return pad + 'await agent.aiTap(' + prompt + ', ' + opts + ');';
      }
    } else {
      prompt = toCodeString(resolveTemplate(step.aiTap));
      const opts = buildOptions(step);
      if (opts) {
        return pad + 'await agent.aiTap(' + prompt + ', ' + opts + ');';
      }
    }

    return pad + 'await agent.aiTap(' + prompt + ');';
  }

  // --- aiHover ---
  if (step.aiHover !== undefined) {
    let prompt;

    if (typeof step.aiHover === 'object' && step.aiHover !== null) {
      if (step.aiHover.xpath) {
        return pad + 'await agent.aiHover({ xpath: ' + toCodeString(resolveTemplate(step.aiHover.xpath)) + ' });';
      }
      prompt = toCodeString(resolveTemplate(step.aiHover.locator || ''));
      const opts = buildOptions(step.aiHover);
      if (opts) {
        return pad + 'await agent.aiHover(' + prompt + ', ' + opts + ');';
      }
    } else {
      prompt = toCodeString(resolveTemplate(step.aiHover));
    }

    return pad + 'await agent.aiHover(' + prompt + ');';
  }

  // --- aiInput ---
  if (step.aiInput !== undefined) {
    let prompt;
    let value;
    let optSource;

    if (typeof step.aiInput === 'object' && step.aiInput !== null) {
      // Object syntax: aiInput: { locator: "...", value: "..." }
      prompt = toCodeString(resolveTemplate(step.aiInput.locator || ''));
      value = toCodeString(resolveTemplate(step.aiInput.value || ''));
      optSource = step.aiInput;
    } else {
      // String syntax: aiInput: "..." with separate value field
      prompt = toCodeString(resolveTemplate(step.aiInput));
      value = step.value !== undefined ? toCodeString(resolveTemplate(step.value)) : "''";
      optSource = step;
    }

    const optEntries = buildOptionEntries(optSource);
    optEntries.unshift('value: ' + value);
    return pad + 'await agent.aiInput(' + prompt + ', { ' + optEntries.join(', ') + ' });';
  }

  // --- aiKeyboardPress ---
  if (step.aiKeyboardPress !== undefined) {
    const key = toCodeString(resolveTemplate(step.aiKeyboardPress));
    return pad + 'await agent.aiKeyboardPress(' + key + ');';
  }

  // --- aiScroll ---
  if (step.aiScroll !== undefined) {
    if (typeof step.aiScroll === 'object') {
      const parts = [];
      if (step.aiScroll.locator) {
        parts.push('locator: ' + toCodeString(resolveTemplate(step.aiScroll.locator)));
      }
      if (step.aiScroll.direction) {
        parts.push("direction: '" + step.aiScroll.direction + "'");
      }
      if (step.aiScroll.distance !== undefined) {
        parts.push('distance: ' + step.aiScroll.distance);
      }
      if (step.aiScroll.scrollCount !== undefined) {
        parts.push('scrollCount: ' + step.aiScroll.scrollCount);
      }
      return pad + 'await agent.aiScroll({ ' + parts.join(', ') + ' });';
    }
    return pad + "await agent.aiScroll({ direction: '" + step.aiScroll + "' });";
  }

  // --- ai / aiAct (general action prompt) ---
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

module.exports = { generate };
