'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const constants = require('../src/constants');

describe('Shared Constants', () => {
  it('exports MAX_FILE_SIZE as 1MB', () => {
    assert.equal(constants.MAX_FILE_SIZE, 1024 * 1024);
  });

  it('exports DEFAULT_TIMEOUT as 300000ms', () => {
    assert.equal(constants.DEFAULT_TIMEOUT, 300000);
  });

  it('exports DEFAULT_REPORT_DIR', () => {
    assert.equal(constants.DEFAULT_REPORT_DIR, './midscene-report');
  });

  it('exports DEFAULT_OUTPUT_DIR', () => {
    assert.equal(constants.DEFAULT_OUTPUT_DIR, './midscene-output');
  });

  it('exports MIDSCENE_TMP_DIR', () => {
    assert.equal(constants.MIDSCENE_TMP_DIR, '.midscene-tmp');
  });

  it('exports MAX_IMPORT_DEPTH as 10', () => {
    assert.equal(constants.MAX_IMPORT_DEPTH, 10);
  });

  it('exports MIDSCENE_PKG', () => {
    assert.equal(constants.MIDSCENE_PKG, '@midscene/web@1');
  });

  it('exports STALE_TEMP_THRESHOLD_MS as 24 hours', () => {
    assert.equal(constants.STALE_TEMP_THRESHOLD_MS, 24 * 60 * 60 * 1000);
  });

  it('exports MAX_ERROR_MESSAGE_LENGTH as 500', () => {
    assert.equal(constants.MAX_ERROR_MESSAGE_LENGTH, 500);
  });

  it('all constants are non-null values', () => {
    for (const [key, value] of Object.entries(constants)) {
      assert.ok(value !== null && value !== undefined, `${key} should be defined`);
    }
  });
});
