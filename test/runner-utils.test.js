'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');

const { resolveLocalBin, normaliseExecError } = require('../src/runner/runner-utils');

// ---------------------------------------------------------------------------
// resolveLocalBin tests
// ---------------------------------------------------------------------------
describe('resolveLocalBin', () => {
  it('returns npx fallback when local bin does not exist', () => {
    const result = resolveLocalBin('nonexistent-binary-xyz', 'npx nonexistent-binary-xyz');
    assert.equal(result, 'npx nonexistent-binary-xyz',
      'Should return npx fallback for missing binary');
  });

  it('returns quoted local path when local bin exists', () => {
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
    const result = resolveLocalBin(binName, 'npx ' + binName);
    assert.ok(result.startsWith('"'), 'Should return quoted path: ' + result);
    assert.ok(result.endsWith('"'), 'Should end with quote: ' + result);
  });

  it('returns string type regardless of resolution path', () => {
    const result = resolveLocalBin('anything', 'npx anything');
    assert.equal(typeof result, 'string');
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
});
