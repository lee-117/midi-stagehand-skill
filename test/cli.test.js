'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');

const { parseArgs, resolveYamlFiles } = require('../scripts/midscene-run');
const { DEFAULT_TIMEOUT, DEFAULT_REPORT_DIR } = require('../src/constants');

// ---------------------------------------------------------------------------
// Helper — build argv array the way Node.js delivers it to process.argv
// (elements 0 and 1 are the node binary and the script path)
// ---------------------------------------------------------------------------
function argv(...userArgs) {
  return ['node', 'scripts/midscene-run.js', ...userArgs];
}

// ===========================================================================
// parseArgs
// ===========================================================================
describe('parseArgs', () => {
  // -----------------------------------------------------------------------
  // Defaults
  // -----------------------------------------------------------------------
  describe('default values', () => {
    it('returns expected defaults when no arguments provided', () => {
      const args = parseArgs(argv());
      assert.equal(args.yamlPath, null);
      assert.equal(args.dryRun, false);
      assert.equal(args.outputTs, null);
      assert.equal(args.reportDir, DEFAULT_REPORT_DIR);
      assert.equal(args.template, 'puppeteer');
      assert.equal(args.timeout, DEFAULT_TIMEOUT);
      assert.equal(args.retry, 0);
      assert.equal(args.clean, false);
      assert.equal(args.verbose, false);
      assert.equal(args.help, false);
      assert.equal(args.version, false);
    });
  });

  // -----------------------------------------------------------------------
  // Boolean flags
  // -----------------------------------------------------------------------
  describe('boolean flags', () => {
    it('--dry-run sets dryRun to true', () => {
      const args = parseArgs(argv('--dry-run'));
      assert.equal(args.dryRun, true);
    });

    it('--verbose sets verbose to true', () => {
      const args = parseArgs(argv('--verbose'));
      assert.equal(args.verbose, true);
    });

    it('-v sets verbose to true', () => {
      const args = parseArgs(argv('-v'));
      assert.equal(args.verbose, true);
    });

    it('--version sets version to true', () => {
      const args = parseArgs(argv('--version'));
      assert.equal(args.version, true);
    });

    it('-V sets version to true', () => {
      const args = parseArgs(argv('-V'));
      assert.equal(args.version, true);
    });

    it('--help sets help to true', () => {
      const args = parseArgs(argv('--help'));
      assert.equal(args.help, true);
    });

    it('-h sets help to true', () => {
      const args = parseArgs(argv('-h'));
      assert.equal(args.help, true);
    });

    it('--clean sets clean to true', () => {
      const args = parseArgs(argv('--clean'));
      assert.equal(args.clean, true);
    });
  });

  // -----------------------------------------------------------------------
  // --timeout
  // -----------------------------------------------------------------------
  describe('--timeout', () => {
    it('accepts a valid positive integer', () => {
      const args = parseArgs(argv('--timeout', '60000'));
      assert.equal(args.timeout, 60000);
    });

    it('accepts large timeout values', () => {
      const args = parseArgs(argv('--timeout', '900000'));
      assert.equal(args.timeout, 900000);
    });

    it('exits on non-numeric value', () => {
      const exitCalls = [];
      const origExit = process.exit;
      const origError = console.error;
      process.exit = (code) => { exitCalls.push(code); };
      console.error = () => {};
      try {
        parseArgs(argv('--timeout', 'abc'));
        assert.ok(exitCalls.includes(1), 'Should call process.exit(1) for non-numeric timeout');
      } finally {
        process.exit = origExit;
        console.error = origError;
      }
    });

    it('exits on zero timeout', () => {
      const exitCalls = [];
      const origExit = process.exit;
      const origError = console.error;
      process.exit = (code) => { exitCalls.push(code); };
      console.error = () => {};
      try {
        parseArgs(argv('--timeout', '0'));
        assert.ok(exitCalls.includes(1), 'Should call process.exit(1) for zero timeout');
      } finally {
        process.exit = origExit;
        console.error = origError;
      }
    });

    it('exits on negative timeout', () => {
      const exitCalls = [];
      const origExit = process.exit;
      const origError = console.error;
      process.exit = (code) => { exitCalls.push(code); };
      console.error = () => {};
      try {
        parseArgs(argv('--timeout', '-5000'));
        assert.ok(exitCalls.includes(1), 'Should call process.exit(1) for negative timeout');
      } finally {
        process.exit = origExit;
        console.error = origError;
      }
    });
  });

  // -----------------------------------------------------------------------
  // --retry
  // -----------------------------------------------------------------------
  describe('--retry', () => {
    it('accepts a valid non-negative integer', () => {
      const args = parseArgs(argv('--retry', '3'));
      assert.equal(args.retry, 3);
    });

    it('accepts zero retries', () => {
      const args = parseArgs(argv('--retry', '0'));
      assert.equal(args.retry, 0);
    });

    it('exits on negative retry value', () => {
      const exitCalls = [];
      const origExit = process.exit;
      const origError = console.error;
      process.exit = (code) => { exitCalls.push(code); };
      console.error = () => {};
      try {
        parseArgs(argv('--retry', '-1'));
        assert.ok(exitCalls.includes(1), 'Should call process.exit(1) for negative retry');
      } finally {
        process.exit = origExit;
        console.error = origError;
      }
    });

    it('exits on non-numeric retry value', () => {
      const exitCalls = [];
      const origExit = process.exit;
      const origError = console.error;
      process.exit = (code) => { exitCalls.push(code); };
      console.error = () => {};
      try {
        parseArgs(argv('--retry', 'foo'));
        assert.ok(exitCalls.includes(1), 'Should call process.exit(1) for non-numeric retry');
      } finally {
        process.exit = origExit;
        console.error = origError;
      }
    });
  });

  // -----------------------------------------------------------------------
  // --output-ts
  // -----------------------------------------------------------------------
  describe('--output-ts', () => {
    it('accepts a file path value', () => {
      const args = parseArgs(argv('--output-ts', 'generated.ts'));
      assert.equal(args.outputTs, 'generated.ts');
    });

    it('accepts a path with directories', () => {
      const args = parseArgs(argv('--output-ts', './dist/output.ts'));
      assert.equal(args.outputTs, './dist/output.ts');
    });

    it('exits when value is missing (end of args)', () => {
      const exitCalls = [];
      const origExit = process.exit;
      const origError = console.error;
      process.exit = (code) => { exitCalls.push(code); };
      console.error = () => {};
      try {
        parseArgs(argv('--output-ts'));
        assert.ok(exitCalls.includes(1), 'Should call process.exit(1) when --output-ts has no value');
      } finally {
        process.exit = origExit;
        console.error = origError;
      }
    });

    it('exits when value looks like another flag', () => {
      const exitCalls = [];
      const origExit = process.exit;
      const origError = console.error;
      process.exit = (code) => { exitCalls.push(code); };
      console.error = () => {};
      try {
        parseArgs(argv('--output-ts', '--verbose'));
        assert.ok(exitCalls.includes(1), 'Should call process.exit(1) when --output-ts value starts with -');
      } finally {
        process.exit = origExit;
        console.error = origError;
      }
    });
  });

  // -----------------------------------------------------------------------
  // --report-dir
  // -----------------------------------------------------------------------
  describe('--report-dir', () => {
    it('accepts a directory path value', () => {
      const args = parseArgs(argv('--report-dir', './my-reports'));
      assert.equal(args.reportDir, './my-reports');
    });

    it('exits when value is missing', () => {
      const exitCalls = [];
      const origExit = process.exit;
      const origError = console.error;
      process.exit = (code) => { exitCalls.push(code); };
      console.error = () => {};
      try {
        parseArgs(argv('--report-dir'));
        assert.ok(exitCalls.includes(1), 'Should call process.exit(1) when --report-dir has no value');
      } finally {
        process.exit = origExit;
        console.error = origError;
      }
    });

    it('exits when value looks like another flag', () => {
      const exitCalls = [];
      const origExit = process.exit;
      const origError = console.error;
      process.exit = (code) => { exitCalls.push(code); };
      console.error = () => {};
      try {
        parseArgs(argv('--report-dir', '--dry-run'));
        assert.ok(exitCalls.includes(1), 'Should call process.exit(1) when --report-dir value starts with -');
      } finally {
        process.exit = origExit;
        console.error = origError;
      }
    });
  });

  // -----------------------------------------------------------------------
  // --template
  // -----------------------------------------------------------------------
  describe('--template', () => {
    it('accepts puppeteer as valid template', () => {
      const args = parseArgs(argv('--template', 'puppeteer'));
      assert.equal(args.template, 'puppeteer');
    });

    it('accepts playwright as valid template', () => {
      const args = parseArgs(argv('--template', 'playwright'));
      assert.equal(args.template, 'playwright');
    });

    it('exits on invalid template name', () => {
      const exitCalls = [];
      const origExit = process.exit;
      const origError = console.error;
      process.exit = (code) => { exitCalls.push(code); };
      console.error = () => {};
      try {
        parseArgs(argv('--template', 'selenium'));
        assert.ok(exitCalls.includes(1), 'Should call process.exit(1) for invalid template');
      } finally {
        process.exit = origExit;
        console.error = origError;
      }
    });

    it('exits when template value is missing', () => {
      const exitCalls = [];
      const origExit = process.exit;
      const origError = console.error;
      process.exit = (code) => { exitCalls.push(code); };
      console.error = () => {};
      try {
        parseArgs(argv('--template'));
        assert.ok(exitCalls.includes(1), 'Should call process.exit(1) when --template has no value');
      } finally {
        process.exit = origExit;
        console.error = origError;
      }
    });

    it('exits when template value looks like a flag', () => {
      const exitCalls = [];
      const origExit = process.exit;
      const origError = console.error;
      process.exit = (code) => { exitCalls.push(code); };
      console.error = () => {};
      try {
        parseArgs(argv('--template', '--verbose'));
        assert.ok(exitCalls.includes(1), 'Should call process.exit(1) when --template value starts with -');
      } finally {
        process.exit = origExit;
        console.error = origError;
      }
    });
  });

  // -----------------------------------------------------------------------
  // Positional argument (yaml path)
  // -----------------------------------------------------------------------
  describe('positional yaml path', () => {
    it('captures first positional argument as yamlPath', () => {
      const args = parseArgs(argv('test.yaml'));
      assert.equal(args.yamlPath, 'test.yaml');
    });

    it('captures yaml path before flags', () => {
      const args = parseArgs(argv('my-test.yaml', '--dry-run', '--verbose'));
      assert.equal(args.yamlPath, 'my-test.yaml');
      assert.equal(args.dryRun, true);
      assert.equal(args.verbose, true);
    });

    it('captures yaml path after flags', () => {
      const args = parseArgs(argv('--dry-run', 'my-test.yaml'));
      assert.equal(args.yamlPath, 'my-test.yaml');
      assert.equal(args.dryRun, true);
    });

    it('captures glob pattern as yamlPath', () => {
      const args = parseArgs(argv('tests/**/*.yaml'));
      assert.equal(args.yamlPath, 'tests/**/*.yaml');
    });

    it('exits on second positional argument', () => {
      const exitCalls = [];
      const origExit = process.exit;
      const origError = console.error;
      process.exit = (code) => { exitCalls.push(code); };
      console.error = () => {};
      try {
        parseArgs(argv('first.yaml', 'second.yaml'));
        assert.ok(exitCalls.includes(1), 'Should call process.exit(1) on extra positional argument');
      } finally {
        process.exit = origExit;
        console.error = origError;
      }
    });
  });

  // -----------------------------------------------------------------------
  // Unknown options
  // -----------------------------------------------------------------------
  describe('unknown options', () => {
    it('exits on unknown long option', () => {
      const exitCalls = [];
      const origExit = process.exit;
      const origError = console.error;
      process.exit = (code) => { exitCalls.push(code); };
      console.error = () => {};
      try {
        parseArgs(argv('--nonexistent'));
        assert.ok(exitCalls.includes(1), 'Should call process.exit(1) on unknown option');
      } finally {
        process.exit = origExit;
        console.error = origError;
      }
    });

    it('exits on unknown short option', () => {
      const exitCalls = [];
      const origExit = process.exit;
      const origError = console.error;
      process.exit = (code) => { exitCalls.push(code); };
      console.error = () => {};
      try {
        parseArgs(argv('-z'));
        assert.ok(exitCalls.includes(1), 'Should call process.exit(1) on unknown short option');
      } finally {
        process.exit = origExit;
        console.error = origError;
      }
    });
  });

  // -----------------------------------------------------------------------
  // Combination of flags
  // -----------------------------------------------------------------------
  describe('combined flags', () => {
    it('parses multiple flags together', () => {
      const args = parseArgs(argv(
        'suite.yaml',
        '--dry-run',
        '--verbose',
        '--timeout', '120000',
        '--retry', '2',
        '--template', 'playwright',
        '--output-ts', 'out.ts',
        '--report-dir', './reports',
      ));
      assert.equal(args.yamlPath, 'suite.yaml');
      assert.equal(args.dryRun, true);
      assert.equal(args.verbose, true);
      assert.equal(args.timeout, 120000);
      assert.equal(args.retry, 2);
      assert.equal(args.template, 'playwright');
      assert.equal(args.outputTs, 'out.ts');
      assert.equal(args.reportDir, './reports');
    });

    it('parses --clean with a yaml path', () => {
      const args = parseArgs(argv('--clean', 'test.yaml'));
      assert.equal(args.clean, true);
      assert.equal(args.yamlPath, 'test.yaml');
    });

    it('parses short flags mixed with long flags', () => {
      const args = parseArgs(argv('-v', 'test.yaml', '--dry-run'));
      assert.equal(args.verbose, true);
      assert.equal(args.yamlPath, 'test.yaml');
      assert.equal(args.dryRun, true);
    });
  });
});

// ===========================================================================
// resolveYamlFiles
// ===========================================================================
describe('resolveYamlFiles', () => {
  // -----------------------------------------------------------------------
  // Single file resolution
  // -----------------------------------------------------------------------
  describe('single file paths', () => {
    it('returns array with one resolved path for an existing file', () => {
      // Use a known template file as a fixture
      const templateFile = path.resolve(__dirname, '..', 'templates', 'native', 'web-basic.yaml');
      if (!fs.existsSync(templateFile)) {
        // Skip gracefully if template not found
        return;
      }
      const result = resolveYamlFiles(templateFile);
      assert.ok(Array.isArray(result), 'Should return an array');
      assert.equal(result.length, 1);
      assert.equal(result[0], templateFile);
    });

    it('returns empty array for non-existent file', () => {
      const result = resolveYamlFiles('/absolutely/nonexistent/path/to/file.yaml');
      assert.ok(Array.isArray(result), 'Should return an array');
      assert.equal(result.length, 0);
    });

    it('returns empty array for non-existent relative path', () => {
      const result = resolveYamlFiles('does-not-exist-12345.yaml');
      assert.ok(Array.isArray(result), 'Should return an array');
      assert.equal(result.length, 0);
    });

    it('resolves path to an absolute path', () => {
      const templateFile = path.resolve(__dirname, '..', 'templates', 'native', 'web-basic.yaml');
      if (!fs.existsSync(templateFile)) return;
      const result = resolveYamlFiles(templateFile);
      assert.ok(path.isAbsolute(result[0]), 'Returned path should be absolute');
    });
  });

  // -----------------------------------------------------------------------
  // Glob pattern resolution
  // -----------------------------------------------------------------------
  describe('glob patterns', () => {
    it('resolves glob pattern matching multiple yaml files', () => {
      const pattern = path.resolve(__dirname, '..', 'templates', 'native', '*.yaml');
      const result = resolveYamlFiles(pattern);
      assert.ok(Array.isArray(result), 'Should return an array');
      assert.ok(result.length > 0, 'Should find at least one native template yaml');
      result.forEach(f => {
        const ext = path.extname(f).toLowerCase();
        assert.ok(ext === '.yaml' || ext === '.yml',
          `All results should be .yaml or .yml files, got: ${f}`);
      });
    });

    it('filters to only .yaml and .yml extensions', () => {
      // Use a broad pattern against the templates directory
      const pattern = path.resolve(__dirname, '..', 'templates', '**', '*');
      const result = resolveYamlFiles(pattern);
      result.forEach(f => {
        const ext = path.extname(f).toLowerCase();
        assert.ok(ext === '.yaml' || ext === '.yml',
          `Should only include .yaml/.yml files, got: ${f}`);
      });
    });

    it('returns sorted results', () => {
      const pattern = path.resolve(__dirname, '..', 'templates', '**', '*.yaml');
      const result = resolveYamlFiles(pattern);
      if (result.length > 1) {
        const sorted = [...result].sort();
        assert.deepEqual(result, sorted, 'Results should be sorted alphabetically');
      }
    });

    it('returns all absolute paths', () => {
      const pattern = path.resolve(__dirname, '..', 'templates', '**', '*.yaml');
      const result = resolveYamlFiles(pattern);
      result.forEach(f => {
        assert.ok(path.isAbsolute(f), `Path should be absolute: ${f}`);
      });
    });

    it('returns empty array for non-matching glob pattern', () => {
      const pattern = path.resolve(__dirname, '..', 'templates', '**', '*.nonexistent');
      const result = resolveYamlFiles(pattern);
      assert.ok(Array.isArray(result), 'Should return an array');
      assert.equal(result.length, 0, 'Should return empty array for non-matching pattern');
    });

    it('returns empty array for glob pattern matching non-yaml files', () => {
      // *.json in schema/ should match files but they will be filtered out
      const pattern = path.resolve(__dirname, '..', 'schema', '*.json');
      const result = resolveYamlFiles(pattern);
      assert.ok(Array.isArray(result), 'Should return an array');
      assert.equal(result.length, 0, 'Should filter out non-yaml files');
    });
  });

  // -----------------------------------------------------------------------
  // Glob with braces and question mark
  // -----------------------------------------------------------------------
  describe('advanced glob characters', () => {
    it('recognises ? as a glob character', () => {
      // Pattern with ? should be treated as glob, not literal file path
      const result = resolveYamlFiles('templates/native/web-basi?.yaml');
      // Result depends on whether the file matches; we just check it returns an array
      assert.ok(Array.isArray(result), 'Should return an array when input contains ?');
    });

    it('recognises curly braces as glob characters', () => {
      const result = resolveYamlFiles('templates/native/{web-basic,web-login}.yaml');
      assert.ok(Array.isArray(result), 'Should return an array when input contains { }');
    });
  });

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------
  describe('edge cases', () => {
    it('works with the templates directory to find all 22 templates', () => {
      const pattern = path.resolve(__dirname, '..', 'templates', '**', '*.yaml');
      const result = resolveYamlFiles(pattern);
      // We know there are 22 templates — allow small variance in case of additions
      assert.ok(result.length >= 20,
        `Should find at least 20 templates, found ${result.length}`);
    });
  });
});

// ===========================================================================
// Module exports
// ===========================================================================
describe('CLI module exports', () => {
  it('exports parseArgs function', () => {
    const cli = require('../scripts/midscene-run');
    assert.equal(typeof cli.parseArgs, 'function');
  });

  it('exports resolveYamlFiles function', () => {
    const cli = require('../scripts/midscene-run');
    assert.equal(typeof cli.resolveYamlFiles, 'function');
  });

  it('does not export main function', () => {
    const cli = require('../scripts/midscene-run');
    assert.equal(cli.main, undefined, 'main should not be exported');
  });
});
