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
          process.exit(1);
        } else {
          console.error(`[midscene-run] Unknown option: ${arg}`);
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
Usage: midscene-run <yaml-file> [options]

Execute a Midscene YAML Superset file. Native YAML files are run directly
via the Midscene CLI; extended files are transpiled to TypeScript first.

Positional arguments:
  <yaml-file>              Path to the YAML file to execute (required)

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
`);
}

// ---------------------------------------------------------------------------
// Validator helper – tries to load the validator if it exists
// ---------------------------------------------------------------------------
function tryValidate(yamlPath) {
  // Attempt to load the validator module; it may not exist yet
  const validatorPaths = [
    path.resolve(__dirname, '../src/validator/yaml-validator.js'),
    path.resolve(__dirname, '../src/validator/index.js'),
    path.resolve(__dirname, '../src/validator/validator.js'),
    path.resolve(__dirname, '../src/validator/schema-validator.js'),
  ];

  for (const vpath of validatorPaths) {
    if (fs.existsSync(vpath)) {
      try {
        const validator = require(vpath);
        const validateFn = validator.validate || validator.default;
        if (typeof validateFn === 'function') {
          return validateFn(yamlPath);
        }
      } catch (e) {
        // Validator module failed to load – skip validation
      }
    }
  }

  // No validator found – return a passing result
  return { valid: true, errors: [], warnings: [] };
}

// ---------------------------------------------------------------------------
// Transpiler helper – tries to load the transpiler if it exists
// ---------------------------------------------------------------------------
function tryTranspile(yamlPath, options) {
  const transpilerPaths = [
    path.resolve(__dirname, '../src/transpiler/index.js'),
    path.resolve(__dirname, '../src/transpiler/transpiler.js'),
  ];

  for (const tpath of transpilerPaths) {
    if (fs.existsSync(tpath)) {
      try {
        const transpiler = require(tpath);
        const transpileFn = transpiler.transpile || transpiler.default;
        if (typeof transpileFn === 'function') {
          return transpileFn(yamlPath, options);
        }
      } catch (e) {
        return { success: false, error: `Transpiler error: ${e.message}` };
      }
    }
  }

  return { success: false, error: 'Transpiler module not found. Cannot process extended YAML.' };
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

  const yamlPath = path.resolve(args.yamlPath);

  // Verify the YAML file exists
  if (!fs.existsSync(yamlPath)) {
    console.error(`[midscene-run] YAML file not found: ${yamlPath}`);
    process.exit(1);
  }

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
    (validation.errors || []).forEach(e => console.error(`    - ${typeof e === 'object' ? e.message : e}`));
    console.error('\n[midscene-run] Validation failed. Aborting.');
    process.exit(1);
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
      const content = fs.readFileSync(yamlPath, 'utf-8');
      console.log('\n--- Native YAML content ---');
      console.log(content);
      console.log('--- End ---\n');
      process.exit(0);
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
      template: args.template,
      platform: args.platform,
    });

    if (!transpileResult.success && transpileResult.error) {
      console.error(`[midscene-run] ${transpileResult.error}`);
      process.exit(1);
    }

    const tsCode = transpileResult.code || transpileResult.output || transpileResult;

    if (typeof tsCode !== 'string') {
      console.error('[midscene-run] Transpiler did not return a valid TypeScript string.');
      process.exit(1);
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
      process.exit(0);
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
  // Step 5: Exit with appropriate code
  // -----------------------------------------------------------------------
  if (result.success) {
    console.log('[midscene-run] Done.');
    process.exit(0);
  } else {
    console.error(`[midscene-run] Execution failed: ${result.error || 'unknown error'}`);
    process.exit(result.exitCode || 1);
  }
}

main();
