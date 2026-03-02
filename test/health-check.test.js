'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');

describe('health-check script', () => {
  const scriptPath = path.resolve(__dirname, '..', 'scripts', 'health-check.js');

  it('script file exists', () => {
    assert.ok(fs.existsSync(scriptPath), 'health-check.js should exist');
  });

  it('script starts with shebang and use strict', () => {
    const content = fs.readFileSync(scriptPath, 'utf8');
    assert.ok(content.startsWith('#!/usr/bin/env node'), 'should start with shebang');
    assert.ok(content.includes("'use strict'"), 'should use strict mode');
  });

  it('imports findSystemChrome from runner-utils', () => {
    const content = fs.readFileSync(scriptPath, 'utf8');
    assert.ok(content.includes('findSystemChrome'), 'should import findSystemChrome');
    assert.ok(content.includes('runner-utils'), 'should import from runner-utils');
  });

  it('checks all 7 required items', () => {
    const content = fs.readFileSync(scriptPath, 'utf8');
    // Verify all 7 checks are present
    assert.ok(content.includes('Node.js'), 'should check Node.js version');
    assert.ok(content.includes('Dependencies'), 'should check dependencies');
    assert.ok(content.includes('CLI script'), 'should check CLI script');
    assert.ok(content.includes('@midscene/web'), 'should check @midscene/web');
    assert.ok(content.includes('tsx'), 'should check tsx runtime');
    assert.ok(content.includes('AI model'), 'should check AI model config');
    assert.ok(content.includes('Chrome'), 'should check Chrome browser');
  });

  it('reads .env file for MIDSCENE_MODEL_API_KEY', () => {
    const content = fs.readFileSync(scriptPath, 'utf8');
    assert.ok(content.includes('MIDSCENE_MODEL_API_KEY'), 'should check for API key');
    assert.ok(content.includes('.env'), 'should read .env file');
  });

  it('exits with code 1 on failure', () => {
    const content = fs.readFileSync(scriptPath, 'utf8');
    assert.ok(content.includes('process.exit(1)'), 'should exit(1) on failure');
  });
});
