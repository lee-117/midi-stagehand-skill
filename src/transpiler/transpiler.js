'use strict';

const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');
const Handlebars = require('handlebars');

const { looksLikeFilePath } = require('../utils/yaml-helpers');
const { getPad, escapeStringLiteral, resolveEnvRefs } = require('./generators/utils');
const { MAX_WALK_DEPTH } = require('../utils/yaml-helpers');

// ---------------------------------------------------------------------------
// Generator imports
// ---------------------------------------------------------------------------
const nativeGen = require('./generators/native-gen');

/**
 * Lazy-load optional generators so the transpiler does not crash when a
 * generator file has not been created yet. Returns an object with a
 * `generate(step, ctx)` method, or a stub that emits a comment.
 */
function loadGenerator(name) {
  try {
    return require('./generators/' + name);
  } catch {
    return {
      generate(step, ctx) {
        const pad = getPad(ctx && ctx.indent);
        return pad + '// TODO: generator "' + name + '" is not yet implemented';
      },
    };
  }
}

const variableGen = loadGenerator('variable-gen');
const logicGen = loadGenerator('logic-gen');
const loopGen = loadGenerator('loop-gen');
const importGen = loadGenerator('import-gen');
const dataTransformGen = loadGenerator('data-transform-gen');
const tryCatchGen = loadGenerator('try-catch-gen');
const externalCallGen = loadGenerator('external-call-gen');
const parallelGen = loadGenerator('parallel-gen');
const useGen = loadGenerator('use-gen');

// ---------------------------------------------------------------------------
// Native action keys – any step that carries one of these is dispatched to
// native-gen rather than to an extended generator.
// Derived from schema/native-keywords.json to maintain a single source of truth.
// ---------------------------------------------------------------------------
const nativeSchema = require('../../schema/native-keywords.json');
const NATIVE_KEYS = new Set([
  ...nativeSchema.aiPlanning,
  ...nativeSchema.aiActions,
  ...nativeSchema.aiData,
  ...nativeSchema.aiAssertions,
  ...nativeSchema.tools,
  ...nativeSchema.platformSpecific,
]);

// ---------------------------------------------------------------------------
// Template cache
// ---------------------------------------------------------------------------
const templateCache = {};

/**
 * Load and compile a Handlebars template from the ./templates/ directory.
 *
 * @param {string} templateName - Template file name without path
 *   (e.g. "puppeteer-boilerplate.ts.hbs").
 * @returns {HandlebarsTemplateDelegate}
 */
function loadTemplate(templateName) {
  if (templateCache[templateName]) {
    return templateCache[templateName];
  }
  const templatePath = path.join(__dirname, 'templates', templateName);
  const source = fs.readFileSync(templatePath, 'utf8');
  const compiled = Handlebars.compile(source, { noEscape: true });
  templateCache[templateName] = compiled;
  return compiled;
}

// ---------------------------------------------------------------------------
// Input resolution helpers
// ---------------------------------------------------------------------------

/**
 * Accept a file path, raw YAML string, or a pre-parsed object and always
 * return the parsed JavaScript object.
 *
 * @param {string|object} yamlInput
 * @returns {object} Parsed YAML document.
 */
function resolveYaml(yamlInput) {
  if (yamlInput !== null && typeof yamlInput === 'object') {
    // Already parsed
    return yamlInput;
  }

  if (typeof yamlInput !== 'string') {
    throw new Error('transpiler: yamlInput must be a string or object');
  }

  let raw = yamlInput;
  if (looksLikeFilePath(yamlInput)) {
    const stat = fs.statSync(yamlInput);
    if (stat.size > 1024 * 1024) {
      throw new Error('YAML file exceeds 1MB size limit (' + Math.round(stat.size / 1024) + 'KB). Consider splitting into smaller files using import.');
    }
    raw = fs.readFileSync(yamlInput, 'utf8');
  }

  return yaml.load(raw, { maxAliases: 100 });
}

// ---------------------------------------------------------------------------
// Platform / config extraction
// ---------------------------------------------------------------------------

/**
 * Pull platform-level configuration out of the parsed YAML doc.
 * The YAML may have a top-level `web`, `android`, `ios`, or `computer` key.
 *
 * @param {object} doc
 * @returns {object} Normalised platform config.
 */
/**
 * Extract common fields (url, headless, viewport) from a platform config object.
 * Handles both camelCase and snake_case field names.
 */
// Table-driven platform field mappings: [camelCase, snake_case (optional)]
// Fields with boolean semantics (where false is a valid value) use undefined-check.
const PLATFORM_FIELD_MAP = [
  // snake_case aliases (truthy-check: value is a string/number/object)
  ['viewportWidth', 'viewport_width'],
  ['viewportHeight', 'viewport_height'],
  ['userAgent', 'user_agent'],
  ['deviceScaleFactor', 'device_scale_factor'],
  // snake_case aliases (undefined-check: boolean fields)
  ['acceptInsecureCerts', 'accept_insecure_certs'],
  ['waitForNetworkIdle', 'wait_for_network_idle'],
  ['bridgeMode', 'bridge_mode'],
  ['forceSameTabNavigation', 'force_same_tab_navigation'],
  // camelCase-only fields (truthy-check)
  ['cookie'],
  ['serve'],
  ['output'],
  // camelCase-only fields (undefined-check)
  ['waitForNavigationTimeout'],
  ['waitForNetworkIdleTimeout'],
  ['enableTouchEventsInActionSpace'],
  ['forceChromeSelectRendering'],
  ['closeNewTabsAfterDisconnect'],
];

function normalizePlatformFields(obj, config) {
  config.url = escapeStringLiteral(obj.url || '');
  config.headless = obj.headless !== undefined ? obj.headless : false;

  for (const mapping of PLATFORM_FIELD_MAP) {
    const camel = mapping[0];
    const snake = mapping[1];
    const value = obj[camel] !== undefined ? obj[camel] : (snake ? obj[snake] : undefined);
    if (value !== undefined) {
      config[camel] = value;
    }
  }
}

function extractPlatformConfig(doc) {
  const config = {
    url: '',
    headless: false,
    viewportWidth: 1280,
    viewportHeight: 960,
    chromeArgs: '',
    platform: 'web',
  };

  // Web platform (most common)
  if (doc.web) {
    normalizePlatformFields(doc.web, config);
    if (doc.web.chromeArgs || doc.web.chrome_args) {
      const args = doc.web.chromeArgs || doc.web.chrome_args;
      config.chromeArgs = Array.isArray(args)
        ? args.map(function (a) { return "'" + escapeStringLiteral(a) + "'"; }).join(', ')
        : "'" + escapeStringLiteral(args) + "'";
    }
    config.platform = 'web';
    return config;
  }

  // Android / iOS / Computer – extract common fields
  for (const plat of ['android', 'ios', 'computer']) {
    if (doc[plat]) {
      config.platform = plat;
      normalizePlatformFields(doc[plat], config);
      return config;
    }
  }

  // Fallback: check for top-level url (simplified YAML)
  if (doc.url) {
    config.url = doc.url;
  }

  return config;
}

// ---------------------------------------------------------------------------
// Agent config extraction
// ---------------------------------------------------------------------------

/**
 * Extract agent-level configuration from the parsed YAML doc.
 * Returns null if no agent config is present.
 *
 * @param {object} doc
 * @returns {object|null}
 */
function extractAgentConfig(doc) {
  if (!doc.agent || typeof doc.agent !== 'object') return null;

  const AGENT_FIELDS = [
    'testId', 'groupName', 'groupDescription', 'cache',
    'generateReport', 'autoPrintReportMsg', 'reportFileName',
    'replanningCycleLimit', 'aiActContext',
    'screenshotShrinkFactor', 'waitAfterAction',
    'outputFormat', 'modelConfig',
  ];

  const config = {};
  let hasFields = false;

  for (const field of AGENT_FIELDS) {
    if (doc.agent[field] !== undefined) {
      config[field] = doc.agent[field];
      hasFields = true;
    }
  }

  return hasFields ? config : null;
}

// ---------------------------------------------------------------------------
// Step type detection & dispatch
// ---------------------------------------------------------------------------

/**
 * Detect the type of a flow step and return the appropriate generator module.
 *
 * The detection order matters: more specific extended keys are checked before
 * the catch-all native key scan.
 *
 * @param {object} step - A single flow step object.
 * @returns {{ generator: object, type: string }}
 */
function detectStepType(step) {
  if (step.variables !== undefined) return { generator: variableGen, type: 'variables' };
  if (step.logic !== undefined) return { generator: logicGen, type: 'logic' };
  if (step.loop !== undefined) return { generator: loopGen, type: 'loop' };
  if (step.import !== undefined) return { generator: importGen, type: 'import' };
  if (step.data_transform !== undefined) return { generator: dataTransformGen, type: 'data_transform' };
  if (step.try !== undefined) return { generator: tryCatchGen, type: 'try_catch' };
  if (step.external_call !== undefined) return { generator: externalCallGen, type: 'external_call' };
  if (step.parallel !== undefined) return { generator: parallelGen, type: 'parallel' };
  if (step.use !== undefined) return { generator: useGen, type: 'use' };

  // Check for any native Midscene key
  for (const key of Object.keys(step)) {
    if (NATIVE_KEYS.has(key)) {
      return { generator: nativeGen, type: 'native' };
    }
  }

  // Completely unknown step – fall through to native-gen which will emit a
  // comment with the serialised step.
  return { generator: nativeGen, type: 'unknown' };
}

// ---------------------------------------------------------------------------
// Import tracking
// ---------------------------------------------------------------------------

/**
 * Track which extra imports are needed based on the step types encountered.
 * This object is mutated during code generation and later fed to the
 * Handlebars template as boolean flags.
 */
function createImportTracker() {
  return {
    needsChildProcess: false,
    needsFs: false,
  };
}

/**
 * Update the import tracker based on the step type that was just processed.
 */
function trackImports(tracker, stepType, step) {
  if (stepType === 'external_call') {
    if (step.external_call) {
      const callType = step.external_call.type || '';
      if (callType === 'shell' || callType === 'command') {
        tracker.needsChildProcess = true;
      }
      // Note: Node 18+ has native fetch, no import needed
    }
  }
  // Note: data_transform operations are in-memory; only the `output` directive needs fs
  // (handled separately in the task output section)
}

// ---------------------------------------------------------------------------
// String helpers
// ---------------------------------------------------------------------------

/**
 * Convert an import path string to a code-safe string literal.
 * Handles ${...} template syntax, converting it to template literals.
 */
function toImportCodeString(str) {
  if (typeof str !== 'string') return 'undefined';
  if (str.includes('${')) {
    return '`' + resolveEnvRefs(str) + '`';
  }
  return "'" + escapeStringLiteral(str) + "'";
}

// ---------------------------------------------------------------------------
// Core processing
// ---------------------------------------------------------------------------

/**
 * Process a single flow step and return the generated TypeScript code string.
 * This function is also handed to generators that need to recurse into nested
 * steps (e.g. loop bodies, logic branches, try/catch blocks).
 *
 * @param {object} step     - The YAML step object.
 * @param {number} indent   - Current indentation level (number of 2-space units).
 * @param {Set<string>} varScope - Set of variable names already declared in scope.
 * @param {object} [_extra] - Internal context (e.g. { importTracker }) propagated
 *   through recursion via closure. Callers outside transpile() can omit this.
 * @returns {string} Generated TypeScript code.
 */
function processStep(step, indent, varScope, _extra) {
  if (!step || typeof step !== 'object') {
    const pad = getPad(indent);
    return pad + '// Skipped: invalid step';
  }

  indent = indent || 0;
  varScope = varScope || new Set();

  // Depth guard: prevent stack overflow from deeply nested YAML
  const depth = (_extra && _extra.depth) || 0;
  if (depth >= MAX_WALK_DEPTH) {
    return getPad(indent) + '// Skipped: maximum nesting depth exceeded';
  }

  const { generator, type } = detectStepType(step);

  // C1: Warn on unknown step types
  if (type === 'unknown' && _extra && _extra.warnings) {
    const stepKeys = Object.keys(step).join(', ');
    _extra.warnings.push(`Unknown step type with keys: [${stepKeys}]. This step will be serialised as a comment.`);
  }

  // Bind _extra into the recursive callback so generators propagate it
  // without needing to know about it. Increment depth for child steps.
  const childExtra = _extra ? Object.assign({}, _extra, { depth: depth + 1 }) : { depth: depth + 1 };
  const boundProcessStep = function (s, i, v) { return processStep(s, i, v, childExtra); };

  const ctx = {
    indent: indent,
    varScope: varScope,
    processStep: boundProcessStep,
  };

  // Track imports if a tracker was provided (set by transpile())
  if (_extra && _extra.importTracker) {
    trackImports(_extra.importTracker, type, step);
  }

  return generator.generate(step, ctx, boundProcessStep);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Transpile a YAML input into a complete TypeScript file.
 *
 * @param {string|object} yamlInput - File path, raw YAML string, or pre-parsed
 *   object.
 * @param {object} [options]
 * @param {'puppeteer'|'playwright'} [options.templateType='puppeteer']
 * @param {string} [options.outputPath] - If set, the TS file is also written to
 *   this path.
 * @returns {{ code: string, outputPath?: string }}
 */
const SUPPORTED_TEMPLATES = new Set(['puppeteer', 'playwright']);

function transpile(yamlInput, options) {
  options = options || {};
  const templateType = options.templateType || 'puppeteer';

  if (!SUPPORTED_TEMPLATES.has(templateType)) {
    throw new Error('transpiler: unsupported templateType "' + templateType + '". Supported: ' + Array.from(SUPPORTED_TEMPLATES).join(', '));
  }

  // 1. Parse
  const doc = resolveYaml(yamlInput);

  if (!doc || typeof doc !== 'object') {
    throw new Error('transpiler: parsed YAML document is empty or not an object');
  }

  // 2. Extract platform config
  const platformConfig = extractPlatformConfig(doc);

  // 2b. Extract agent config
  const agentConfig = extractAgentConfig(doc);

  // 2c. Merge web agent constructor options from platform config into agent config
  const WEB_AGENT_FIELDS = [
    'waitForNavigationTimeout', 'waitForNetworkIdleTimeout',
    'enableTouchEventsInActionSpace', 'forceChromeSelectRendering',
    'closeNewTabsAfterDisconnect',
  ];
  let finalAgentConfig = agentConfig;
  for (const field of WEB_AGENT_FIELDS) {
    if (platformConfig[field] !== undefined) {
      if (!finalAgentConfig) finalAgentConfig = {};
      finalAgentConfig[field] = platformConfig[field];
    }
  }

  // 3. Gather tasks and their flow steps
  const tasks = doc.tasks || [];
  if (!Array.isArray(tasks) || tasks.length === 0) {
    throw new Error('transpiler: YAML document must contain a "tasks" array with at least one task');
  }

  // 5. Set up shared state for code generation
  const varScope = new Set();
  const importTracker = createImportTracker();

  // Extra context passed through processStep recursion via closure
  const extra = { importTracker: importTracker, warnings: [] };

  // Base indent inside the template's try block (matches template structure)
  const BASE_INDENT = 2;

  // 5b. Process top-level `import` section (declares flow/data imports)
  const codeLines = [];

  if (doc.import && Array.isArray(doc.import)) {
    for (const imp of doc.import) {
      if (imp.flow && imp.as) {
        // Flow import: store the path as a variable for later use with `use`
        const flowPath = imp.flow;
        const varName = imp.as;
        varScope.add(varName);
        codeLines.push(getPad(BASE_INDENT) + 'const ' + varName + ' = ' + toImportCodeString(flowPath) + ';');
      } else if (imp.data && imp.as) {
        // Data import: require JSON/data file
        const varName = imp.as;
        varScope.add(varName);
        codeLines.push(getPad(BASE_INDENT) + 'const ' + varName + ' = require(' + toImportCodeString(imp.data) + ');');
      }
    }
    if (codeLines.length > 0) {
      codeLines.push('');
    }
  }

  // 5c. Process top-level `variables` section
  if (doc.variables && typeof doc.variables === 'object' && !Array.isArray(doc.variables)) {
    const varStep = { variables: doc.variables };
    const varCode = variableGen.generate(varStep, { indent: BASE_INDENT, varScope });
    if (varCode) {
      codeLines.push(varCode);
      codeLines.push('');
    }
  }

  // 6. Iterate tasks and their flow steps, collecting generated TS lines

  for (let ti = 0; ti < tasks.length; ti++) {
    const task = tasks[ti];
    const taskName = task.name || 'Task ' + (ti + 1);
    const flow = task.flow || task.steps || [];

    if (!Array.isArray(flow)) {
      codeLines.push(getPad(BASE_INDENT) + '// Skipped task "' + taskName + '": flow is not an array');
      continue;
    }

    // Emit a comment header for each task
    if (tasks.length > 1) {
      if (ti > 0) {
        codeLines.push('');
      }
      codeLines.push(getPad(BASE_INDENT) + '// --- ' + taskName + ' ---');
    }

    // continueOnError: wrap entire task flow in try/catch so failures
    // don't abort subsequent tasks.
    const useContinueOnError = task.continueOnError === true;
    const stepIndent = useContinueOnError ? BASE_INDENT + 1 : BASE_INDENT;

    if (useContinueOnError) {
      codeLines.push(getPad(BASE_INDENT) + 'try {');
    }

    for (const step of flow) {
      const generated = processStep(step, stepIndent, varScope, extra);
      if (generated !== undefined && generated !== null) {
        codeLines.push(generated);
      }
    }

    if (useContinueOnError) {
      codeLines.push(getPad(BASE_INDENT) + '} catch (_continueErr) {');
      codeLines.push(getPad(BASE_INDENT + 1) + "console.warn('[continueOnError] Task \"" + taskName + "\" failed:', _continueErr.message);");
      codeLines.push(getPad(BASE_INDENT) + '}');
    }

    // output directive: write collected data to a JSON file
    if (task.output && task.output.filePath && task.output.dataName) {
      importTracker.needsFs = true;
      const filePath = task.output.filePath;
      const dataName = task.output.dataName;
      codeLines.push(getPad(BASE_INDENT) + "// Output: write " + dataName + " to " + filePath);
      const escapedPath = escapeStringLiteral(filePath);
      codeLines.push(getPad(BASE_INDENT) + "const __outputDir = require('path').dirname('" + escapedPath + "');");
      codeLines.push(getPad(BASE_INDENT) + 'if (!fs.existsSync(__outputDir)) fs.mkdirSync(__outputDir, { recursive: true });');
      codeLines.push(getPad(BASE_INDENT) + "fs.writeFileSync('" + escapedPath + "', JSON.stringify(" + dataName + ", null, 2), 'utf-8');");
    }
  }

  const generatedCode = codeLines.join('\n');

  // 7. Load the appropriate Handlebars template
  const templateFile = templateType + '-boilerplate.ts.hbs';
  const template = loadTemplate(templateFile);

  // 8. Build template data and render
  // cookie files require fs import
  if (platformConfig.cookie) {
    importTracker.needsFs = true;
  }

  const templateData = {
    url: platformConfig.url,
    headless: platformConfig.headless,
    viewportWidth: platformConfig.viewportWidth,
    viewportHeight: platformConfig.viewportHeight,
    chromeArgs: platformConfig.chromeArgs,
    generatedCode: generatedCode,
    needsChildProcess: importTracker.needsChildProcess,
    needsFs: importTracker.needsFs,
    userAgent: escapeStringLiteral(platformConfig.userAgent || ''),
    deviceScaleFactor: platformConfig.deviceScaleFactor || 0,
    cookie: escapeStringLiteral(platformConfig.cookie || ''),
    acceptInsecureCerts: platformConfig.acceptInsecureCerts || false,
    waitForNetworkIdle: platformConfig.waitForNetworkIdle || false,
    waitForNetworkIdleOpts: (typeof platformConfig.waitForNetworkIdle === 'object' && platformConfig.waitForNetworkIdle !== null)
      ? JSON.stringify(platformConfig.waitForNetworkIdle)
      : '',
    waitForNetworkIdleTimeout: (typeof platformConfig.waitForNetworkIdle === 'object' && platformConfig.waitForNetworkIdle !== null && platformConfig.waitForNetworkIdle.timeout)
      ? platformConfig.waitForNetworkIdle.timeout
      : 0,
    hasAgentConfig: !!finalAgentConfig,
    agentConfigJson: finalAgentConfig ? JSON.stringify(finalAgentConfig) : '',
  };

  const code = template(templateData);

  // 9. Optionally write to disk
  const result = { code: code, warnings: extra.warnings };

  if (options.outputPath) {
    const outDir = path.dirname(options.outputPath);
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }
    fs.writeFileSync(options.outputPath, code, 'utf8');
    result.outputPath = options.outputPath;
  }

  return result;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  transpile: transpile,
  processStep: processStep,
};
