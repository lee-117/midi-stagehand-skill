'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');

// ---------------------------------------------------------------------------
// report-parser tests (does not require external tools)
// ---------------------------------------------------------------------------
const reportParser = require('../src/runner/report-parser');

const tmpDir = path.join(__dirname, '.tmp-test-reports');

function setupTmpDir() {
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
}

function cleanupTmpDir() {
  if (fs.existsSync(tmpDir)) {
    fs.readdirSync(tmpDir).forEach(f => fs.unlinkSync(path.join(tmpDir, f)));
    fs.rmdirSync(tmpDir);
  }
}

describe('Report Parser', () => {
  beforeEach(() => setupTmpDir());
  afterEach(() => cleanupTmpDir());

  it('returns found:false for non-existent directory', () => {
    const result = reportParser.parse('/non/existent/path');
    assert.equal(result.found, false);
    assert.ok(result.message.includes('not found'));
  });

  it('returns found:false for empty directory', () => {
    const result = reportParser.parse(tmpDir);
    assert.equal(result.found, false);
    assert.ok(result.message.includes('No report files'));
  });

  it('parses JSON report with array format', () => {
    const report = [
      { status: 'passed', name: 'task1' },
      { status: 'passed', name: 'task2' },
      { status: 'failed', name: 'task3' },
    ];
    fs.writeFileSync(path.join(tmpDir, 'report.json'), JSON.stringify(report));

    const result = reportParser.parse(tmpDir);
    assert.equal(result.found, true);
    assert.equal(result.files.length, 1);
    assert.ok(result.summary);
    assert.equal(result.summary.total, 3);
    assert.equal(result.summary.passed, 2);
    assert.equal(result.summary.failed, 1);
    assert.equal(result.summary.status, 'HAS FAILURES');
  });

  it('parses JSON report with tasks object format', () => {
    const report = {
      tasks: [
        { status: 'passed', name: 'task1' },
        { status: 'passed', name: 'task2' },
      ],
    };
    fs.writeFileSync(path.join(tmpDir, 'report.json'), JSON.stringify(report));

    const result = reportParser.parse(tmpDir);
    assert.equal(result.found, true);
    assert.equal(result.summary.total, 2);
    assert.equal(result.summary.passed, 2);
    assert.equal(result.summary.failed, 0);
    assert.equal(result.summary.status, 'ALL PASSED');
  });

  it('parses JSON report with success boolean format', () => {
    const report = [
      { success: true, name: 'task1' },
      { success: false, name: 'task2' },
    ];
    fs.writeFileSync(path.join(tmpDir, 'report.json'), JSON.stringify(report));

    const result = reportParser.parse(tmpDir);
    assert.equal(result.summary.total, 2);
    assert.equal(result.summary.passed, 1);
    assert.equal(result.summary.failed, 1);
  });

  it('handles malformed JSON gracefully', () => {
    fs.writeFileSync(path.join(tmpDir, 'bad.json'), '{not valid json');

    const result = reportParser.parse(tmpDir);
    assert.equal(result.found, true);
    assert.equal(result.files.length, 1);
    assert.equal(result.files[0].error, 'Parse error');
  });

  it('detects HTML report files', () => {
    fs.writeFileSync(path.join(tmpDir, 'report.html'), '<html></html>');

    const result = reportParser.parse(tmpDir);
    assert.equal(result.found, true);
    assert.equal(result.files.length, 1);
    assert.equal(result.files[0].type, 'html');
  });

  it('handles mixed JSON and HTML files', () => {
    const report = [{ status: 'passed', name: 'task1' }];
    fs.writeFileSync(path.join(tmpDir, 'report.json'), JSON.stringify(report));
    fs.writeFileSync(path.join(tmpDir, 'report.html'), '<html></html>');

    const result = reportParser.parse(tmpDir);
    assert.equal(result.found, true);
    assert.equal(result.files.length, 2);
  });

  it('aggregates summaries from multiple JSON reports', () => {
    const report1 = [{ status: 'passed' }, { status: 'passed' }];
    const report2 = [{ status: 'passed' }, { status: 'failed' }];
    fs.writeFileSync(path.join(tmpDir, 'report1.json'), JSON.stringify(report1));
    fs.writeFileSync(path.join(tmpDir, 'report2.json'), JSON.stringify(report2));

    const result = reportParser.parse(tmpDir);
    assert.equal(result.summary.total, 4);
    assert.equal(result.summary.passed, 3);
    assert.equal(result.summary.failed, 1);
  });

  it('returns null summary when only HTML files exist', () => {
    fs.writeFileSync(path.join(tmpDir, 'report.html'), '<html></html>');

    const result = reportParser.parse(tmpDir);
    assert.equal(result.summary, null);
  });

  it('handles unknown JSON format', () => {
    fs.writeFileSync(path.join(tmpDir, 'report.json'), JSON.stringify({ key: 'value' }));

    const result = reportParser.parse(tmpDir);
    assert.equal(result.found, true);
    // Should still be parseable, just with raw summary
    assert.equal(result.files[0].type, 'json');
  });

  it('includes resolved reportDir in result', () => {
    const report = [{ status: 'passed' }];
    fs.writeFileSync(path.join(tmpDir, 'report.json'), JSON.stringify(report));

    const result = reportParser.parse(tmpDir);
    assert.equal(result.reportDir, path.resolve(tmpDir));
  });
});

// ---------------------------------------------------------------------------
// native-runner module interface tests
// ---------------------------------------------------------------------------
const nativeRunner = require('../src/runner/native-runner');

describe('Native Runner', () => {
  it('exports a run function', () => {
    assert.equal(typeof nativeRunner.run, 'function');
  });

  it('returns error for missing yamlPath', () => {
    const result = nativeRunner.run(null);
    assert.equal(result.success, false);
    assert.ok(result.error.includes('required'));
  });

  it('returns error for non-existent YAML file', () => {
    const result = nativeRunner.run('/non/existent/file.yaml');
    assert.equal(result.success, false);
    assert.ok(result.error.includes('not found'));
  });

  it('returns error for non-yaml extension', () => {
    const result = nativeRunner.run(__filename); // .js file
    assert.equal(result.success, false);
    assert.ok(result.error.includes('.yaml'));
  });
});

// ---------------------------------------------------------------------------
// ts-runner module interface tests
// ---------------------------------------------------------------------------
const tsRunner = require('../src/runner/ts-runner');

describe('TS Runner', () => {
  it('exports a run function', () => {
    assert.equal(typeof tsRunner.run, 'function');
  });

  it('returns error for empty code without tsPath', () => {
    const result = tsRunner.run('', {});
    assert.equal(result.success, false);
    assert.ok(result.error.includes('required'));
  });

  it('returns error for non-existent tsPath', () => {
    const result = tsRunner.run(null, { tsPath: '/non/existent/file.ts' });
    assert.equal(result.success, false);
    assert.ok(result.error.includes('not found'));
  });
});

// ---------------------------------------------------------------------------
// CLI argument parsing tests (extracted logic)
// ---------------------------------------------------------------------------
describe('CLI Argument Parsing', () => {
  // Import the real parseArgs from the CLI script.
  const { parseArgs } = require('../scripts/midscene-run');

  it('parses basic yaml file path', () => {
    const args = parseArgs(['node', 'script', 'test.yaml']);
    assert.equal(args.yamlPath, 'test.yaml');
    assert.equal(args.dryRun, false);
    assert.equal(args.help, false);
  });

  it('parses --dry-run flag', () => {
    const args = parseArgs(['node', 'script', 'test.yaml', '--dry-run']);
    assert.equal(args.yamlPath, 'test.yaml');
    assert.equal(args.dryRun, true);
  });

  it('parses --help flag', () => {
    const args = parseArgs(['node', 'script', '--help']);
    assert.equal(args.help, true);
  });

  it('parses -h shorthand', () => {
    const args = parseArgs(['node', 'script', '-h']);
    assert.equal(args.help, true);
  });

  it('parses --timeout option', () => {
    const args = parseArgs(['node', 'script', 'test.yaml', '--timeout', '600000']);
    assert.equal(args.timeout, 600000);
  });

  it('parses --output-ts option', () => {
    const args = parseArgs(['node', 'script', 'test.yaml', '--output-ts', './out.ts']);
    assert.equal(args.outputTs, './out.ts');
  });

  it('parses --report-dir option', () => {
    const args = parseArgs(['node', 'script', 'test.yaml', '--report-dir', './reports']);
    assert.equal(args.reportDir, './reports');
  });

  it('parses --template option', () => {
    const args = parseArgs(['node', 'script', 'test.yaml', '--template', 'playwright']);
    assert.equal(args.template, 'playwright');
  });

  it('parses all options combined', () => {
    const args = parseArgs([
      'node', 'script', 'flow.yaml',
      '--dry-run',
      '--output-ts', './gen.ts',
      '--report-dir', './my-reports',
      '--template', 'playwright',
      '--timeout', '600000',
      '--verbose',
    ]);
    assert.equal(args.yamlPath, 'flow.yaml');
    assert.equal(args.dryRun, true);
    assert.equal(args.outputTs, './gen.ts');
    assert.equal(args.reportDir, './my-reports');
    assert.equal(args.template, 'playwright');
    assert.equal(args.timeout, 600000);
    assert.equal(args.verbose, true);
  });

  it('parses --verbose flag', () => {
    const args = parseArgs(['node', 'script', 'test.yaml', '--verbose']);
    assert.equal(args.verbose, true);
  });

  it('parses -v shorthand for verbose', () => {
    const args = parseArgs(['node', 'script', 'test.yaml', '-v']);
    assert.equal(args.verbose, true);
  });

  it('parses --version flag', () => {
    const args = parseArgs(['node', 'script', '--version']);
    assert.equal(args.version, true);
  });

  it('parses -V shorthand for version', () => {
    const args = parseArgs(['node', 'script', '-V']);
    assert.equal(args.version, true);
  });

  it('uses default values when no options given', () => {
    const args = parseArgs(['node', 'script', 'test.yaml']);
    assert.equal(args.dryRun, false);
    assert.equal(args.outputTs, null);
    assert.equal(args.reportDir, './midscene-report');
    assert.equal(args.template, 'puppeteer');
    assert.equal(args.timeout, 300000);
    assert.equal(args.verbose, false);
    assert.equal(args.version, false);
    assert.equal(args.help, false);
  });

  it('returns null yamlPath when no file given', () => {
    const args = parseArgs(['node', 'script', '--dry-run']);
    assert.equal(args.yamlPath, null);
  });
});

// ---------------------------------------------------------------------------
// CLI glob resolution tests (using real resolveYamlFiles from midscene-run.js)
// ---------------------------------------------------------------------------
describe('CLI Glob Resolution', () => {
  const globTmpDir = path.join(__dirname, '.tmp-glob-test');
  const { resolveYamlFiles } = require('../scripts/midscene-run');

  beforeEach(() => {
    fs.mkdirSync(globTmpDir, { recursive: true });
    fs.writeFileSync(path.join(globTmpDir, 'a.yaml'), 'engine: native\n');
    fs.writeFileSync(path.join(globTmpDir, 'b.yml'), 'engine: native\n');
    fs.writeFileSync(path.join(globTmpDir, 'c.yaml'), 'engine: extended\n');
    fs.writeFileSync(path.join(globTmpDir, 'readme.txt'), 'not yaml\n');
  });

  afterEach(() => {
    if (fs.existsSync(globTmpDir)) {
      fs.readdirSync(globTmpDir).forEach(f => fs.unlinkSync(path.join(globTmpDir, f)));
      fs.rmdirSync(globTmpDir);
    }
  });

  it('resolves single file path', () => {
    const result = resolveYamlFiles(path.join(globTmpDir, 'a.yaml'));
    assert.equal(result.length, 1);
    assert.ok(result[0].endsWith('a.yaml'));
  });

  it('returns empty for non-existent single file', () => {
    const result = resolveYamlFiles(path.join(globTmpDir, 'nonexistent.yaml'));
    assert.equal(result.length, 0);
  });

  it('resolves glob *.yaml pattern', () => {
    const result = resolveYamlFiles(path.join(globTmpDir, '*.yaml'));
    assert.equal(result.length, 2);
    assert.ok(result[0].endsWith('a.yaml'));
    assert.ok(result[1].endsWith('c.yaml'));
  });

  it('resolves glob *.yml pattern', () => {
    const result = resolveYamlFiles(path.join(globTmpDir, '*.yml'));
    assert.equal(result.length, 1);
    assert.ok(result[0].endsWith('b.yml'));
  });

  it('filters out non-yaml files from glob', () => {
    const result = resolveYamlFiles(path.join(globTmpDir, '*'));
    // Should only include .yaml and .yml files, not .txt
    assert.equal(result.length, 3);
    result.forEach(f => {
      const ext = path.extname(f).toLowerCase();
      assert.ok(ext === '.yaml' || ext === '.yml', `Expected yaml/yml extension but got ${ext}`);
    });
  });

  it('returns empty array for glob with no matches', () => {
    const result = resolveYamlFiles(path.join(globTmpDir, '*.json'));
    assert.equal(result.length, 0);
  });

  it('returns sorted results', () => {
    const result = resolveYamlFiles(path.join(globTmpDir, '*'));
    for (let i = 1; i < result.length; i++) {
      assert.ok(result[i] >= result[i - 1], 'Results should be sorted');
    }
  });
});

describe('CLI Validator Path', () => {
  it('yaml-validator.js exists at expected path', () => {
    const validatorPath = path.resolve(__dirname, '../src/validator/yaml-validator.js');
    assert.ok(fs.existsSync(validatorPath),
      'yaml-validator.js should exist at src/validator/yaml-validator.js');
  });

  it('validator exports a validate function', () => {
    const validator = require('../src/validator/yaml-validator');
    assert.ok(typeof validator.validate === 'function',
      'Validator should export a validate function');
  });
});

// ---------------------------------------------------------------------------
// classifyError tests
// ---------------------------------------------------------------------------
describe('classifyError', () => {
  const { classifyError } = reportParser;

  it('classifies API key errors', () => {
    const result = classifyError('MIDSCENE_MODEL_API_KEY is not set');
    assert.equal(result.category, 'api_key');
    assert.equal(result.severity, 'fatal');
    assert.ok(result.suggestion.includes('MIDSCENE_MODEL_API_KEY'));
  });

  it('classifies 401 as api_key', () => {
    const result = classifyError('Request failed with status 401');
    assert.equal(result.category, 'api_key');
  });

  it('classifies timeout errors', () => {
    const result = classifyError('Operation timed out after 30000ms');
    assert.equal(result.category, 'timeout');
    assert.equal(result.severity, 'recoverable');
    assert.ok(result.suggestion.includes('timeout'));
  });

  it('classifies ETIMEDOUT as timeout', () => {
    const result = classifyError('connect ETIMEDOUT 192.168.1.1:443');
    assert.equal(result.category, 'timeout');
  });

  it('classifies element not found errors', () => {
    const result = classifyError('Element not found: login button');
    assert.equal(result.category, 'element_not_found');
    assert.equal(result.severity, 'recoverable');
    assert.ok(result.suggestion.includes('deepThink'));
  });

  it('classifies "cannot find" as element_not_found', () => {
    const result = classifyError('Cannot find the submit button on the page');
    assert.equal(result.category, 'element_not_found');
  });

  it('classifies assertion failures', () => {
    const result = classifyError('Assertion failed: expected "logged in" but got "login page"');
    assert.equal(result.category, 'assertion');
    assert.equal(result.severity, 'recoverable');
  });

  it('classifies navigation errors', () => {
    const result = classifyError('net::ERR_NAME_NOT_RESOLVED');
    assert.equal(result.category, 'navigation');
    assert.equal(result.severity, 'recoverable');
    assert.ok(result.suggestion.includes('URL'));
  });

  it('classifies ERR_CONNECTION_REFUSED as navigation', () => {
    const result = classifyError('net::ERR_CONNECTION_REFUSED at http://localhost:3000');
    assert.equal(result.category, 'navigation');
  });

  it('classifies transpiler errors', () => {
    const result = classifyError('Syntax error: unexpected token at line 15');
    assert.equal(result.category, 'transpiler');
    assert.equal(result.severity, 'fatal');
  });

  it('classifies permission errors', () => {
    const result = classifyError('EACCES: permission denied, open /etc/passwd');
    assert.equal(result.category, 'permission');
    assert.equal(result.severity, 'fatal');
  });

  it('classifies JavaScript errors', () => {
    const result = classifyError('ReferenceError: foo is not defined');
    assert.equal(result.category, 'javascript');
    assert.equal(result.severity, 'recoverable');
  });

  it('classifies TypeError as javascript', () => {
    const result = classifyError('TypeError: Cannot read properties of undefined');
    assert.equal(result.category, 'javascript');
  });

  it('returns unknown for unrecognized errors', () => {
    const result = classifyError('Something completely unexpected happened');
    assert.equal(result.category, 'unknown');
    assert.equal(result.severity, 'recoverable');
    assert.ok(result.suggestion.includes('full error output'));
  });

  it('returns unknown for null input', () => {
    const result = classifyError(null);
    assert.equal(result.category, 'unknown');
  });

  it('returns unknown for undefined input', () => {
    const result = classifyError(undefined);
    assert.equal(result.category, 'unknown');
  });

  it('returns unknown for empty string', () => {
    const result = classifyError('');
    assert.equal(result.category, 'unknown');
  });

  it('returns unknown for non-string input', () => {
    const result = classifyError(42);
    assert.equal(result.category, 'unknown');
  });

  it('result has category, suggestion, and severity keys', () => {
    const result = classifyError('any error');
    assert.ok('category' in result);
    assert.ok('suggestion' in result);
    assert.ok('severity' in result);
  });
});

// ---------------------------------------------------------------------------
// extractTaskDetails tests (via report-parser.parse)
// ---------------------------------------------------------------------------
describe('Report Parser — detailed extraction', () => {
  beforeEach(() => setupTmpDir());
  afterEach(() => cleanupTmpDir());

  it('extracts failedTasks with error details', () => {
    const report = [
      { status: 'passed', name: 'task1' },
      { status: 'failed', name: 'task2', error: 'Element not found', failedStep: 'aiTap', screenshotPath: '/tmp/shot.png' },
    ];
    fs.writeFileSync(path.join(tmpDir, 'report.json'), JSON.stringify(report));

    const result = reportParser.parse(tmpDir);
    assert.equal(result.failedTasks.length, 1);
    assert.equal(result.failedTasks[0].name, 'task2');
    assert.equal(result.failedTasks[0].error, 'Element not found');
    assert.equal(result.failedTasks[0].failedStep, 'aiTap');
    assert.equal(result.failedTasks[0].screenshotPath, '/tmp/shot.png');
  });

  it('extracts taskDetails with name, status, duration, stepCount', () => {
    const report = [
      { status: 'passed', name: 'Login', duration: 5000, flow: [{}, {}, {}] },
      { status: 'failed', name: 'Checkout', duration: 3000, flow: [{}, {}] },
    ];
    fs.writeFileSync(path.join(tmpDir, 'report.json'), JSON.stringify(report));

    const result = reportParser.parse(tmpDir);
    assert.equal(result.taskDetails.length, 2);
    assert.equal(result.taskDetails[0].name, 'Login');
    assert.equal(result.taskDetails[0].status, 'passed');
    assert.equal(result.taskDetails[0].duration, 5000);
    assert.equal(result.taskDetails[0].stepCount, 3);
    assert.equal(result.taskDetails[1].name, 'Checkout');
    assert.equal(result.taskDetails[1].status, 'failed');
    assert.equal(result.taskDetails[1].stepCount, 2);
  });

  it('extracts aiQueryResults from task output', () => {
    const report = [
      { status: 'passed', name: 'task1', output: { title: 'Hello World', count: 42 } },
    ];
    fs.writeFileSync(path.join(tmpDir, 'report.json'), JSON.stringify(report));

    const result = reportParser.parse(tmpDir);
    assert.ok(result.aiQueryResults);
    assert.equal(result.aiQueryResults.title, 'Hello World');
    assert.equal(result.aiQueryResults.count, 42);
  });

  it('extracts aiQueryResults from task results', () => {
    const report = [
      { status: 'passed', name: 'task1', results: { price: '$9.99' } },
    ];
    fs.writeFileSync(path.join(tmpDir, 'report.json'), JSON.stringify(report));

    const result = reportParser.parse(tmpDir);
    assert.ok(result.aiQueryResults);
    assert.equal(result.aiQueryResults.price, '$9.99');
  });

  it('computes totalDuration from task durations', () => {
    const report = [
      { status: 'passed', name: 'task1', duration: 2000 },
      { status: 'passed', name: 'task2', duration: 3500 },
    ];
    fs.writeFileSync(path.join(tmpDir, 'report.json'), JSON.stringify(report));

    const result = reportParser.parse(tmpDir);
    assert.equal(result.totalDuration, 5500);
  });

  it('returns htmlReports list when HTML files exist', () => {
    const report = [{ status: 'passed', name: 'task1' }];
    fs.writeFileSync(path.join(tmpDir, 'report.json'), JSON.stringify(report));
    fs.writeFileSync(path.join(tmpDir, 'report.html'), '<html></html>');
    fs.writeFileSync(path.join(tmpDir, 'details.html'), '<html></html>');

    const result = reportParser.parse(tmpDir);
    assert.ok(Array.isArray(result.htmlReports));
    assert.equal(result.htmlReports.length, 2);
  });

  it('returns undefined htmlReports when no HTML files', () => {
    const report = [{ status: 'passed', name: 'task1' }];
    fs.writeFileSync(path.join(tmpDir, 'report.json'), JSON.stringify(report));

    const result = reportParser.parse(tmpDir);
    assert.equal(result.htmlReports, undefined);
  });

  it('returns undefined aiQueryResults when no query output', () => {
    const report = [{ status: 'passed', name: 'task1' }];
    fs.writeFileSync(path.join(tmpDir, 'report.json'), JSON.stringify(report));

    const result = reportParser.parse(tmpDir);
    assert.equal(result.aiQueryResults, undefined);
  });

  it('handles tasks with success boolean and errorMessage', () => {
    const report = [
      { success: false, name: 'broken', errorMessage: 'Crash', screenshot: '/tmp/crash.png' },
    ];
    fs.writeFileSync(path.join(tmpDir, 'report.json'), JSON.stringify(report));

    const result = reportParser.parse(tmpDir);
    assert.equal(result.failedTasks.length, 1);
    assert.equal(result.failedTasks[0].error, 'Crash');
    assert.equal(result.failedTasks[0].screenshotPath, '/tmp/crash.png');
  });

  it('handles unnamed tasks gracefully', () => {
    const report = [{ status: 'failed' }];
    fs.writeFileSync(path.join(tmpDir, 'report.json'), JSON.stringify(report));

    const result = reportParser.parse(tmpDir);
    assert.equal(result.failedTasks[0].name, '(unnamed)');
    assert.equal(result.taskDetails[0].name, '(unnamed)');
  });

  it('aggregates details from multiple JSON reports', () => {
    const report1 = [
      { status: 'passed', name: 'r1-t1', duration: 1000, output: { key1: 'a' } },
    ];
    const report2 = [
      { status: 'failed', name: 'r2-t1', duration: 2000, error: 'fail' },
    ];
    fs.writeFileSync(path.join(tmpDir, 'report1.json'), JSON.stringify(report1));
    fs.writeFileSync(path.join(tmpDir, 'report2.json'), JSON.stringify(report2));

    const result = reportParser.parse(tmpDir);
    assert.equal(result.taskDetails.length, 2);
    assert.equal(result.failedTasks.length, 1);
    assert.equal(result.totalDuration, 3000);
    assert.ok(result.aiQueryResults);
    assert.equal(result.aiQueryResults.key1, 'a');
  });
});

// ---------------------------------------------------------------------------
// CLI --retry and --clean parsing tests
// ---------------------------------------------------------------------------
describe('CLI --retry and --clean parsing', () => {
  const { parseArgs } = require('../scripts/midscene-run');

  it('parses --retry flag with value', () => {
    const args = parseArgs(['node', 'script', 'test.yaml', '--retry', '3']);
    assert.equal(args.retry, 3);
  });

  it('defaults retry to 0', () => {
    const args = parseArgs(['node', 'script', 'test.yaml']);
    assert.equal(args.retry, 0);
  });

  it('parses --clean flag', () => {
    const args = parseArgs(['node', 'script', '--clean']);
    assert.equal(args.clean, true);
  });

  it('defaults clean to false', () => {
    const args = parseArgs(['node', 'script', 'test.yaml']);
    assert.equal(args.clean, false);
  });

  it('parses --retry and --clean together', () => {
    const args = parseArgs(['node', 'script', 'test.yaml', '--retry', '2', '--clean']);
    assert.equal(args.retry, 2);
    assert.equal(args.clean, true);
  });
});
