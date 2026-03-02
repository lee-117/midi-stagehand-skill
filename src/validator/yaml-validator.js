'use strict';

const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');

const { detect } = require('../detector/mode-detector');
const {
  looksLikeFilePath,
  getNestedFlow,
  getParallelBranches,
  getLoopItemVar,
  walkAllFlows,
  MAX_WALK_DEPTH,
} = require('../utils/yaml-helpers');
const { MAX_FILE_SIZE, MAX_IMPORT_DEPTH } = require('../constants');

// Load keyword schema once at module load time.
const extendedKeywords = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../../schema/extended-keywords.json'), 'utf8')
);

// Top-level extended feature keywords (the primary keys that trigger extended mode).
const EXTENDED_FEATURE_KEYS = new Set(
  Object.keys(extendedKeywords.features).reduce((acc, feature) => {
    // Only the first keyword in each feature is the "top-level" trigger keyword.
    acc.push(extendedKeywords.features[feature].keywords[0]);
    return acc;
  }, [])
);

// Valid platform config keys at root level.
const PLATFORM_KEYS = new Set(['web', 'android', 'ios', 'computer']);

// Valid loop types.
const LOOP_TYPES = new Set(['for', 'while', 'repeat']);

// Valid HTTP methods for external_call.
const VALID_HTTP_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']);

// Valid web platform config sub-fields.
const VALID_WEB_CONFIG_FIELDS = new Set([
  'url', 'headless', 'viewportWidth', 'viewportHeight', 'userAgent',
  'waitForNetworkIdle', 'acceptInsecureCerts', 'serve', 'bridgeMode',
  'chromeArgs', 'deviceScaleFactor', 'cookie', 'forceSameTabNavigation', 'output',
  'waitForNavigationTimeout', 'waitForNetworkIdleTimeout',
  'enableTouchEventsInActionSpace', 'forceChromeSelectRendering',
  'closeNewTabsAfterDisconnect', 'unstableLogContent', 'outputFormat',
]);

// Valid android platform config sub-fields.
const VALID_ANDROID_CONFIG_FIELDS = new Set([
  'deviceId', 'androidAdbPath', 'remoteAdbHost', 'remoteAdbPort',
  'screenshotResizeScale', 'alwaysRefreshScreenInfo',
]);

// Valid iOS platform config sub-fields.
const VALID_IOS_CONFIG_FIELDS = new Set([
  'wdaPort', 'wdaHost', 'autoDismissKeyboard', 'launch', 'output', 'unstableLogContent',
]);

// Valid computer platform config sub-fields.
const VALID_COMPUTER_CONFIG_FIELDS = new Set([
  'displayId', 'launch', 'output',
]);

// Valid agent config sub-fields.
const VALID_AGENT_CONFIG_FIELDS = new Set([
  'testId', 'groupName', 'groupDescription', 'cache',
  'generateReport', 'autoPrintReportMsg', 'reportFileName',
  'replanningCycleLimit', 'aiActContext',
  'screenshotShrinkFactor', 'waitAfterAction',
]);

// Valid cache strategy values.
const VALID_CACHE_STRATEGIES = new Set(['read-write', 'read-only', 'write-only']);

// Valid bridgeMode values.
const VALID_BRIDGE_MODES = new Set(['newTabWithUrl', 'currentTab']);

// Required fields per loop type.
const LOOP_REQUIRED_FIELDS = {
  for: ['items'],
  while: ['condition'],
  repeat: ['count'],
};

// Valid data_transform operations.
const VALID_OPERATIONS = ['filter', 'sort', 'map', 'reduce', 'unique', 'distinct', 'slice', 'flatten', 'groupBy'];

// Pattern for template variable references: ${varName} or ${varName.prop}
// Non-global — avoids stateful lastIndex issues. Use matchAll or new RegExp for
// iteration.
const TEMPLATE_VAR_PATTERN = /\$\{([^}]+)\}/;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Read YAML content - either from a file path or treat the input as a raw
 * YAML string.
 *
 * @param {string} yamlInput - File path or raw YAML string.
 * @returns {{ content: string, filePath: string | null }}
 */
function resolveContent(yamlInput) {
  if (looksLikeFilePath(yamlInput)) {
    const resolved = path.resolve(yamlInput);
    const stat = fs.statSync(resolved);
    if (stat.size > MAX_FILE_SIZE) {
      throw new Error('YAML file exceeds 1MB size limit (' + Math.round(stat.size / 1024) + 'KB). Consider splitting into smaller files using import.');
    }
    return {
      content: fs.readFileSync(resolved, 'utf8'),
      filePath: resolved,
    };
  }
  return { content: yamlInput, filePath: null };
}

/**
 * Create an error entry.
 */
function makeError(message, yamlPath) {
  return { level: 'error', message, path: yamlPath || '' };
}

/**
 * Create a warning entry.
 */
function makeWarning(message, yamlPath) {
  return { level: 'warning', message, path: yamlPath || '' };
}

// ---------------------------------------------------------------------------
// Level 1: Syntax validation
// ---------------------------------------------------------------------------

/**
 * Attempt to parse the YAML content. Returns the parsed document or pushes
 * a syntax error.
 *
 * @param {string} content - Raw YAML text.
 * @param {Array} errors - Error accumulator.
 * @returns {object | null} Parsed document, or null on failure.
 */
function validateSyntax(content, errors) {
  try {
    const doc = yaml.load(content, { maxAliases: 100 });
    return doc;
  } catch (err) {
    errors.push(makeError(
      `YAML syntax error: ${err.message}`,
      err.mark ? `line ${err.mark.line + 1}, column ${err.mark.column + 1}` : ''
    ));
    return null;
  }
}

// ---------------------------------------------------------------------------
// Level 2: Structure validation
// ---------------------------------------------------------------------------

/**
 * Validate that the document has the required top-level structure.
 *
 * @param {object} doc - Parsed YAML document.
 * @param {Array} errors - Error accumulator.
 * @param {Array} warnings - Warning accumulator.
 */
function validateStructure(doc, errors, warnings) {
  if (doc === null || doc === undefined || typeof doc !== 'object' || Array.isArray(doc)) {
    errors.push(makeError(
      'Document root must be a YAML mapping (object), not a scalar or array.',
      '/'
    ));
    return;
  }

  // Validate engine field if present.
  if (doc.engine !== undefined) {
    const engineVal = String(doc.engine).toLowerCase();
    if (engineVal !== 'native' && engineVal !== 'extended') {
      warnings.push(makeWarning(
        'Unknown engine value "' + doc.engine + '". Valid values are "native" or "extended".',
        '/engine'
      ));
    }
  }

  // Check for at least one platform config key.
  const rootKeys = Object.keys(doc);
  const hasPlatform = rootKeys.some((key) => PLATFORM_KEYS.has(key));
  if (!hasPlatform) {
    errors.push(makeError(
      'Document must contain at least one platform config key at root level: web, android, ios, or computer. Example: web:\n  url: "https://example.com"',
      '/'
    ));
  }

  // Validate web config sub-fields if present.
  if (doc.web && typeof doc.web === 'object' && !Array.isArray(doc.web)) {
    for (const key of Object.keys(doc.web)) {
      if (!VALID_WEB_CONFIG_FIELDS.has(key)) {
        warnings.push(makeWarning(
          `Unknown web config field "${key}". Known fields: ${[...VALID_WEB_CONFIG_FIELDS].join(', ')}.`,
          `/web/${key}`
        ));
      }
    }
  }

  // Validate agent config sub-fields if present.
  if (doc.agent && typeof doc.agent === 'object' && !Array.isArray(doc.agent)) {
    for (const key of Object.keys(doc.agent)) {
      if (!VALID_AGENT_CONFIG_FIELDS.has(key)) {
        warnings.push(makeWarning(
          `Unknown agent config field "${key}". Known fields: ${[...VALID_AGENT_CONFIG_FIELDS].join(', ')}.`,
          `/agent/${key}`
        ));
      }
    }

    // Validate cache object format if present.
    const cache = doc.agent.cache;
    if (cache !== undefined && typeof cache === 'object' && cache !== null) {
      if (cache.strategy !== undefined && !VALID_CACHE_STRATEGIES.has(cache.strategy)) {
        warnings.push(makeWarning(
          `Invalid cache strategy "${cache.strategy}". Valid values: ${[...VALID_CACHE_STRATEGIES].join(', ')}.`,
          '/agent/cache/strategy'
        ));
      }
      // cache.id is required when strategy is present (official API requirement).
      if (cache.strategy !== undefined && cache.id === undefined) {
        warnings.push(makeWarning(
          'Cache "strategy" is set but "id" is missing. The official API requires cache.id when strategy is specified.',
          '/agent/cache/id'
        ));
      }
    }
  }

  // Validate bridgeMode in web config if present.
  if (doc.web && typeof doc.web === 'object' && doc.web.bridgeMode !== undefined) {
    const bm = doc.web.bridgeMode;
    if (bm !== false && !VALID_BRIDGE_MODES.has(bm)) {
      warnings.push(makeWarning(
        `Invalid bridgeMode "${bm}". Valid values: false, ${[...VALID_BRIDGE_MODES].join(', ')}.`,
        '/web/bridgeMode'
      ));
    }
  }

  // Validate android config sub-fields if present.
  if (doc.android && typeof doc.android === 'object' && !Array.isArray(doc.android)) {
    for (const key of Object.keys(doc.android)) {
      if (!VALID_ANDROID_CONFIG_FIELDS.has(key)) {
        warnings.push(makeWarning(
          `Unknown android config field "${key}". Known fields: ${[...VALID_ANDROID_CONFIG_FIELDS].join(', ')}.`,
          `/android/${key}`
        ));
      }
    }
  }

  // Validate iOS config sub-fields if present.
  if (doc.ios && typeof doc.ios === 'object' && !Array.isArray(doc.ios)) {
    for (const key of Object.keys(doc.ios)) {
      if (!VALID_IOS_CONFIG_FIELDS.has(key)) {
        warnings.push(makeWarning(
          `Unknown ios config field "${key}". Known fields: ${[...VALID_IOS_CONFIG_FIELDS].join(', ')}.`,
          `/ios/${key}`
        ));
      }
    }
  }

  // Validate computer config sub-fields if present.
  if (doc.computer && typeof doc.computer === 'object' && !Array.isArray(doc.computer)) {
    for (const key of Object.keys(doc.computer)) {
      if (!VALID_COMPUTER_CONFIG_FIELDS.has(key)) {
        warnings.push(makeWarning(
          `Unknown computer config field "${key}". Known fields: ${[...VALID_COMPUTER_CONFIG_FIELDS].join(', ')}.`,
          `/computer/${key}`
        ));
      }
    }
  }

  // Check for tasks array.
  if (!doc.tasks) {
    errors.push(makeError(
      'Document must contain a "tasks" array at root level. Example: tasks:\n  - name: "my task"\n    flow:\n      - aiTap: "button"',
      '/tasks'
    ));
    return; // Cannot validate individual tasks if there is no tasks key.
  }

  if (!Array.isArray(doc.tasks)) {
    errors.push(makeError(
      '"tasks" must be an array.',
      '/tasks'
    ));
    return;
  }

  if (doc.tasks.length === 0) {
    errors.push(makeError(
      '"tasks" array must not be empty.',
      '/tasks'
    ));
    return;
  }

  // Validate each task.
  doc.tasks.forEach((task, index) => {
    const taskPath = `/tasks[${index}]`;

    if (task === null || task === undefined || typeof task !== 'object' || Array.isArray(task)) {
      errors.push(makeError(
        `Each task must be an object.`,
        taskPath
      ));
      return;
    }

    if (typeof task.name !== 'string' || task.name.trim() === '') {
      errors.push(makeError(
        `Task must have a "name" property of type string.`,
        `${taskPath}/name`
      ));
    }

    const taskFlow = getNestedFlow(task);
    if (!Array.isArray(taskFlow)) {
      errors.push(makeError(
        `Task must have a "flow" (or "steps") property of type array.`,
        `${taskPath}/flow`
      ));
    }
  });

  // Warn on duplicate task names.
  const taskNames = new Map();
  doc.tasks.forEach((task, index) => {
    if (task && typeof task === 'object' && typeof task.name === 'string') {
      const name = task.name.trim();
      if (taskNames.has(name)) {
        warnings.push(makeWarning(
          `Duplicate task name "${name}" (also at index ${taskNames.get(name)}). Consider using unique names for clarity.`,
          `/tasks[${index}]/name`
        ));
      } else {
        taskNames.set(name, index);
      }
    }
  });
}

// ---------------------------------------------------------------------------
// Level 3: Mode-aware validation
// ---------------------------------------------------------------------------

/**
 * Recursively collect all keys used in the document.
 *
 * @param {*} node - Current node.
 * @param {string} currentPath - JSON-pointer-like path for diagnostics.
 * @param {Array<{ key: string, path: string }>} result - Accumulator.
 */
function collectKeys(node, currentPath, result, _depth) {
  if (_depth === undefined) _depth = 0;
  if (_depth >= MAX_WALK_DEPTH) return;
  if (node === null || node === undefined || typeof node !== 'object') {
    return;
  }

  if (Array.isArray(node)) {
    node.forEach((item, i) => {
      collectKeys(item, `${currentPath}[${i}]`, result, _depth + 1);
    });
    return;
  }

  for (const key of Object.keys(node)) {
    result.push({ key, path: `${currentPath}/${key}` });
    collectKeys(node[key], `${currentPath}/${key}`, result, _depth + 1);
  }
}

/**
 * Perform native-mode validation: warn if extended keywords are present.
 *
 * @param {Array<{ key: string, path: string }>} allKeys
 * @param {Array} warnings
 */
function validateNativeMode(allKeys, warnings) {
  for (const entry of allKeys) {
    if (EXTENDED_FEATURE_KEYS.has(entry.key)) {
      warnings.push(makeWarning(
        `Extended keyword "${entry.key}" found in native mode. ` +
        `Consider switching to extended mode or removing this construct.`,
        entry.path
      ));
    }
  }
}

/**
 * Perform extended-mode validation: check that extended constructs are
 * well-formed.
 *
 * @param {object} doc - Parsed document.
 * @param {string} rawContent - Raw YAML content string (avoids re-serialization).
 * @param {Array} errors - Error accumulator.
 * @param {Array} warnings - Warning accumulator.
 */
function validateExtendedMode(doc, rawContent, errors, warnings) {
  // Check that features declaration exists and matches actual usage.
  validateFeaturesDeclaration(doc, rawContent, warnings);

  // Walk every flow in every task and validate extended constructs.
  // walkAllFlows handles recursion into nested constructs automatically,
  // so validateExtendedStep no longer needs to recurse on its own.
  walkAllFlows(doc, function (step, stepPath) {
    validateExtendedStep(step, stepPath, errors, warnings);
    validateCommonStepValues(step, stepPath, warnings);
  });
}

/**
 * Validate that the `features` declaration in an extended mode document
 * exists and is consistent with the features actually used.
 *
 * @param {object} doc - Parsed document.
 * @param {string} rawContent - Raw YAML content string (avoids JSON.stringify re-serialization).
 * @param {Array} warnings - Warning accumulator.
 */
function validateFeaturesDeclaration(doc, rawContent, warnings) {
  // Detect actually used features by scanning keywords.
  const detection = detect(rawContent);
  const usedFeatures = new Set(detection.features);

  const declaredFeatures = doc.features;

  // Check if features declaration is missing.
  if (!declaredFeatures) {
    if (usedFeatures.size > 0) {
      warnings.push(makeWarning(
        'Extended mode document is missing "features" declaration. ' +
        'Detected features: [' + Array.from(usedFeatures).join(', ') + ']. ' +
        'Add: features: [' + Array.from(usedFeatures).join(', ') + ']',
        '/features'
      ));
    }
    return;
  }

  if (!Array.isArray(declaredFeatures)) {
    warnings.push(makeWarning(
      '"features" should be an array of feature names.',
      '/features'
    ));
    return;
  }

  const declaredSet = new Set(declaredFeatures);

  // Check for used but undeclared features.
  for (const feature of usedFeatures) {
    if (!declaredSet.has(feature)) {
      warnings.push(makeWarning(
        'Feature "' + feature + '" is used in the document but not declared in "features" array.',
        '/features'
      ));
    }
  }

  // Check for declared but unused features.
  for (const feature of declaredSet) {
    if (!usedFeatures.has(feature)) {
      warnings.push(makeWarning(
        'Feature "' + feature + '" is declared in "features" but does not appear to be used.',
        '/features'
      ));
    }
  }
}

/**
 * Validate a single flow step for extended construct correctness.
 * Recurses into nested flows (e.g. inside logic.then, logic.else, try.flow, etc.).
 *
 * @param {*} step
 * @param {string} stepPath
 * @param {Array} errors
 * @param {Array} warnings
 */
function validateExtendedStep(step, stepPath, errors, warnings) {
  if (step === null || step === undefined || typeof step !== 'object' || Array.isArray(step)) {
    return;
  }

  for (const [key, validator] of EXTENDED_STEP_VALIDATORS) {
    if (step[key] !== undefined) {
      validator(step, stepPath, errors, warnings);
    }
  }
}

// ---------------------------------------------------------------------------
// Per-construct validators (dispatched from validateExtendedStep)
// ---------------------------------------------------------------------------

function validateLogicStep(step, stepPath, errors) {
  const logic = step.logic;
  const logicPath = `${stepPath}/logic`;

  if (logic === null || typeof logic !== 'object' || Array.isArray(logic)) {
    errors.push(makeError('"logic" must be an object.', logicPath));
    return;
  }
  if (logic.if === undefined) {
    errors.push(makeError('"logic" construct must have an "if" condition.', `${logicPath}/if`));
  }
  if (logic.then === undefined) {
    errors.push(makeError('"logic" construct must have a "then" branch.', `${logicPath}/then`));
  }
}

function validateLoopStep(step, stepPath, errors, warnings) {
  const loop = step.loop;
  const loopPath = `${stepPath}/loop`;

  if (loop === null || typeof loop !== 'object' || Array.isArray(loop)) {
    errors.push(makeError('"loop" must be an object.', loopPath));
    return;
  }

  if (!loop.type) {
    errors.push(makeError('"loop" construct must have a "type". Valid types: for (iterate items), while (condition-based), repeat (fixed count). Add: type: for', `${loopPath}/type`));
  } else if (!LOOP_TYPES.has(loop.type)) {
    errors.push(makeError(
      `Invalid loop type "${loop.type}". Must be one of: for, while, repeat.`,
      `${loopPath}/type`
    ));
  } else {
    const required = LOOP_REQUIRED_FIELDS[loop.type] || [];
    for (const field of required) {
      // For repeat loops, accept `times` as alias for `count`
      const satisfied = loop[field] !== undefined ||
        (field === 'count' && loop.times !== undefined);
      if (!satisfied) {
        errors.push(makeError(
          `Loop of type "${loop.type}" requires a "${field}" field.`,
          `${loopPath}/${field}`
        ));
      }
    }

    // Warn on non-positive count for repeat loops (count or times alias).
    if (loop.type === 'repeat') {
      const countVal = loop.count !== undefined ? loop.count : loop.times;
      if (countVal !== undefined) {
        const c = typeof countVal === 'number' ? countVal : Number(countVal);
        if (typeof countVal === 'number' && (c <= 0 || !Number.isFinite(c))) {
          warnings.push(makeWarning(
            `Loop count ${countVal} is invalid. Must be a positive number.`,
            `${loopPath}/count`
          ));
        } else if (typeof countVal === 'number' && c > 10000) {
          warnings.push(makeWarning(
            `Loop count ${countVal} is very high. Consider reducing it or using a while loop with maxIterations.`,
            `${loopPath}/count`
          ));
        }
      }
    }

    // Warn on non-positive maxIterations.
    if (loop.maxIterations !== undefined) {
      const m = loop.maxIterations;
      if (typeof m === 'number' && (m <= 0 || !Number.isFinite(m))) {
        warnings.push(makeWarning(
          `Loop maxIterations ${m} is invalid. Must be a positive number.`,
          `${loopPath}/maxIterations`
        ));
      } else if (typeof m === 'number' && m > 10000) {
        warnings.push(makeWarning(
          `Loop maxIterations ${m} is very high. Consider a lower limit to prevent excessive resource usage.`,
          `${loopPath}/maxIterations`
        ));
      }
    }

    // Warn if while loop has no maxIterations (safety best practice).
    if (loop.type === 'while' && loop.maxIterations === undefined) {
      warnings.push(makeWarning(
        'While loop has no "maxIterations" safety limit. Consider adding one to prevent infinite loops.',
        `${loopPath}/maxIterations`
      ));
    }
  }

  const loopFlow = getNestedFlow(loop);
  if (Array.isArray(loopFlow)) {
    if (loopFlow.length === 0) {
      warnings.push(makeWarning('"loop" has an empty flow/steps array.', `${loopPath}/flow`));
    }
  } else if (!loopFlow) {
    warnings.push(makeWarning('"loop" is missing a "flow" or "steps" array.', `${loopPath}/flow`));
  }
}

function validateTryStep(step, stepPath, errors) {
  const tryBlock = step.try;
  const tryPath = `${stepPath}/try`;

  if (tryBlock === null || typeof tryBlock !== 'object' || Array.isArray(tryBlock)) {
    errors.push(makeError('"try" must be an object with a "flow" array.', tryPath));
    return;
  }
  const tryFlow = getNestedFlow(tryBlock);
  if (!Array.isArray(tryFlow)) {
    errors.push(makeError('"try" construct must have a "flow" (or "steps") array.', `${tryPath}/flow`));
  }

  // Warn if try has neither catch nor finally
  if (!step.catch && !step.finally) {
    errors.push(makeError('"try" must have a "catch" or "finally" block (or both). A bare try block is invalid JavaScript.', stepPath));
  }

  // Validate catch block structure (sibling of try)
  if (step.catch && typeof step.catch === 'object') {
    const catchFlow = getNestedFlow(step.catch);
    if (!Array.isArray(catchFlow)) {
      errors.push(makeError('"catch" must have a "flow" (or "steps") array.', `${stepPath}/catch/flow`));
    }
  }

  // Validate finally block structure (sibling of try)
  if (step.finally && typeof step.finally === 'object') {
    const finallyFlow = getNestedFlow(step.finally);
    if (!Array.isArray(finallyFlow)) {
      errors.push(makeError('"finally" must have a "flow" (or "steps") array.', `${stepPath}/finally/flow`));
    }
  }
}

function validateExternalCallStep(step, stepPath, errors, warnings) {
  const call = step.external_call;
  const callPath = `${stepPath}/external_call`;

  if (call === null || typeof call !== 'object' || Array.isArray(call)) {
    errors.push(makeError('"external_call" must be an object.', callPath));
    return;
  }

  if (!call.type) {
    errors.push(makeError('"external_call" must have a "type" (http or shell). Use "http" for API calls or "shell" for system commands.', `${callPath}/type`));
  } else if (call.type !== 'http' && call.type !== 'shell') {
    errors.push(makeError(`Invalid external_call type "${call.type}". Must be "http" or "shell".`, `${callPath}/type`));
  } else if (call.type === 'http' && !call.url) {
    errors.push(makeError('"external_call" of type "http" must have a "url" field.', `${callPath}/url`));
  } else if (call.type === 'shell' && !call.command) {
    errors.push(makeError('"external_call" of type "shell" must have a "command" field.', `${callPath}/command`));
  }

  // Validate HTTP method if present.
  if (call.type === 'http' && call.method) {
    const method = String(call.method).toUpperCase();
    if (!VALID_HTTP_METHODS.has(method)) {
      warnings.push(makeWarning(
        `Unknown HTTP method "${call.method}". Expected one of: ${[...VALID_HTTP_METHODS].join(', ')}.`,
        `${callPath}/method`
      ));
    }
  }

  // A3: Shell command injection warning
  if (call.type === 'shell' && typeof call.command === 'string' && TEMPLATE_VAR_PATTERN.test(call.command)) {
    warnings.push(makeWarning(
      `Shell command contains template variables (${call.command}). User-controlled input in shell commands may lead to command injection.`,
      `${callPath}/command`
    ));
  }
}

function validateTimeoutStep(step, stepPath, _errors, warnings) {
  const t = step.timeout;
  if (typeof t === 'number' && (t <= 0 || !Number.isFinite(t))) {
    warnings.push(makeWarning(
      `Timeout value ${t} is invalid. Must be a positive number (milliseconds).`,
      `${stepPath}/timeout`
    ));
  }
}

function validateParallelStep(step, stepPath, errors) {
  const par = step.parallel;
  const parPath = `${stepPath}/parallel`;

  if (par === null || typeof par !== 'object' || Array.isArray(par)) {
    errors.push(makeError('"parallel" must be an object.', parPath));
    return;
  }
  const parTasks = getParallelBranches(par);
  if (!Array.isArray(parTasks)) {
    errors.push(makeError('"parallel" construct must have a "tasks" or "branches" array.', `${parPath}/tasks`));
  }
}

function validateUseStep(step, stepPath, errors) {
  const useRef = step.use;
  const usePath = `${stepPath}/use`;

  if (typeof useRef !== 'string' || useRef.trim() === '') {
    errors.push(makeError('"use" must be a non-empty string (flow reference or path).', usePath));
  }
  if (step.with !== undefined && (step.with === null || typeof step.with !== 'object' || Array.isArray(step.with))) {
    errors.push(makeError('"with" must be an object mapping parameter names to values.', `${stepPath}/with`));
  }
}

function validateDataTransformStep(step, stepPath, errors, warnings) {
  const transform = step.data_transform;
  const transformPath = `${stepPath}/data_transform`;

  if (transform === null || typeof transform !== 'object' || Array.isArray(transform)) {
    errors.push(makeError('"data_transform" must be an object.', transformPath));
    return;
  }

  if (transform.operation) {
    if (!VALID_OPERATIONS.includes(transform.operation)) {
      errors.push(makeError(
        'Invalid data_transform operation "' + transform.operation + '". Must be one of: ' + VALID_OPERATIONS.join(', ') + '.',
        `${transformPath}/operation`
      ));
    }
    if (!transform.source) {
      warnings.push(makeWarning('"data_transform" with "operation" should have a "source" field.', `${transformPath}/source`));
    }
  }

  if (transform.operations && !Array.isArray(transform.operations)) {
    errors.push(makeError('"data_transform.operations" must be an array.', `${transformPath}/operations`));
  }

  // Security: warn on suspicious JS patterns in condition/reducer expressions
  const SUSPICIOUS_JS = /\b(require|import|eval|Function|execSync|exec|spawn)\s*\(/;
  const exprFields = ['condition', 'reducer', 'template'];
  for (const field of exprFields) {
    const val = transform[field];
    if (typeof val === 'string' && SUSPICIOUS_JS.test(val)) {
      warnings.push(makeWarning(
        `data_transform "${field}" contains potentially dangerous code pattern. Avoid using require/eval/exec in expressions.`,
        `${transformPath}/${field}`
      ));
    }
  }
}

/**
 * Dispatch table mapping step keys to their validators.
 * Order matches the original validateExtendedStep evaluation order.
 */
const EXTENDED_STEP_VALIDATORS = [
  ['logic', validateLogicStep],
  ['loop', validateLoopStep],
  ['try', validateTryStep],
  ['external_call', validateExternalCallStep],
  ['timeout', validateTimeoutStep],
  ['parallel', validateParallelStep],
  ['use', validateUseStep],
  ['data_transform', validateDataTransformStep],
];

// ---------------------------------------------------------------------------
// Level 3b: Native action format validation
// ---------------------------------------------------------------------------

/**
 * Actions whose primary value should be a plain string in native CLI mode.
 * When these are given as an object with specific sub-keys, the Midscene CLI
 * may not parse them correctly (the sub-key values become undefined).
 *
 * Map: actionKeyword -> sub-key that signals the incorrect nested format.
 */
const NATIVE_FLAT_ACTIONS = {
  aiWaitFor: 'condition',
  aiInput: 'locator',
  aiTap: 'locator',
  aiHover: 'locator',
  aiAssert: 'assertion',
  aiScroll: 'locator',
};

/**
 * Walk all flow steps in native mode and warn when an action uses the nested
 * object format instead of the required flat/sibling format.
 *
 * Example of problematic pattern:
 *   - aiWaitFor:
 *       condition: "..."   <-- CLI reads this as undefined
 *       timeout: 10000
 *
 * Correct pattern:
 *   - aiWaitFor: "..."
 *     timeout: 10000
 *
 * Also warns when `recordToReport` is used without a title value (standalone).
 *
 * @param {object} doc - Parsed document.
 * @param {Array} warnings - Warning accumulator.
 */
function validateNativeActionFormats(doc, warnings) {
  walkAllFlows(doc, function (step, stepPath) {
    // Check flat-action keywords for incorrect nested object format.
    for (const [action, nestedKey] of Object.entries(NATIVE_FLAT_ACTIONS)) {
      if (step[action] !== undefined && typeof step[action] === 'object' && step[action] !== null) {
        if (step[action][nestedKey] !== undefined) {
          warnings.push(makeWarning(
            `"${action}" uses nested object format with "${nestedKey}" sub-key. ` +
            `In native CLI mode this may cause undefined errors. ` +
            `Use flat format instead: ${action}: "value" with options as sibling keys.`,
            `${stepPath}/${action}`
          ));
        }
      }
    }

    // Check standalone recordToReport (no title value).
    if (step.recordToReport === true || step.recordToReport === null) {
      warnings.push(makeWarning(
        '"recordToReport" is used without a title value. ' +
        'Use: recordToReport: "title" with optional content as sibling key.',
        `${stepPath}/recordToReport`
      ));
    }

    // Common step-level value checks (sleep, timeout).
    validateCommonStepValues(step, stepPath, warnings);
  });
}

// ---------------------------------------------------------------------------
// Common step-level value validation (shared by native and extended modes)
// ---------------------------------------------------------------------------

/**
 * Validate step-level values that are common across modes (sleep, timeout).
 */
function validateCommonStepValues(step, stepPath, warnings) {
  // Validate sleep values.
  if (step.sleep !== undefined) {
    const s = step.sleep;
    if (typeof s === 'number' && (s < 0 || !Number.isFinite(s))) {
      warnings.push(makeWarning(
        `Sleep value ${s} is invalid. Must be a non-negative number (milliseconds).`,
        `${stepPath}/sleep`
      ));
    } else if (typeof s === 'string' && !/^\$\{/.test(s) && isNaN(Number(s))) {
      warnings.push(makeWarning(
        `Sleep value "${s}" is not a valid number or template variable.`,
        `${stepPath}/sleep`
      ));
    }
  }

  // Validate timeout values.
  if (step.timeout !== undefined) {
    const t = step.timeout;
    if (typeof t === 'number' && (t <= 0 || !Number.isFinite(t))) {
      warnings.push(makeWarning(
        `Timeout value ${t} is invalid. Must be a positive number (milliseconds).`,
        `${stepPath}/timeout`
      ));
    }
  }
}

// ---------------------------------------------------------------------------
// Level 4: Semantic validation
// ---------------------------------------------------------------------------

/**
 * Collect all variable names that are defined within the document flows.
 * A variable is considered "defined" if it appears in:
 *   - A `variables` step (each key in the variables mapping).
 *   - An `aiQuery` step with a `name` property (the name becomes the variable).
 *   - An `import` step with an `as` property.
 *
 * @param {object} doc - Parsed document.
 * @returns {Set<string>} Set of defined variable names.
 */
function collectDefinedVariables(doc) {
  const defined = new Set();

  // Top-level variables block
  if (doc.variables && typeof doc.variables === 'object' && !Array.isArray(doc.variables)) {
    for (const varName of Object.keys(doc.variables)) {
      defined.add(varName);
    }
  }

  // Top-level import block
  if (doc.import && Array.isArray(doc.import)) {
    for (const imp of doc.import) {
      if (imp.as && typeof imp.as === 'string') {
        defined.add(imp.as);
      }
    }
  }

  // Walk all flow steps to collect defined variables.
  walkAllFlows(doc, function (step) {
    // variables step: each key becomes a defined variable.
    if (step.variables && typeof step.variables === 'object' && !Array.isArray(step.variables)) {
      for (const varName of Object.keys(step.variables)) {
        defined.add(varName);
      }
    }

    // aiQuery with name: the name becomes a defined variable.
    if (step.aiQuery && typeof step.aiQuery === 'object' && typeof step.aiQuery.name === 'string') {
      defined.add(step.aiQuery.name);
    }
    // Also support shorthand where aiQuery is a string but a sibling "name" key holds the variable.
    if (step.aiQuery !== undefined && typeof step.name === 'string') {
      defined.add(step.name);
    }

    // import with as: the alias becomes a defined variable.
    if (step.import !== undefined && typeof step.as === 'string') {
      defined.add(step.as);
    }

    // external_call with response_as/as/name: the variable becomes defined.
    if (step.external_call && typeof step.external_call === 'object') {
      const ecVar = step.external_call.response_as || step.external_call.as || step.external_call.name;
      if (typeof ecVar === 'string') {
        defined.add(ecVar);
      }
    }

    // data_transform with output/name: the variable becomes defined.
    if (step.data_transform && typeof step.data_transform === 'object') {
      const dtVar = step.data_transform.output || step.data_transform.name;
      if (typeof dtVar === 'string') {
        defined.add(dtVar);
      }
    }

    // The loop "as"/"itemVar"/"item" variable is a defined variable within the loop.
    if (step.loop && typeof step.loop === 'object') {
      const loopVar = getLoopItemVar(step.loop);
      if (typeof loopVar === 'string') {
        defined.add(loopVar);
      }
    }
  });

  return defined;
}

/**
 * Collect all ${...} template variable references found in string values
 * throughout the document.
 *
 * @param {*} node - Current node.
 * @param {string} currentPath - Path for diagnostics.
 * @param {Array<{ varName: string, path: string }>} result - Accumulator.
 */
function collectVariableReferences(node, currentPath, result, _depth) {
  if (_depth === undefined) _depth = 0;
  if (_depth >= MAX_WALK_DEPTH) return;
  if (node === null || node === undefined) {
    return;
  }

  if (typeof node === 'string') {
    // Use matchAll with a fresh global regex to avoid stateful lastIndex issues.
    for (const match of node.matchAll(new RegExp(TEMPLATE_VAR_PATTERN, 'g'))) {
      // Extract the root variable name (before any dots or brackets).
      const fullRef = match[1];
      const rootVar = fullRef.split('.')[0].split('[')[0].trim();
      result.push({ varName: rootVar, path: currentPath });
    }
    return;
  }

  if (Array.isArray(node)) {
    node.forEach((item, i) => {
      collectVariableReferences(item, `${currentPath}[${i}]`, result, _depth + 1);
    });
    return;
  }

  if (typeof node === 'object') {
    for (const key of Object.keys(node)) {
      collectVariableReferences(node[key], `${currentPath}/${key}`, result, _depth + 1);
    }
  }
}

/**
 * Check that all ${...} variable references resolve to a variable that is
 * defined somewhere in the document.
 *
 * @param {object} doc - Parsed document.
 * @param {Array} warnings - Warning accumulator.
 */
function validateVariableReferences(doc, warnings) {
  const defined = collectDefinedVariables(doc);
  const references = [];
  collectVariableReferences(doc, '', references);

  for (const ref of references) {
    // Skip environment variable references — they are resolved at runtime.
    if (/^ENV[:.]/i.test(ref.varName) || ref.varName === 'process') {
      continue;
    }
    if (!defined.has(ref.varName)) {
      warnings.push(makeWarning(
        `Variable "\${${ref.varName}}" is referenced but does not appear to be defined ` +
        `in a prior "variables" step, "aiQuery" name, or "import" alias.`,
        ref.path
      ));
    }
  }
}

/**
 * Recursively follow import chains to detect circular imports.
 *
 * @param {string} filePath - Resolved path of the YAML file to inspect.
 * @param {Array} warnings - Warning accumulator.
 * @param {Array} errors - Error accumulator.
 * @param {Set<string>} visitedPaths - Set of already-visited resolved paths.
 */
function validateImportChain(filePath, warnings, errors, visitedPaths) {
  if (visitedPaths.size >= MAX_IMPORT_DEPTH) {
    warnings.push(makeWarning(
      `Import chain exceeds maximum depth of ${MAX_IMPORT_DEPTH}. Stopping further traversal.`,
      filePath
    ));
    return;
  }

  let content;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch {
    return; // File unreadable — already reported by validateImportPaths
  }

  let doc;
  try {
    doc = yaml.load(content);
  } catch {
    return; // Parse error — not our concern here
  }

  if (!doc || typeof doc !== 'object') return;

  // Collect import paths from all flows
  const importPaths = [];
  const baseDir = path.dirname(filePath);

  if (doc.tasks && Array.isArray(doc.tasks)) {
    walkAllFlows(doc, function (step) {
      if (step.import !== undefined && typeof step.import === 'string') {
        if (!TEMPLATE_VAR_PATTERN.test(step.import)) {
          importPaths.push(step.import);
        }
      }
    });
  }

  // Also check top-level import block
  if (doc.import && Array.isArray(doc.import)) {
    for (const imp of doc.import) {
      if (imp.flow && typeof imp.flow === 'string' && !TEMPLATE_VAR_PATTERN.test(imp.flow)) {
        importPaths.push(imp.flow);
      }
    }
  }

  for (const importPath of importPaths) {
    const resolved = path.resolve(baseDir, importPath);
    // On Windows, paths are case-insensitive; normalise to lowercase for comparison.
    const normalizedResolved = process.platform === 'win32'
      ? path.normalize(resolved).toLowerCase()
      : path.normalize(resolved);

    if (visitedPaths.has(normalizedResolved)) {
      errors.push(makeError(
        `Circular import detected: "${importPath}" (resolved to "${resolved}") creates a cycle.`,
        filePath
      ));
      continue;
    }

    const ext = path.extname(resolved).toLowerCase();
    if ((ext === '.yaml' || ext === '.yml') && fs.existsSync(resolved)) {
      const newVisited = new Set(visitedPaths);
      newVisited.add(normalizedResolved);  // already case-normalised above
      validateImportChain(resolved, warnings, errors, newVisited);
    }
  }
}

/**
 * Collect all import paths from the document and check that the referenced
 * files exist on disk.
 *
 * @param {object} doc - Parsed document.
 * @param {string} basePath - Base directory for resolving relative paths.
 * @param {Array} warnings - Warning accumulator.
 * @param {Array} errors - Error accumulator.
 */
function validateImportPaths(doc, basePath, warnings, errors) {
  const imports = [];

  // Collect from top-level `import` block (flow, data, js/json imports)
  if (doc.import && Array.isArray(doc.import)) {
    for (let idx = 0; idx < doc.import.length; idx++) {
      const imp = doc.import[idx];
      const importPath = imp.flow || imp.data || imp.file;
      if (importPath && typeof importPath === 'string') {
        imports.push({
          importPath: importPath,
          path: `import[${idx}]/${imp.flow ? 'flow' : imp.data ? 'data' : 'file'}`,
        });
      }
    }
  }

  // Walk all flow steps to collect import paths.
  walkAllFlows(doc, function (step, stepPath) {
    if (step.import !== undefined && typeof step.import === 'string') {
      imports.push({
        importPath: step.import,
        path: stepPath + '/import',
      });
    }
  });

  for (const entry of imports) {
    const importPath = entry.importPath;

    // Skip if the path looks like a template variable.
    if (TEMPLATE_VAR_PATTERN.test(importPath)) {
      continue;
    }

    const resolved = path.resolve(basePath, importPath);

    // A2: Path traversal protection — warn if resolved path escapes project dir
    const normalizedBase = path.normalize(basePath) + path.sep;
    const normalizedResolved = path.normalize(resolved);
    if (!normalizedResolved.startsWith(normalizedBase) && normalizedResolved !== path.normalize(basePath)) {
      warnings.push(makeWarning(
        `Import path "${importPath}" resolves outside the project directory. This may be a security risk.`,
        entry.path
      ));
    }

    if (!fs.existsSync(resolved)) {
      warnings.push(makeWarning(
        `Import path "${importPath}" does not exist (resolved to "${resolved}").`,
        entry.path
      ));
    } else {
      // A4: Circular import detection for existing YAML files
      const ext = path.extname(resolved).toLowerCase();
      if (ext === '.yaml' || ext === '.yml') {
        const normFn = process.platform === 'win32' ? (p) => path.normalize(p).toLowerCase() : path.normalize;
        const visitedPaths = new Set([normFn(basePath)]);
        visitedPaths.add(normFn(resolved));
        validateImportChain(resolved, warnings, errors, visitedPaths);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Validate a Midscene YAML Superset document through four levels:
 *   1. Syntax validation (can the YAML be parsed?)
 *   2. Structure validation (required top-level keys and task shape)
 *   3. Mode-aware validation (native keyword warnings or extended construct checks)
 *   4. Semantic validation (variable references and import paths)
 *
 * @param {string} yamlInput - A file path (`.yaml`/`.yml`) or raw YAML string.
 * @param {object} [options] - Optional configuration.
 * @param {string} [options.basePath] - Base directory for resolving import paths
 *   (defaults to the YAML file's directory or CWD).
 * @param {'native'|'extended'} [options.mode] - Force a specific validation mode
 *   instead of auto-detecting.
 * @returns {{ valid: boolean, errors: Array<{level: string, message: string, path: string}>, warnings: Array<{level: string, message: string, path: string}> }}
 */
function validate(yamlInput, options) {
  const opts = options || {};
  const errors = [];
  const warnings = [];

  // ------------------------------------------------------------------
  // 0. Input guard
  // ------------------------------------------------------------------
  if (typeof yamlInput !== 'string' || yamlInput.trim() === '') {
    errors.push(makeError('Input must be a non-empty string (file path or YAML content).', ''));
    return { valid: false, errors, warnings };
  }

  // ------------------------------------------------------------------
  // Resolve raw content and determine the file path (if any).
  // ------------------------------------------------------------------
  let content;
  let filePath;
  try {
    const resolved = resolveContent(yamlInput);
    content = resolved.content;
    filePath = resolved.filePath;
  } catch (err) {
    errors.push(makeError(`Unable to read input: ${err.message}`, ''));
    return { valid: false, errors, warnings };
  }

  // Determine basePath for import resolution.
  const basePath = opts.basePath
    ? path.resolve(opts.basePath)
    : filePath
      ? path.dirname(filePath)
      : process.cwd();

  // ------------------------------------------------------------------
  // Level 1: Syntax validation
  // ------------------------------------------------------------------
  const doc = validateSyntax(content, errors);
  if (doc === null) {
    // Cannot continue if YAML is unparseable.
    return { valid: false, errors, warnings };
  }

  // ------------------------------------------------------------------
  // Level 2: Structure validation
  // ------------------------------------------------------------------
  validateStructure(doc, errors, warnings);

  // If there are structure errors, further validation may be unreliable
  // but we continue to provide as many diagnostics as possible.

  // ------------------------------------------------------------------
  // Level 3: Mode-aware validation
  // ------------------------------------------------------------------
  let mode = opts.mode;
  if (!mode) {
    // Auto-detect mode from the content.
    const detection = detect(content);
    mode = detection.mode;
  }

  // Collect all keys for mode analysis.
  const allKeys = [];
  collectKeys(doc, '', allKeys);

  if (mode === 'native') {
    validateNativeMode(allKeys, warnings);
    // Level 3b: Check that native actions use the flat/sibling format.
    validateNativeActionFormats(doc, warnings);
  } else if (mode === 'extended') {
    validateExtendedMode(doc, content, errors, warnings);
  }

  // ------------------------------------------------------------------
  // Level 4: Semantic validation
  // ------------------------------------------------------------------
  validateVariableReferences(doc, warnings);
  validateImportPaths(doc, basePath, warnings, errors);

  // ------------------------------------------------------------------
  // Result
  // ------------------------------------------------------------------
  const hasErrors = errors.some((e) => e.level === 'error');
  return {
    valid: !hasErrors,
    errors,
    warnings,
  };
}

module.exports = {
  validate,
};
