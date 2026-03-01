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

// ---------------------------------------------------------------------------
// Argument parsing (no external dependencies)
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const args = {
    yamlPath: null,
    platform: null,
    dryRun: false,
    outputTs: null,
    reportDir: './midscene-report',
    template: 'puppeteer',
    help: false,
  };

  const rawArgs = argv.slice(2); // skip node + script path

  for (let i = 0; i < rawArgs.length; i++) {
    const arg = rawArgs[i];

    switch (arg) {
      case '--help':
      case '-h':
        args.help = true;
        break;

      case '--platform':
        args.platform = rawArgs[++i];
        break;

      case '--dry-run':
        args.dryRun = true;
        break;

      case '--output-ts':
        args.outputTs = rawArgs[++i];
        break;

      case '--report-dir':
        args.reportDir = rawArgs[++i];
        break;

      case '--template':
        args.template = rawArgs[++i];
        break;

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
  --platform <target>      Target platform: web | android | ios | computer
                           (auto-detected from YAML if omitted)
  --dry-run                Transpile only; do not execute
  --output-ts <path>       Save the generated TypeScript file to <path>
  --report-dir <path>      Directory for Midscene reports
                           (default: ./midscene-report)
  --template <name>        Boilerplate template: puppeteer | playwright
                           (default: puppeteer)
  --help, -h               Show this help message

Examples:
  midscene-run tests/login.yaml
  midscene-run tests/checkout.yaml --platform web --template playwright
  midscene-run tests/extended.yaml --dry-run --output-ts ./generated.ts
  midscene-run "tests/**/*.yaml"             # batch: run all YAML files
  midscene-run "tests/smoke-*.yaml"          # batch: run matching files
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
    const matched = fs.globSync(inputPath, { cwd: process.cwd() })
      .map(f => path.resolve(f))
      .filter(f => {
        const ext = path.extname(f).toLowerCase();
        return ext === '.yaml' || ext === '.yml';
      })
      .sort();

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
// Main
// ---------------------------------------------------------------------------
function main() {
  const args = parseArgs(process.argv);

  // Show help if requested or no arguments provided
  if (args.help || !args.yamlPath) {
    showHelp();
    process.exit(args.help ? 0 : 1);
  }

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

  if (!validation.valid) {
    console.error('\n  Validation errors:');
    (validation.errors || []).forEach(e => {
      const msg = typeof e === 'object' ? e.message : e;
      console.error(`    - ${msg}`);
    });
    // Print quick-fix hints for common errors.
    const allMsgs = (validation.errors || []).map(e => typeof e === 'object' ? e.message : String(e)).join(' ');
    if (/syntax|parse/i.test(allMsgs)) {
      console.error('\n  Hint: Check YAML indentation (use 2 spaces, not tabs) and ensure proper quoting of special characters.');
    }
    if (/platform config/i.test(allMsgs)) {
      console.error('  Hint: Add a platform key at the top level, e.g. web: { url: "https://example.com" }');
    }
    if (/tasks/i.test(allMsgs) && /required|missing|must/i.test(allMsgs)) {
      console.error('  Hint: Add a "tasks" array with at least one task containing "name" and "flow".');
    }
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

  let result;

  // -----------------------------------------------------------------------
  // Step 3a: Native mode – run directly via Midscene CLI
  // -----------------------------------------------------------------------
  if (detection.mode === 'native') {
    if (args.dryRun) {
      console.log('[midscene-run] Dry-run: native YAML requires no transpilation.');
      try {
        const yaml = require('js-yaml');
        const doc = yaml.load(fs.readFileSync(yamlPath, 'utf-8'));
        const platform = ['web', 'android', 'ios', 'computer'].find(p => doc[p]) || 'unknown';
        const tasks = Array.isArray(doc.tasks) ? doc.tasks : [];
        console.log('\n  Summary:');
        console.log(`    Platform : ${platform}`);
        console.log(`    Tasks    : ${tasks.length}`);
        tasks.forEach((t, i) => {
          const flowLen = Array.isArray(t.flow || t.steps) ? (t.flow || t.steps).length : 0;
          console.log(`      ${i + 1}. ${t.name || '(unnamed)'} — ${flowLen} steps`);
        });
        console.log('');
      } catch (_e) {
        // Fallback: just print raw content
        const content = fs.readFileSync(yamlPath, 'utf-8');
        console.log('\n--- Native YAML content ---');
        console.log(content);
        console.log('--- End ---\n');
      }
      return 0;
    }

    console.log('[midscene-run] Running in native mode...');
    result = nativeRunner.run(yamlPath, {
      reportDir: args.reportDir,
      cwd: path.dirname(yamlPath),
    });

  // -----------------------------------------------------------------------
  // Step 3b: Extended mode – transpile then execute
  // -----------------------------------------------------------------------
  } else {
    console.log('[midscene-run] Transpiling extended YAML to TypeScript...');

    const transpileResult = tryTranspile(yamlPath, {
      templateType: args.template,
    });

    // tryTranspile returns { error } on exception, { code } on success.
    if (transpileResult.error) {
      console.error(`[midscene-run] ${transpileResult.error}`);
      return 1;
    }

    const tsCode = transpileResult.code;

    // Display transpiler warnings if any
    if (transpileResult.warnings && transpileResult.warnings.length > 0) {
      console.log('\n  Transpiler warnings:');
      transpileResult.warnings.forEach(w => console.log(`    - ${w}`));
    }

    if (typeof tsCode !== 'string') {
      console.error('[midscene-run] Transpiler did not return a valid TypeScript string.');
      return 1;
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

    console.log('[midscene-run] Running transpiled TypeScript...');
    result = tsRunner.run(tsCode, {
      reportDir: args.reportDir,
      keepTs: !!args.outputTs,
    });
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
  } else {
    console.log(`[midscene-run] ${report.message}`);
  }

  // -----------------------------------------------------------------------
  // Step 5: Return exit code
  // -----------------------------------------------------------------------
  if (result.success) {
    console.log('[midscene-run] Done.');
    return 0;
  } else {
    console.error(`[midscene-run] Execution failed: ${result.error || 'unknown error'}`);
    return result.exitCode || 1;
  }
}

// Export parseArgs for testability; run main() only when executed directly.
module.exports = { parseArgs };

if (require.main === module) {
  main();
}
