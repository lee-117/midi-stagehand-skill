'use strict';

/**
 * native-gen.js
 * Converts native Midscene YAML actions into TypeScript agent calls.
 */

const { resolveTemplate, toCodeString, escapeForTemplateLiteral, getPad, sanitizeIdentifier } = require('./utils');

/**
 * Build an array of "key: value" option entries from action options like deepThink, xpath, timeout.
 * Returns an empty array if no options are found.
 */
function buildOptionEntries(step, extra) {
  const opts = [];
  // deepThink supports three states: true | false | 'unset'
  if (step.deepThink !== undefined) {
    if (step.deepThink === 'unset') {
      opts.push("deepThink: 'unset'");
    } else {
      opts.push('deepThink: ' + step.deepThink);
    }
  }
  if (step.xpath) opts.push('xpath: ' + toCodeString(resolveTemplate(step.xpath)));
  if (step.timeout !== undefined) opts.push('timeoutMs: ' + step.timeout);
  if (step.cacheable !== undefined) opts.push('cacheable: ' + step.cacheable);
  if (step.fileChooserAccept) {
    if (Array.isArray(step.fileChooserAccept)) {
      opts.push('fileChooserAccept: ' + JSON.stringify(step.fileChooserAccept));
    } else {
      opts.push('fileChooserAccept: ' + toCodeString(resolveTemplate(step.fileChooserAccept)));
    }
  }
  if (step.convertHttpImage2Base64 !== undefined) opts.push('convertHttpImage2Base64: ' + step.convertHttpImage2Base64);
  if (step.autoDismissKeyboard !== undefined) opts.push('autoDismissKeyboard: ' + step.autoDismissKeyboard);
  if (step.mode) opts.push('mode: ' + toCodeString(step.mode));
  if (Array.isArray(step.images)) {
    opts.push('images: ' + JSON.stringify(step.images));
  }
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
 * Build options for data extraction methods (aiQuery, aiBoolean, aiNumber, aiString, aiAsk).
 * These methods support domIncluded and screenshotIncluded.
 */
function buildDataQueryOptions(step) {
  const opts = [];
  if (step.domIncluded !== undefined) {
    opts.push('domIncluded: ' + (typeof step.domIncluded === 'string' ? toCodeString(step.domIncluded) : step.domIncluded));
  }
  if (step.screenshotIncluded !== undefined) {
    opts.push('screenshotIncluded: ' + step.screenshotIncluded);
  }
  if (opts.length === 0) return null;
  return '{ ' + opts.join(', ') + ' }';
}

/**
 * Generate code for a locator-based action (aiTap, aiHover).
 * Both follow the same pattern: xpath shortcut → locator + options → plain string.
 *
 * @param {string} actionName - Agent method name (e.g. 'aiTap', 'aiHover').
 * @param {*} actionValue     - The value of step[actionName].
 * @param {object} step       - The full step object (for sibling options).
 * @param {string} pad        - Indentation string.
 * @returns {string} TypeScript code string.
 */
function generateLocatorAction(actionName, actionValue, step, pad) {
  let prompt;

  if (typeof actionValue === 'object' && actionValue !== null) {
    if (actionValue.xpath) {
      return pad + 'await agent.' + actionName + '({ xpath: ' + toCodeString(resolveTemplate(actionValue.xpath)) + ' });';
    }
    // Support locate object format (image prompting): { prompt, images, convertHttpImage2Base64 }
    if (actionValue.locate && typeof actionValue.locate === 'object') {
      const locateEntries = [];
      if (actionValue.locate.prompt) locateEntries.push('prompt: ' + toCodeString(resolveTemplate(actionValue.locate.prompt)));
      if (Array.isArray(actionValue.locate.images)) locateEntries.push('images: ' + JSON.stringify(actionValue.locate.images));
      if (actionValue.locate.convertHttpImage2Base64 !== undefined) locateEntries.push('convertHttpImage2Base64: ' + actionValue.locate.convertHttpImage2Base64);
      const locateObj = '{ ' + locateEntries.join(', ') + ' }';
      const opts = buildOptions(actionValue);
      if (opts) {
        return pad + 'await agent.' + actionName + '(' + locateObj + ', ' + opts + ');';
      }
      return pad + 'await agent.' + actionName + '(' + locateObj + ');';
    }
    prompt = toCodeString(resolveTemplate(actionValue.locator || ''));
    const opts = buildOptions(actionValue);
    if (opts) {
      return pad + 'await agent.' + actionName + '(' + prompt + ', ' + opts + ');';
    }
  } else {
    prompt = toCodeString(resolveTemplate(actionValue));
    const opts = buildOptions(step);
    if (opts) {
      return pad + 'await agent.' + actionName + '(' + prompt + ', ' + opts + ');';
    }
  }

  return pad + 'await agent.' + actionName + '(' + prompt + ');';
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
  const pad = getPad(indent);
  const varScope = ctx && ctx.varScope || new Set();

  // --- sleep ---
  if (step.sleep !== undefined) {
    const ms = typeof step.sleep === 'number' ? step.sleep : toCodeString(resolveTemplate(String(step.sleep)));
    return pad + 'await new Promise(r => setTimeout(r, ' + ms + '));';
  }

  // --- javascript ---
  if (step.javascript !== undefined) {
    const code = escapeForTemplateLiteral(step.javascript);
    const jsVarName = step.name || step.output;
    if (jsVarName && typeof jsVarName === 'string') {
      const safeVar = sanitizeIdentifier(jsVarName);
      varScope.add(safeVar);
      return pad + 'const ' + safeVar + ' = await agent.evaluateJavaScript(`' + code + '`);';
    }
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
    let varName;

    if (typeof step.aiQuery === 'object' && step.aiQuery !== null) {
      // Object syntax: aiQuery: { query: "...", name: "..." }
      prompt = toCodeString(resolveTemplate(step.aiQuery.query || ''));
      varName = sanitizeIdentifier(step.aiQuery.name || step.name || 'queryResult');
    } else {
      // String syntax: aiQuery: "..."
      prompt = toCodeString(resolveTemplate(step.aiQuery));
      varName = sanitizeIdentifier(step.name || 'queryResult');
    }

    varScope.add(varName);
    const queryOpts = buildDataQueryOptions(typeof step.aiQuery === 'object' ? step.aiQuery : step);
    if (queryOpts) {
      return pad + 'const ' + varName + ' = await agent.aiQuery(' + prompt + ', ' + queryOpts + ');';
    }
    return pad + 'const ' + varName + ' = await agent.aiQuery(' + prompt + ');';
  }

  // --- aiAssert ---
  // Official API: aiAssert(assertion, errorMsg?, options?)
  // errorMessage is a positional arg, NOT inside options object
  if (step.aiAssert !== undefined) {
    let prompt;
    let errorMsg = null;
    let optSource = step;

    if (typeof step.aiAssert === 'object' && step.aiAssert !== null) {
      // Object syntax: aiAssert: { assertion: "...", errorMessage: "..." }
      prompt = toCodeString(resolveTemplate(step.aiAssert.assertion || ''));
      if (step.aiAssert.errorMessage) {
        errorMsg = toCodeString(resolveTemplate(step.aiAssert.errorMessage));
      }
      optSource = step.aiAssert;
    } else {
      prompt = toCodeString(resolveTemplate(step.aiAssert));
      if (step.errorMessage) {
        errorMsg = toCodeString(resolveTemplate(step.errorMessage));
      }
    }

    // Build options excluding errorMessage (which is positional)
    const assertOpts = [];
    if (optSource.domIncluded !== undefined) assertOpts.push('domIncluded: ' + toCodeString(optSource.domIncluded));
    if (optSource.screenshotIncluded !== undefined) assertOpts.push('screenshotIncluded: ' + optSource.screenshotIncluded);
    const assertOptsStr = assertOpts.length > 0 ? '{ ' + assertOpts.join(', ') + ' }' : null;

    if (errorMsg && assertOptsStr) {
      return pad + 'await agent.aiAssert(' + prompt + ', ' + errorMsg + ', ' + assertOptsStr + ');';
    }
    if (errorMsg) {
      return pad + 'await agent.aiAssert(' + prompt + ', ' + errorMsg + ');';
    }
    if (assertOptsStr) {
      return pad + 'await agent.aiAssert(' + prompt + ', undefined, ' + assertOptsStr + ');';
    }
    return pad + 'await agent.aiAssert(' + prompt + ');';
  }

  // --- aiWaitFor ---
  // Official API: aiWaitFor(assertion, { timeoutMs?, checkIntervalMs? })
  if (step.aiWaitFor !== undefined) {
    let prompt;
    let timeout = step.timeout;
    let checkInterval = step.checkIntervalMs;

    if (typeof step.aiWaitFor === 'object' && step.aiWaitFor !== null) {
      // Object syntax: aiWaitFor: { condition: "...", timeout: 10000 }
      prompt = toCodeString(resolveTemplate(step.aiWaitFor.condition || ''));
      timeout = step.aiWaitFor.timeout || timeout;
      if (step.aiWaitFor.checkIntervalMs !== undefined) checkInterval = step.aiWaitFor.checkIntervalMs;
    } else {
      prompt = toCodeString(resolveTemplate(step.aiWaitFor));
    }

    const waitOpts = [];
    if (timeout !== undefined) waitOpts.push('timeoutMs: ' + timeout);
    if (checkInterval !== undefined) waitOpts.push('checkIntervalMs: ' + checkInterval);
    const waitOptSource = typeof step.aiWaitFor === 'object' ? step.aiWaitFor : step;
    if (waitOptSource.domIncluded !== undefined) waitOpts.push('domIncluded: ' + (typeof waitOptSource.domIncluded === 'string' ? toCodeString(waitOptSource.domIncluded) : waitOptSource.domIncluded));
    if (waitOptSource.screenshotIncluded !== undefined) waitOpts.push('screenshotIncluded: ' + waitOptSource.screenshotIncluded);

    if (waitOpts.length > 0) {
      return pad + 'await agent.aiWaitFor(' + prompt + ', { ' + waitOpts.join(', ') + ' });';
    }
    return pad + 'await agent.aiWaitFor(' + prompt + ');';
  }

  // --- aiTap ---
  if (step.aiTap !== undefined) {
    return generateLocatorAction('aiTap', step.aiTap, step, pad);
  }

  // --- aiHover ---
  if (step.aiHover !== undefined) {
    return generateLocatorAction('aiHover', step.aiHover, step, pad);
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
  // Official API: aiKeyboardPress(locate, { keyName, deepThink?, xpath?, cacheable? })
  // locate is first arg; keyName goes in options object
  if (step.aiKeyboardPress !== undefined) {
    let locate;
    let keyName;
    let optSource = step;

    if (typeof step.aiKeyboardPress === 'object' && step.aiKeyboardPress !== null) {
      // Object syntax: aiKeyboardPress: { locator: "...", keyName: "..." }
      locate = step.aiKeyboardPress.locator
        ? toCodeString(resolveTemplate(step.aiKeyboardPress.locator))
        : 'undefined';
      keyName = step.aiKeyboardPress.keyName || '';
      optSource = step.aiKeyboardPress;
    } else if (step.keyName) {
      // Flat syntax with separate keyName: aiKeyboardPress: "搜索框"  keyName: "Enter"
      locate = toCodeString(resolveTemplate(step.aiKeyboardPress));
      keyName = step.keyName;
    } else {
      // Shorthand: aiKeyboardPress: "Enter" — treat value as keyName, no locate
      locate = 'undefined';
      keyName = step.aiKeyboardPress;
    }

    const optEntries = buildOptionEntries(optSource);
    optEntries.unshift('keyName: ' + toCodeString(resolveTemplate(keyName)));
    return pad + 'await agent.aiKeyboardPress(' + locate + ', { ' + optEntries.join(', ') + ' });';
  }

  // --- aiScroll ---
  // Official API: aiScroll(locate | undefined, { direction?, distance?, scrollType?, deepThink?, xpath?, cacheable? })
  if (step.aiScroll !== undefined) {
    if (typeof step.aiScroll === 'object') {
      // Nested object format: aiScroll: { locator, direction, ... }
      const locate = step.aiScroll.locator
        ? toCodeString(resolveTemplate(step.aiScroll.locator))
        : 'undefined';
      const opts = [];
      if (step.aiScroll.direction) {
        opts.push('direction: ' + toCodeString(step.aiScroll.direction));
      }
      if (step.aiScroll.distance !== undefined) {
        opts.push('distance: ' + step.aiScroll.distance);
      }
      if (step.aiScroll.scrollType) {
        opts.push('scrollType: ' + toCodeString(step.aiScroll.scrollType));
      }
      const extraOpts = buildOptionEntries(step.aiScroll);
      opts.push(...extraOpts);
      if (opts.length > 0) {
        return pad + 'await agent.aiScroll(' + locate + ', { ' + opts.join(', ') + ' });';
      }
      return pad + 'await agent.aiScroll(' + locate + ');';
    }
    // Flat/sibling format: aiScroll: "prompt" with direction/distance/scrollType as siblings
    const locate = (typeof step.aiScroll === 'string' && step.aiScroll !== '')
      ? toCodeString(resolveTemplate(step.aiScroll))
      : 'undefined';
    const opts = [];
    if (step.direction) {
      opts.push('direction: ' + toCodeString(step.direction));
    }
    if (step.distance !== undefined) {
      opts.push('distance: ' + step.distance);
    }
    if (step.scrollType) {
      opts.push('scrollType: ' + toCodeString(step.scrollType));
    }
    const extraOpts = buildOptionEntries(step);
    opts.push(...extraOpts);
    if (opts.length > 0) {
      return pad + 'await agent.aiScroll(' + locate + ', { ' + opts.join(', ') + ' });';
    }
    return pad + "await agent.aiScroll(undefined, { direction: 'down' });";
  }

  // --- aiDoubleClick ---
  if (step.aiDoubleClick !== undefined) {
    return generateLocatorAction('aiDoubleClick', step.aiDoubleClick, step, pad);
  }

  // --- aiRightClick ---
  if (step.aiRightClick !== undefined) {
    return generateLocatorAction('aiRightClick', step.aiRightClick, step, pad);
  }

  // --- aiDragAndDrop ---
  if (step.aiDragAndDrop !== undefined) {
    let from, to;
    if (typeof step.aiDragAndDrop === 'object' && step.aiDragAndDrop !== null) {
      from = toCodeString(resolveTemplate(step.aiDragAndDrop.from || ''));
      to = toCodeString(resolveTemplate(step.aiDragAndDrop.to || ''));
    } else {
      from = toCodeString(resolveTemplate(step.aiDragAndDrop));
      to = step.to ? toCodeString(resolveTemplate(step.to)) : "''";
    }
    return pad + 'await agent.aiDragAndDrop(' + from + ', ' + to + ');';
  }

  // --- aiClearInput ---
  if (step.aiClearInput !== undefined) {
    const prompt = toCodeString(resolveTemplate(step.aiClearInput));
    const opts = buildOptions(step);
    if (opts) {
      return pad + 'await agent.aiClearInput(' + prompt + ', ' + opts + ');';
    }
    return pad + 'await agent.aiClearInput(' + prompt + ');';
  }

  // --- aiLocate ---
  if (step.aiLocate !== undefined) {
    const prompt = toCodeString(resolveTemplate(
      typeof step.aiLocate === 'object' ? step.aiLocate.locator || '' : step.aiLocate
    ));
    const varName = sanitizeIdentifier(step.name || 'locateResult');
    varScope.add(varName);
    const opts = buildOptions(step);
    if (opts) {
      return pad + 'const ' + varName + ' = await agent.aiLocate(' + prompt + ', ' + opts + ');';
    }
    return pad + 'const ' + varName + ' = await agent.aiLocate(' + prompt + ');';
  }

  // --- aiBoolean ---
  if (step.aiBoolean !== undefined) {
    const prompt = toCodeString(resolveTemplate(step.aiBoolean));
    const varName = sanitizeIdentifier(step.name || 'boolResult');
    varScope.add(varName);
    const boolOpts = buildDataQueryOptions(step);
    if (boolOpts) {
      return pad + 'const ' + varName + ' = await agent.aiBoolean(' + prompt + ', ' + boolOpts + ');';
    }
    return pad + 'const ' + varName + ' = await agent.aiBoolean(' + prompt + ');';
  }

  // --- aiNumber ---
  if (step.aiNumber !== undefined) {
    const prompt = toCodeString(resolveTemplate(step.aiNumber));
    const varName = sanitizeIdentifier(step.name || 'numResult');
    varScope.add(varName);
    const numOpts = buildDataQueryOptions(step);
    if (numOpts) {
      return pad + 'const ' + varName + ' = await agent.aiNumber(' + prompt + ', ' + numOpts + ');';
    }
    return pad + 'const ' + varName + ' = await agent.aiNumber(' + prompt + ');';
  }

  // --- aiString ---
  if (step.aiString !== undefined) {
    const prompt = toCodeString(resolveTemplate(step.aiString));
    const varName = sanitizeIdentifier(step.name || 'strResult');
    varScope.add(varName);
    const strOpts = buildDataQueryOptions(step);
    if (strOpts) {
      return pad + 'const ' + varName + ' = await agent.aiString(' + prompt + ', ' + strOpts + ');';
    }
    return pad + 'const ' + varName + ' = await agent.aiString(' + prompt + ');';
  }

  // --- aiAsk ---
  // Official API: aiAsk(prompt, { domIncluded?, screenshotIncluded? })
  if (step.aiAsk !== undefined) {
    const prompt = toCodeString(resolveTemplate(
      typeof step.aiAsk === 'object' ? step.aiAsk.query || step.aiAsk.prompt || '' : step.aiAsk
    ));
    const varName = sanitizeIdentifier((typeof step.aiAsk === 'object' && step.aiAsk.name) || step.name || 'askResult');
    varScope.add(varName);
    const askOpts = buildDataQueryOptions(typeof step.aiAsk === 'object' ? step.aiAsk : step);
    if (askOpts) {
      return pad + 'const ' + varName + ' = await agent.aiAsk(' + prompt + ', ' + askOpts + ');';
    }
    return pad + 'const ' + varName + ' = await agent.aiAsk(' + prompt + ');';
  }

  // --- ai / aiAct (general action prompt) ---
  if (step.ai !== undefined) {
    const prompt = toCodeString(resolveTemplate(step.ai));
    const opts = buildOptions(step);
    if (opts) {
      return pad + 'await agent.aiAct(' + prompt + ', ' + opts + ');';
    }
    return pad + 'await agent.aiAct(' + prompt + ');';
  }

  if (step.aiAct !== undefined) {
    const prompt = toCodeString(resolveTemplate(step.aiAct));
    const opts = buildOptions(step);
    if (opts) {
      return pad + 'await agent.aiAct(' + prompt + ', ' + opts + ');';
    }
    return pad + 'await agent.aiAct(' + prompt + ');';
  }

  // --- Platform-specific actions ---

  // runAdbShell (Android)
  if (step.runAdbShell !== undefined) {
    const cmd = toCodeString(resolveTemplate(step.runAdbShell));
    return pad + 'await agent.runAdbShell(' + cmd + ');';
  }

  // runWdaRequest (iOS)
  if (step.runWdaRequest !== undefined) {
    if (typeof step.runWdaRequest === 'object' && step.runWdaRequest !== null) {
      return pad + 'await agent.runWdaRequest(' + JSON.stringify(step.runWdaRequest) + ');';
    }
    return pad + 'await agent.runWdaRequest(' + toCodeString(resolveTemplate(step.runWdaRequest)) + ');';
  }

  // freezePageContext / unfreezePageContext (dynamic page data consistency)
  if (step.freezePageContext !== undefined) {
    return pad + 'await agent.freezePageContext();';
  }
  if (step.unfreezePageContext !== undefined) {
    return pad + 'await agent.unfreezePageContext();';
  }

  // launch (Android/iOS app launch)
  if (step.launch !== undefined) {
    const appId = toCodeString(resolveTemplate(step.launch));
    return pad + 'await agent.launch(' + appId + ');';
  }

  // Fallback: unknown native action
  return pad + '// Unknown native action: ' + JSON.stringify(step);
}

module.exports = { generate };
