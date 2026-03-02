'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');

const { resolveLocalBin, normaliseExecError, findSystemChrome } = require('../src/runner/runner-utils');

// ---------------------------------------------------------------------------
// resolveLocalBin tests
// ---------------------------------------------------------------------------
describe('resolveLocalBin', () => {
  it('returns npx fallback when local bin does not exist', () => {
    const fallback = { bin: 'npx', args: ['nonexistent-binary-xyz'] };
    const result = resolveLocalBin('nonexistent-binary-xyz', fallback);
    assert.deepEqual(result, fallback,
      'Should return npx fallback for missing binary');
  });

  it('returns local bin path when local bin exists', () => {
    // Use a binary that should exist in node_modules/.bin (e.g., from devDependencies)
    const isWin = process.platform === 'win32';
    const binDir = path.resolve(__dirname, '..', 'node_modules', '.bin');
    if (!fs.existsSync(binDir)) {
      // Skip if node_modules not installed
      return;
    }
    const files = fs.readdirSync(binDir);
    // Find any binary that exists
    const anyBin = files.find(f => !f.includes('.') || (isWin && f.endsWith('.cmd')));
    if (!anyBin) return;

    const binName = isWin ? anyBin.replace(/\.cmd$/, '') : anyBin;
    const fallback = { bin: 'npx', args: [binName] };
    const result = resolveLocalBin(binName, fallback);
    assert.equal(typeof result.bin, 'string', 'Should have bin string');
    assert.ok(Array.isArray(result.args), 'Should have args array');
    assert.ok(result.bin.includes(binName), 'Bin path should contain binary name');
  });

  it('returns object with bin and args keys', () => {
    const fallback = { bin: 'npx', args: ['anything'] };
    const result = resolveLocalBin('anything', fallback);
    assert.ok('bin' in result, 'Should have bin key');
    assert.ok('args' in result, 'Should have args key');
  });
});

// ---------------------------------------------------------------------------
// normaliseExecError tests
// ---------------------------------------------------------------------------
describe('normaliseExecError', () => {
  it('normalises a killed process error', () => {
    const err = new Error('Command failed');
    err.killed = true;
    err.status = null;
    const result = normaliseExecError(err);
    assert.equal(result.errorMessage, 'Process was killed (timeout or signal)',
      'Should indicate process was killed');
    assert.equal(result.exitCode, 'KILLED');
  });

  it('normalises a killed process with existing status', () => {
    const err = new Error('Command failed');
    err.killed = true;
    err.status = 137;
    const result = normaliseExecError(err);
    assert.equal(result.exitCode, 137,
      'Should preserve numeric exit code when available');
  });

  it('normalises error with null status', () => {
    const err = new Error('Something went wrong');
    err.killed = false;
    err.status = null;
    const result = normaliseExecError(err);
    assert.ok(result.errorMessage.includes('without a status code'),
      'Should indicate missing status code');
    assert.equal(result.exitCode, 'UNKNOWN');
  });

  it('normalises error with undefined status', () => {
    const err = new Error('Oops');
    err.killed = false;
    err.status = undefined;
    const result = normaliseExecError(err);
    assert.equal(result.exitCode, 'UNKNOWN');
  });

  it('preserves numeric exit code for normal errors', () => {
    const err = new Error('Command failed with exit code 1');
    err.killed = false;
    err.status = 1;
    const result = normaliseExecError(err);
    assert.equal(result.exitCode, 1);
    assert.equal(result.errorMessage, 'Command failed with exit code 1');
  });

  it('handles high exit codes', () => {
    const err = new Error('Segfault');
    err.killed = false;
    err.status = 139;
    const result = normaliseExecError(err);
    assert.equal(result.exitCode, 139);
  });

  it('returns object with errorMessage and exitCode keys', () => {
    const err = new Error('test');
    err.status = 1;
    const result = normaliseExecError(err);
    assert.ok('errorMessage' in result, 'Should have errorMessage key');
    assert.ok('exitCode' in result, 'Should have exitCode key');
  });

  it('includes signal info when process is killed with signal', () => {
    const err = new Error('Command failed');
    err.killed = true;
    err.signal = 'SIGTERM';
    err.status = null;
    const result = normaliseExecError(err);
    assert.ok(result.errorMessage.includes('SIGTERM'),
      'Should include signal name in error message');
    assert.equal(result.exitCode, 'KILLED');
  });

  it('omits signal info when signal is not set', () => {
    const err = new Error('Command failed');
    err.killed = true;
    err.signal = undefined;
    err.status = null;
    const result = normaliseExecError(err);
    assert.ok(!result.errorMessage.includes('undefined'),
      'Should not include undefined in error message');
  });
});

// ---------------------------------------------------------------------------
// findSystemChrome tests
// ---------------------------------------------------------------------------
describe('findSystemChrome', () => {
  it('returns string or null', () => {
    const result = findSystemChrome();
    assert.ok(result === null || typeof result === 'string',
      'Should return null or a string path');
  });

  it('returns existing file path when found', () => {
    const result = findSystemChrome();
    if (result !== null) {
      assert.ok(fs.existsSync(result),
        'Returned path should exist on filesystem');
    }
  });

  it('returns consistent results across multiple calls', () => {
    const result1 = findSystemChrome();
    const result2 = findSystemChrome();
    assert.equal(result1, result2, 'Should return the same path on repeated calls');
  });

  it('returns same result on consecutive calls (memoization)', () => {
    const { _resetChromeCache } = require('../src/runner/runner-utils');
    _resetChromeCache();
    const result1 = findSystemChrome();
    const result2 = findSystemChrome();
    assert.strictEqual(result1, result2, 'Consecutive calls should return same result');
  });

  it('returned path includes browser-like name (if found)', () => {
    const result = findSystemChrome();
    if (result !== null) {
      const lower = result.toLowerCase();
      const hasBrowserName = lower.includes('chrom') || lower.includes('edge');
      assert.ok(hasBrowserName,
        `Path should include chrome, chromium, or edge: ${result}`);
    }
  });
});
