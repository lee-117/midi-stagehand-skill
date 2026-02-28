'use strict';

const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');
const Handlebars = require('handlebars');

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
  } catch (_err) {
    return {
      generate(step, ctx) {
        const pad = '  '.repeat((ctx && ctx.indent) || 0);
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
// ---------------------------------------------------------------------------
const NATIVE_KEYS = new Set([
  'ai',
  'aiAct',
  'aiTap',
  'aiHover',
  'aiInput',
  'aiKeyboardPress',
  'aiScroll',
  'aiQuery',
  'aiAssert',
  'aiWaitFor',
  'sleep',
  'javascript',
  'recordToReport',
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
 * Determine whether `input` looks like a file path rather than raw YAML
 * content. A string is treated as a path when it does not contain a newline
 * and ends with `.yaml` or `.yml`.
 */
function looksLikeFilePath(input) {
  if (input.includes('\n')) {
    return false;
  }
  const ext = path.extname(input).toLowerCase();
  return ext === '.yaml' || ext === '.yml';
}

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
    raw = fs.readFileSync(yamlInput, 'utf8');
  }

  return yaml.load(raw);
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
function extractPlatformConfig(doc) {
  const config = {
    url: '',
    headless: false,
    viewportWidth: 1280,
    viewportHeight: 720,
    chromeArgs: '',
    platform: 'web',
  };

  // Web platform (most common)
  if (doc.web) {
    const w = doc.web;
    // Escape single quotes in URL to prevent breaking the JS string literal
    config.url = (w.url || '').replace(/'/g, "\\'");
    config.headless = w.headless !== undefined ? w.headless : false;
    config.viewportWidth = w.viewportWidth || w.viewport_width || 1280;
    config.viewportHeight = w.viewportHeight || w.viewport_height || 720;
    if (w.chromeArgs || w.chrome_args) {
      const args = w.chromeArgs || w.chrome_args;
      config.chromeArgs = Array.isArray(args)
        ? args.map(function (a) { return "'" + a + "'"; }).join(', ')
        : "'" + args + "'";
    }
    config.platform = 'web';
    return config;
  }

  // Android / iOS / Computer – extract url if present, keep defaults
  for (const plat of ['android', 'ios', 'computer']) {
    if (doc[plat]) {
      config.platform = plat;
      const p = doc[plat];
      config.url = (p.url || '').replace(/'/g, "\\'");
      config.headless = p.headless !== undefined ? p.headless : false;
      if (p.viewportWidth || p.viewport_width) {
        config.viewportWidth = p.viewportWidth || p.viewport_width;
      }
      if (p.viewportHeight || p.viewport_height) {
        config.viewportHeight = p.viewportHeight || p.viewport_height;
      }
      return config;
    }
  }

  // Fallback: check for top-level url (simplified YAML)
  if (doc.url) {
    config.url = doc.url;
  }

  return config;
}

/**
 * Extract agent-level configuration if the YAML provides one.
 *
 * @param {object} doc
 * @returns {object|null}
 */
function extractAgentConfig(doc) {
  if (doc.agent) {
    return doc.agent;
  }
  return null;
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
    let result = str.replace(/\$\{ENV\.(\w+)\}/g, '${process.env.$1}');
    result = result.replace(/\$\{ENV:(\w+)\}/g, '${process.env.$1}');
    return '`' + result + '`';
  }
  return "'" + str.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
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
 * @returns {string} Generated TypeScript code.
 */
function processStep(step, indent, varScope) {
  if (!step || typeof step !== 'object') {
    const pad = '  '.repeat(indent || 0);
    return pad + '// Skipped: invalid step';
  }

  indent = indent || 0;
  varScope = varScope || new Set();

  const { generator, type } = detectStepType(step);

  const ctx = {
    indent: indent,
    varScope: varScope,
    processStep: processStep, // allow recursive descent
  };

  // Track imports on the shared tracker (attached during transpile())
  if (processStep._importTracker) {
    trackImports(processStep._importTracker, type, step);
  }

  return generator.generate(step, ctx, processStep);
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
function transpile(yamlInput, options) {
  options = options || {};
  const templateType = options.templateType || 'puppeteer';

  // 1. Parse
  const doc = resolveYaml(yamlInput);

  if (!doc || typeof doc !== 'object') {
    throw new Error('transpiler: parsed YAML document is empty or not an object');
  }

  // 2. Extract platform config
  const platformConfig = extractPlatformConfig(doc);

  // 3. Extract agent config (reserved for future use)
  const _agentConfig = extractAgentConfig(doc);

  // 4. Gather tasks and their flow steps
  const tasks = doc.tasks || [];
  if (!Array.isArray(tasks) || tasks.length === 0) {
    throw new Error('transpiler: YAML document must contain a "tasks" array with at least one task');
  }

  // 5. Set up shared state for code generation
  const varScope = new Set();
  const importTracker = createImportTracker();

  // Attach the import tracker to processStep so nested calls can update it
  processStep._importTracker = importTracker;

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
        codeLines.push('  '.repeat(BASE_INDENT) + 'const ' + varName + ' = ' + toImportCodeString(flowPath) + ';');
      } else if (imp.data && imp.as) {
        // Data import: require JSON/data file
        const dataPath = imp.data;
        const varName = imp.as;
        varScope.add(varName);
        const ext = (dataPath.match(/\.([a-zA-Z0-9]+)$/) || [])[1] || '';
        if (ext === 'json') {
          codeLines.push('  '.repeat(BASE_INDENT) + 'const ' + varName + ' = require(' + toImportCodeString(dataPath) + ');');
        } else {
          codeLines.push('  '.repeat(BASE_INDENT) + 'const ' + varName + ' = require(' + toImportCodeString(dataPath) + ');');
        }
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
    const flow = task.flow || [];

    if (!Array.isArray(flow)) {
      codeLines.push('  '.repeat(BASE_INDENT) + '// Skipped task "' + taskName + '": flow is not an array');
      continue;
    }

    // Emit a comment header for each task
    if (tasks.length > 1) {
      if (ti > 0) {
        codeLines.push('');
      }
      codeLines.push('  '.repeat(BASE_INDENT) + '// --- ' + taskName + ' ---');
    }

    // continueOnError: wrap entire task flow in try/catch so failures
    // don't abort subsequent tasks.
    const useContinueOnError = task.continueOnError === true;
    const stepIndent = useContinueOnError ? BASE_INDENT + 1 : BASE_INDENT;

    if (useContinueOnError) {
      codeLines.push('  '.repeat(BASE_INDENT) + 'try {');
    }

    for (const step of flow) {
      const generated = processStep(step, stepIndent, varScope);
      if (generated !== undefined && generated !== null) {
        codeLines.push(generated);
      }
    }

    if (useContinueOnError) {
      codeLines.push('  '.repeat(BASE_INDENT) + '} catch (_continueErr) {');
      codeLines.push('  '.repeat(BASE_INDENT + 1) + "console.warn('[continueOnError] Task \"" + taskName + "\" failed:', _continueErr.message);");
      codeLines.push('  '.repeat(BASE_INDENT) + '}');
    }

    // output directive: write collected data to a JSON file
    if (task.output && task.output.filePath && task.output.dataName) {
      importTracker.needsFs = true;
      const filePath = task.output.filePath;
      const dataName = task.output.dataName;
      codeLines.push('  '.repeat(BASE_INDENT) + "// Output: write " + dataName + " to " + filePath);
      codeLines.push('  '.repeat(BASE_INDENT) + "const __outputDir = require('path').dirname('" + filePath.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "');");
      codeLines.push('  '.repeat(BASE_INDENT) + 'if (!fs.existsSync(__outputDir)) fs.mkdirSync(__outputDir, { recursive: true });');
      codeLines.push('  '.repeat(BASE_INDENT) + "fs.writeFileSync('" + filePath.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "', JSON.stringify(" + dataName + ", null, 2), 'utf-8');");
    }
  }

  // Clean up the shared tracker reference
  processStep._importTracker = null;

  const generatedCode = codeLines.join('\n');

  // 7. Load the appropriate Handlebars template
  const templateFile = templateType + '-boilerplate.ts.hbs';
  const template = loadTemplate(templateFile);

  // 8. Build template data and render
  const templateData = {
    url: platformConfig.url,
    headless: platformConfig.headless,
    viewportWidth: platformConfig.viewportWidth,
    viewportHeight: platformConfig.viewportHeight,
    chromeArgs: platformConfig.chromeArgs,
    generatedCode: generatedCode,
    needsChildProcess: importTracker.needsChildProcess,
    needsFs: importTracker.needsFs,
  };

  const code = template(templateData);

  // 9. Optionally write to disk
  const result = { code: code };

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
