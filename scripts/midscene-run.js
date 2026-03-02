#!/usr/bin/env node

'use strict';

const path = require('path');
const fs = require('fs');

// ---------------------------------------------------------------------------
// Module imports from ../src/
// ---------------------------------------------------------------------------
const { detect } = require('../src/detector/mode-detector');
const nativeRunner = require('../src/runner/native-runner');
const tsRunner = require('../src/runner/ts-runner');
const reportParser = require('../src/runner/report-parser');
const { DEFAULT_TIMEOUT, DEFAULT_REPORT_DIR, MIDSCENE_TMP_DIR, STALE_TEMP_THRESHOLD_MS, MAX_ERROR_MESSAGE_LENGTH } = require('../src/constants');

// ---------------------------------------------------------------------------
// Argument parsing (no external dependencies)
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const args = {
    yamlPath: null,
    dryRun: false,
    outputTs: null,
    reportDir: DEFAULT_REPORT_DIR,
    template: 'puppeteer',
    timeout: DEFAULT_TIMEOUT,
    retry: 0,
    clean: false,
    verbose: false,
    help: false,
    version: false,
  };

  const rawArgs = argv.slice(2); // skip node + script path

  for (let i = 0; i < rawArgs.length; i++) {
    const arg = rawArgs[i];

    switch (arg) {
      case '--help':
      case '-h':
        args.help = true;
        break;

      case '--version':
      case '-V':
        args.version = true;
        break;

      case '--timeout': {
        const timeoutVal = parseInt(rawArgs[++i], 10);
        if (isNaN(timeoutVal) || timeoutVal <= 0) {
          console.error('[midscene-run] --timeout must be a positive integer (ms).');
          process.exit(1);
        }
        args.timeout = timeoutVal;
        break;
      }

      case '--retry': {
        const retryVal = parseInt(rawArgs[++i], 10);
        if (isNaN(retryVal) || retryVal < 0) {
          console.error('[midscene-run] --retry must be a non-negative integer.');
          process.exit(1);
        }
        args.retry = retryVal;
        break;
      }

      case '--clean':
        args.clean = true;
        break;

      case '--dry-run':
        args.dryRun = true;
        break;

      case '--verbose':
      case '-v':
        args.verbose = true;
        break;

      case '--output-ts': {
        const tsVal = rawArgs[i + 1];
        if (!tsVal || tsVal.startsWith('-')) {
          console.error('[midscene-run] --output-ts requires a file path.');
          process.exit(1);
          break;
        }
        if (!tsVal.endsWith('.ts')) {
          console.error('[midscene-run] --output-ts path must have a .ts extension.');
          process.exit(1);
        }
        args.outputTs = rawArgs[++i];
        break;
      }

      case '--report-dir':
        if (!rawArgs[i + 1] || rawArgs[i + 1].startsWith('-')) {
          console.error('[midscene-run] --report-dir requires a directory path.');
          process.exit(1);
        }
        args.reportDir = rawArgs[++i];
        break;

      case '--template': {
        if (!rawArgs[i + 1] || rawArgs[i + 1].startsWith('-')) {
          console.error('[midscene-run] --template requires a template name (puppeteer | playwright).');
          process.exit(1);
        }
        const tmpl = rawArgs[++i];
        if (tmpl !== 'puppeteer' && tmpl !== 'playwright') {
          console.error(`[midscene-run] Invalid template "${tmpl}". Must be "puppeteer" or "playwright".`);
          process.exit(1);
        }
        args.template = tmpl;
        break;
      }

      default:
        // First positional argument is the YAML file path
        if (!arg.startsWith('--') && !arg.startsWith('-') && args.yamlPath === null) {
          args.yamlPath = arg;
        } else if (!arg.startsWith('--') && !arg.startsWith('-')) {
          console.error(`[midscene-run] Unknown positional argument: ${arg}`);
          console.error(`  Run "midscene-run --help" to see available options.`);
          process.exit(1);
        } else {
          console.error(`[midscene-run] Unknown option: ${arg}`);
          console.error(`  Run "midscene-run --help" to see available options.`);
          process.exit(1);
        }
        break;
    }
  }

  return args;
}

// ---------------------------------------------------------------------------
// Help text
// ---------------------------------------------------------------------------
function showHelp() {
  console.log(`
Usage: midscene-run <yaml-file|glob-pattern> [options]

Execute a Midscene YAML Superset file. Native YAML files are run directly
via the Midscene CLI; extended files are transpiled to TypeScript first.

Positional arguments:
  <yaml-file>              Path to the YAML file to execute (required).
                           Supports glob patterns for batch execution
                           (e.g. "tests/**/*.yaml").

Options:
  --dry-run                Transpile only; do not execute
  --output-ts <path>       Save the generated TypeScript file to <path>
  --report-dir <path>      Directory for Midscene reports
                           (default: ./midscene-report)
  --template <name>        Boilerplate template: puppeteer | playwright
                           (default: puppeteer)
  --timeout <ms>           Execution timeout in milliseconds
                           (default: 300000 = 5 minutes)
  --retry <count>          Retry failed executions (for flaky scenarios)
                           (default: 0 = no retry)
  --clean                  Clean stale temp files from .midscene-tmp/
  --verbose, -v            Show detailed output (validation details,
                           detection info, environment)
  --version, -V            Show version information
  --help, -h               Show this help message

Examples:
  midscene-run tests/login.yaml
  midscene-run tests/checkout.yaml --template playwright
  midscene-run tests/extended.yaml --dry-run --output-ts ./generated.ts
  midscene-run "tests/**/*.yaml"             # batch: run all YAML files
  midscene-run "tests/smoke-*.yaml" -v       # batch with verbose output
  midscene-run tests/flaky.yaml --retry 2    # retry up to 2 times on failure
  midscene-run --clean                       # remove stale temp files
`);
}

// ---------------------------------------------------------------------------
// Validator helper
// ---------------------------------------------------------------------------
function tryValidate(yamlPath) {
  try {
    const { validate } = require('../src/validator/yaml-validator');
    return validate(yamlPath);
  } catch (e) {
    // Validator module failed to load – do NOT skip validation silently
    return {
      valid: false,
      errors: [{ level: 'error', message: 'Validator module unavailable: ' + e.message, path: '' }],
      warnings: [],
    };
  }
}

// ---------------------------------------------------------------------------
// Transpiler helper
// ---------------------------------------------------------------------------
function tryTranspile(yamlPath, options) {
  try {
    const { transpile } = require('../src/transpiler/transpiler');
    return transpile(yamlPath, options);
  } catch (e) {
    return { error: 'Transpiler error: ' + e.message };
  }
}

// ---------------------------------------------------------------------------
// Glob helper – resolve a path or glob pattern to an array of YAML files
// ---------------------------------------------------------------------------
function resolveYamlFiles(inputPath) {
  // Check if the input contains glob characters.
  if (inputPath.includes('*') || inputPath.includes('?') || inputPath.includes('{')) {
    let matched;
    try {
      matched = fs.globSync(inputPath, { cwd: process.cwd() })
        .map(f => path.resolve(f))
        .filter(f => {
          const ext = path.extname(f).toLowerCase();
          return ext === '.yaml' || ext === '.yml';
        })
        .sort();
    } catch (err) {
      console.error(`[midscene-run] Invalid glob pattern "${inputPath}": ${err.message}`);
      return [];
    }

    return matched;
  }

  // Single file path.
  const resolved = path.resolve(inputPath);
  if (!fs.existsSync(resolved)) {
    return [];
  }
  return [resolved];
}

// ---------------------------------------------------------------------------
// Quick-fix hints for common error patterns
// ---------------------------------------------------------------------------
function printQuickFixHints(allMsgs, errorMsg) {
  const combined = allMsgs + ' ' + (errorMsg || '');

  if (/syntax|parse/i.test(combined)) {
    console.error('\n  Hint: Check YAML indentation (use 2 spaces, not tabs) and ensure proper quoting of special characters.');
  }
  if (/platform config/i.test(combined)) {
    console.error('  Hint: Add a platform key at the top level, e.g. web: { url: "https://example.com" }');
  }
  if (/tasks/i.test(combined) && /required|missing|must/i.test(combined)) {
    console.error('  Hint: Add a "tasks" array with at least one task containing "name" and "flow".');
  }
  if (/api[_-]?key|MIDSCENE_MODEL_API_KEY|401/i.test(combined)) {
    console.error('  Hint: Set MIDSCENE_MODEL_API_KEY in .env or environment variables.');
  }
  if (/timeout|timed?\s*out/i.test(combined)) {
    console.error('  Hint: Increase timeout with --timeout flag. Note: timeout includes browser startup time (minimum 60000ms recommended).');
  }
  if (/element.*not\s*found|cannot\s*find|locate.*fail/i.test(combined)) {
    console.error('  Hint: Check selector/description accuracy. Use deepThink: true for complex layouts or add aiWaitFor before interaction.');
  }
  if (/EACCES|EPERM|permission|denied/i.test(combined)) {
    console.error('  Hint: Check file permissions and ensure the process has access to the required directories.');
  }
  if (/assert.*fail|assertion|expect.*but.*got/i.test(combined)) {
    console.error('  Hint: Check the expected condition in aiAssert. View the HTML report screenshots to compare actual vs expected page state.');
  }
  if (/ReferenceError|TypeError|EvalError|script\s*error/i.test(combined)) {
    console.error('  Hint: Review the JavaScript code in your YAML steps. Check variable names, data types, and browser vs Node.js API compatibility.');
  }
}

// ---------------------------------------------------------------------------
// Error message truncation
// ---------------------------------------------------------------------------
function truncateError(msg) {
  if (!msg || typeof msg !== 'string') return msg;
  if (msg.length <= MAX_ERROR_MESSAGE_LENGTH) return msg;
  return msg.slice(0, MAX_ERROR_MESSAGE_LENGTH) + '... (truncated, see full output above)';
}

// ---------------------------------------------------------------------------
// Stale temp file cleanup
// ---------------------------------------------------------------------------
function cleanStaleTempFiles(cwd) {
  const tmpDir = path.join(cwd || process.cwd(), MIDSCENE_TMP_DIR);
  if (!fs.existsSync(tmpDir)) {
    console.log('[midscene-run] No temp directory found.');
    return 0;
  }

  const now = Date.now();
  let cleaned = 0;
  const files = fs.readdirSync(tmpDir);

  for (const file of files) {
    const filePath = path.join(tmpDir, file);
    try {
      const stat = fs.statSync(filePath);
      if (now - stat.mtimeMs > STALE_TEMP_THRESHOLD_MS) {
        fs.unlinkSync(filePath);
        cleaned++;
      }
    } catch { /* skip unreadable files */ }
  }

  // Remove empty directory
  try {
    const remaining = fs.readdirSync(tmpDir);
    if (remaining.length === 0) fs.rmdirSync(tmpDir);
  } catch { /* ignore */ }

  return cleaned;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function main() {
  const args = parseArgs(process.argv);

  // Show version if requested
  if (args.version) {
    const pkg = require('../package.json');
    console.log(pkg.name + ' v' + pkg.version);
    process.exit(0);
  }

  // Show help if requested or no arguments provided
  if (args.help || (!args.yamlPath && !args.clean)) {
    showHelp();
    process.exit(args.help ? 0 : 1);
  }

  // Handle --clean flag
  if (args.clean) {
    const cleaned = cleanStaleTempFiles();
    console.log(`[midscene-run] Cleaned ${cleaned} stale temp file(s).`);
    if (!args.yamlPath) process.exit(0);
  }

  // Validate output paths are within project boundary
  if (args.outputTs) {
    const resolvedTs = path.resolve(args.outputTs);
    const cwd = process.cwd();
    if (!resolvedTs.startsWith(cwd + path.sep) && resolvedTs !== cwd && !resolvedTs.startsWith(cwd)) {
      console.error('[midscene-run] Error: --output-ts path must be within the project directory.');
      process.exit(1);
    }
  }
  if (args.reportDir && args.reportDir !== DEFAULT_REPORT_DIR) {
    const resolvedReport = path.resolve(args.reportDir);
    const cwd = process.cwd();
    if (!resolvedReport.startsWith(cwd + path.sep) && resolvedReport !== cwd && !resolvedReport.startsWith(cwd)) {
      console.error('[midscene-run] Error: --report-dir path must be within the project directory.');
      process.exit(1);
    }
  }

  // Clean stale temp files at startup (non-disruptive)
  try { cleanStaleTempFiles(); } catch { /* non-critical */ }

  // Resolve to one or more YAML files.
  const yamlFiles = resolveYamlFiles(args.yamlPath);

  if (yamlFiles.length === 0) {
    console.error(`[midscene-run] No YAML files found for: ${args.yamlPath}`);
    process.exit(1);
  }

  // Batch mode: process multiple files sequentially.
  if (yamlFiles.length > 1) {
    console.log(`[midscene-run] Batch mode: ${yamlFiles.length} files matched.\n`);
    const batchResults = [];

    for (let i = 0; i < yamlFiles.length; i++) {
      const filePath = yamlFiles[i];
      const relPath = path.relative(process.cwd(), filePath);
      console.log(`[midscene-run] [${i + 1}/${yamlFiles.length}] ${relPath}`);

      try {
        const exitCode = processFile(filePath, args);
        batchResults.push({ file: relPath, success: exitCode === 0 });
      } catch (err) {
        batchResults.push({ file: relPath, success: false, error: err.message });
      }
      console.log('');
    }

    // Print batch summary.
    const passed = batchResults.filter(r => r.success).length;
    const failed = batchResults.length - passed;

    console.log('='.repeat(60));
    console.log(`[midscene-run] Batch Summary:`);
    console.log(`  Total : ${batchResults.length}`);
    console.log(`  Passed: ${passed}`);
    console.log(`  Failed: ${failed}`);

    if (failed > 0) {
      console.log('\n  Failed files:');
      batchResults.filter(r => !r.success).forEach(r => {
        console.log(`    - ${r.file}${r.error ? ': ' + r.error : ''}`);
      });
    }

    console.log('='.repeat(60));
    process.exit(failed > 0 ? 1 : 0);
  }

  // Single file mode.
  const exitCode = processFile(yamlFiles[0], args);
  process.exit(exitCode);
}

// ---------------------------------------------------------------------------
// Process a single YAML file – returns exit code (0 = success)
// ---------------------------------------------------------------------------
function processFile(yamlPath, args) {
  console.log(`[midscene-run] Processing: ${yamlPath}`);

  // -----------------------------------------------------------------------
  // Step 1: Validate
  // -----------------------------------------------------------------------
  const validation = tryValidate(yamlPath);

  if (validation.warnings && validation.warnings.length > 0) {
    console.log('\n  Warnings:');
    validation.warnings.forEach(w => console.log(`    - ${typeof w === 'object' ? w.message : w}`));
  }

  if (args.verbose && validation.warnings && validation.warnings.length === 0) {
    console.log('[midscene-run] No validation warnings.');
  }

  if (!validation.valid) {
    console.error('\n  Validation errors:');
    (validation.errors || []).forEach(e => {
      const msg = typeof e === 'object' ? e.message : e;
      console.error(`    - ${msg}`);
    });
    // Print quick-fix hints for common errors.
    const allMsgs = (validation.errors || []).map(e => typeof e === 'object' ? e.message : String(e)).join(' ');
    printQuickFixHints(allMsgs, '');
    console.error('\n[midscene-run] Validation failed. Aborting.');
    return 1;
  }

  console.log('[midscene-run] Validation passed.');

  // -----------------------------------------------------------------------
  // Step 2: Detect mode
  // -----------------------------------------------------------------------
  const detection = detect(yamlPath);
  console.log(`[midscene-run] Mode: ${detection.mode}`);

  if (detection.features.length > 0) {
    console.log(`[midscene-run] Features: ${detection.features.join(', ')}`);
  }

  if (args.verbose) {
    // Parse YAML to show task/step summary
    try {
      const yaml = require('js-yaml');
      const doc = yaml.load(fs.readFileSync(yamlPath, 'utf-8'));
      const tasks = Array.isArray(doc.tasks) ? doc.tasks : [];
      const totalSteps = tasks.reduce((sum, t) => {
        const flow = Array.isArray(t.flow || t.steps) ? (t.flow || t.steps) : [];
        return sum + flow.length;
      }, 0);
      console.log(`[midscene-run] Tasks: ${tasks.length}, Steps: ${totalSteps}`);
    } catch { /* non-critical */ }
    console.log('-'.repeat(40));
    console.log(`[midscene-run] Timeout: ${args.timeout}ms`);
    console.log(`[midscene-run] Report dir: ${args.reportDir}`);
    if (args.retry > 0) {
      console.log(`[midscene-run] Retry: ${args.retry}`);
    }
    if (detection.mode === 'extended') {
      console.log(`[midscene-run] Template: ${args.template}`);
    }
    console.log('-'.repeat(40));
  }

  // -----------------------------------------------------------------------
  // Step 3: Execute (with retry support)
  // -----------------------------------------------------------------------
  const startTime = Date.now();
  let result;
  let attempts = 0;
  const maxAttempts = 1 + (args.retry || 0);

  while (attempts < maxAttempts) {
    attempts++;
    if (attempts > 1) {
      console.log(`\n[midscene-run] Retry ${attempts - 1}/${args.retry}...`);
    }

    result = executeFile(yamlPath, detection, args);

    // For dry-run, executeFile returns a number (exit code)
    if (typeof result === 'number') return result;

    if (result.success) break;

    if (attempts < maxAttempts) {
      console.log(`[midscene-run] Attempt ${attempts} failed, retrying...`);
      // Brief pause before retry to handle transient failures
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 2000);
    }
  }

  // -----------------------------------------------------------------------
  // Step 4: Parse and display report
  // -----------------------------------------------------------------------
  console.log('\n[midscene-run] Checking reports...');
  const report = reportParser.parse(result.reportDir);

  if (report.found) {
    console.log(`[midscene-run] Report directory: ${report.reportDir}`);
    console.log(`[midscene-run] Report files: ${report.files.length}`);

    if (report.summary) {
      console.log(`\n  Total : ${report.summary.total}`);
      console.log(`  Passed: ${report.summary.passed}`);
      console.log(`  Failed: ${report.summary.failed}`);
      console.log(`  Status: ${report.summary.status}\n`);
    }

    // Display failed task details (always show names + errors; verbose adds extras)
    if (report.failedTasks && report.failedTasks.length > 0) {
      console.log('  Failed tasks:');
      for (const ft of report.failedTasks) {
        console.log(`    - ${ft.name}${ft.error ? ': ' + truncateError(ft.error) : ''}`);
      }
    }

    // Display total duration and extra detail in verbose mode
    if (report.totalDuration && args.verbose) {
      console.log(`  Duration: ${Math.round(report.totalDuration / 1000)}s`);
    }
  } else {
    console.log(`[midscene-run] ${report.message}`);
  }

  // -----------------------------------------------------------------------
  // Step 5: Return exit code
  // -----------------------------------------------------------------------
  if (result.success) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[midscene-run] Done. Execution completed in ${elapsed}s.`);
    return 0;
  } else {
    const errorMsg = truncateError(result.error || 'unknown error');
    console.error(`[midscene-run] Execution failed: ${errorMsg}`);

    // Classify error for additional context (always show category and suggestion)
    let hasClassification = false;
    if (result.error) {
      const { classifyError } = reportParser;
      const classification = classifyError(result.error);
      if (classification.category !== 'unknown') {
        hasClassification = true;
      }
      console.error(`  Error category: ${classification.category} (${classification.severity})`);
      console.error(`  Suggestion: ${classification.suggestion}`);
    }

    // Print quick-fix hints only if classifyError did not produce a known classification (avoid duplicate hints)
    if (!hasClassification) {
      printQuickFixHints('', result.error || '');
    }

    const exitCode = typeof result.exitCode === 'number' ? result.exitCode : 1;
    return exitCode || 1;
  }
}

// ---------------------------------------------------------------------------
// Execute a file (extracted to support retry logic)
// Returns a result object or a number (for dry-run exit code)
// ---------------------------------------------------------------------------
function executeFile(yamlPath, detection, args) {
  // -----------------------------------------------------------------------
  // Native mode – run directly via Midscene CLI
  // -----------------------------------------------------------------------
  if (detection.mode === 'native') {
    if (args.dryRun) {
      try {
        const yaml = require('js-yaml');
        const doc = yaml.load(fs.readFileSync(yamlPath, 'utf-8'));
        const platform = ['web', 'android', 'ios', 'computer'].find(p => doc[p]) || 'unknown';
        const tasks = Array.isArray(doc.tasks) ? doc.tasks : [];
        const totalSteps = tasks.reduce((sum, t) => {
          const flow = Array.isArray(t.flow || t.steps) ? (t.flow || t.steps) : [];
          return sum + flow.length;
        }, 0);
        console.log(`[midscene-run] Dry-run passed: ${tasks.length} task(s), ${totalSteps} step(s), mode: native, platform: ${platform}`);
        console.log('\n  Summary:');
        console.log(`    Platform : ${platform}`);
        console.log(`    Tasks    : ${tasks.length}`);
        tasks.forEach((t, i) => {
          const flowLen = Array.isArray(t.flow || t.steps) ? (t.flow || t.steps).length : 0;
          console.log(`      ${i + 1}. ${t.name || '(unnamed)'} — ${flowLen} steps`);
        });
        console.log('');
      } catch {
        console.warn('[midscene-run] Warning: YAML validation passed but js-yaml could not parse the file. Check for non-standard constructs.');
        const content = fs.readFileSync(yamlPath, 'utf-8');
        console.log('\n--- Native YAML content ---');
        console.log(content);
        console.log('--- End ---\n');
      }
      return 0;
    }

    if (args.verbose) {
      console.log('-'.repeat(40) + ' [subprocess output] ' + '-'.repeat(40));
    }
    console.log('[midscene-run] Running in native mode...');
    const result = nativeRunner.run(yamlPath, {
      reportDir: args.reportDir,
      cwd: path.dirname(yamlPath),
      timeout: args.timeout,
    });
    if (args.verbose) {
      console.log('-'.repeat(40) + ' [end subprocess] ' + '-'.repeat(40));
    }
    return result;
  }

  // -----------------------------------------------------------------------
  // Extended mode – transpile then execute
  // -----------------------------------------------------------------------
  console.log('[midscene-run] Transpiling extended YAML to TypeScript...');

  const transpileResult = tryTranspile(yamlPath, {
    templateType: args.template,
  });

  // tryTranspile returns { error } on exception, { code } on success.
  if (transpileResult.error) {
    console.error(`[midscene-run] ${transpileResult.error}`);
    return { success: false, error: transpileResult.error, reportDir: args.reportDir };
  }

  const tsCode = transpileResult.code;

  // Display transpiler warnings prominently
  if (transpileResult.warnings && transpileResult.warnings.length > 0) {
    console.warn('\n  [WARN] Transpiler warnings:');
    transpileResult.warnings.forEach(w => console.warn(`    [WARN] ${w}`));
  }

  if (typeof tsCode !== 'string') {
    const err = 'Transpiler did not return a valid TypeScript string.';
    console.error('[midscene-run] ' + err);
    return { success: false, error: err, reportDir: args.reportDir };
  }

  // Save TS output if requested
  if (args.outputTs) {
    const outputTsPath = path.resolve(args.outputTs);
    fs.mkdirSync(path.dirname(outputTsPath), { recursive: true });
    fs.writeFileSync(outputTsPath, tsCode, 'utf-8');
    console.log(`[midscene-run] TypeScript saved to: ${outputTsPath}`);
  }

  // Dry-run: just show the generated code
  if (args.dryRun) {
    console.log('\n--- Generated TypeScript ---');
    console.log(tsCode);
    console.log('--- End ---\n');
    return 0;
  }

  if (args.verbose) {
    console.log('-'.repeat(40) + ' [subprocess output] ' + '-'.repeat(40));
  }
  console.log('[midscene-run] Running transpiled TypeScript...');
  const result = tsRunner.run(tsCode, {
    reportDir: args.reportDir,
    cwd: path.dirname(yamlPath),
    timeout: args.timeout,
    keepTs: !!args.outputTs,
  });
  if (args.verbose) {
    console.log('-'.repeat(40) + ' [end subprocess] ' + '-'.repeat(40));
  }
  return result;
}

// Export parseArgs and resolveYamlFiles for testability; run main() only when executed directly.
module.exports = { parseArgs, resolveYamlFiles };

if (require.main === module) {
  main();
}
