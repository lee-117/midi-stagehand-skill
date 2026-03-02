'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

// ---------------------------------------------------------------------------
// Integration tests — full pipeline: detect → validate → transpile
// ---------------------------------------------------------------------------
const { detect } = require('../src/detector/mode-detector');
const { validate } = require('../src/validator/yaml-validator');
const { transpile } = require('../src/transpiler/transpiler');

const fixturesDir = path.join(__dirname, 'fixtures');

describe('Integration: Native Pipeline', () => {
  const nativeFiles = [
    'native-simple.yaml',
    'native-complex.yaml',
    'native-android.yaml',
    'native-ios.yaml',
    'native-computer.yaml',
  ];

  for (const file of nativeFiles) {
    it(`detect + validate: ${file}`, () => {
      const filePath = path.join(fixturesDir, file);

      // Detect
      const detection = detect(filePath);
      assert.equal(detection.mode, 'native', `${file} should be native mode`);

      // Validate
      const result = validate(filePath);
      assert.equal(result.valid, true, `${file} should be valid: ${JSON.stringify(result.errors)}`);
      assert.ok(Array.isArray(result.errors));
      assert.ok(Array.isArray(result.warnings));
    });
  }
});

describe('Integration: Extended Pipeline', () => {
  const extendedFiles = [
    'extended-logic.yaml',
    'extended-loop.yaml',
    'extended-full.yaml',
    'extended-data-transform.yaml',
  ];

  for (const file of extendedFiles) {
    it(`detect + validate + transpile: ${file}`, () => {
      const filePath = path.join(fixturesDir, file);

      // Detect
      const detection = detect(filePath);
      assert.equal(detection.mode, 'extended', `${file} should be extended mode`);
      assert.ok(detection.features.length > 0, `${file} should have features`);

      // Validate
      const result = validate(filePath);
      assert.equal(result.valid, true, `${file} should be valid: ${JSON.stringify(result.errors)}`);

      // Transpile
      const transpileResult = transpile(filePath);
      assert.ok(transpileResult.code, `${file} should produce code`);
      assert.ok(typeof transpileResult.code === 'string');
      assert.ok(transpileResult.code.length > 0);
      assert.ok(Array.isArray(transpileResult.warnings));
    });
  }

  it('transpiled code contains expected patterns for logic fixture', () => {
    const filePath = path.join(fixturesDir, 'extended-logic.yaml');
    const result = transpile(filePath);

    // Should contain if/else branching
    assert.ok(result.code.includes('if'), 'Should contain if statement');
    assert.ok(result.code.includes('else'), 'Should contain else branch');
    // Should contain variable declaration
    assert.ok(result.code.includes('username'), 'Should reference username variable');
  });

  it('transpiled code contains expected patterns for loop fixture', () => {
    const filePath = path.join(fixturesDir, 'extended-loop.yaml');
    const result = transpile(filePath);

    // Should contain loop construct
    assert.ok(
      result.code.includes('for') || result.code.includes('while'),
      'Should contain loop construct'
    );
  });

  it('transpiled code contains expected patterns for data-transform fixture', () => {
    const filePath = path.join(fixturesDir, 'extended-data-transform.yaml');
    const result = transpile(filePath);

    // Should contain data transform operations
    assert.ok(result.code.includes('filter') || result.code.includes('map') || result.code.includes('sort'),
      'Should contain data transform operations');
  });
});

describe('Integration: Template Files', () => {
  const fs = require('fs');
  const templatesDir = path.join(__dirname, '..', 'templates');

  it('all native templates pass validation', () => {
    const nativeDir = path.join(templatesDir, 'native');
    const files = fs.readdirSync(nativeDir).filter(f => f.endsWith('.yaml'));
    assert.ok(files.length >= 10, 'Should have at least 10 native templates');

    for (const file of files) {
      const filePath = path.join(nativeDir, file);
      const detection = detect(filePath);
      assert.equal(detection.mode, 'native', `${file} should be native`);

      const result = validate(filePath);
      assert.equal(result.valid, true,
        `Template ${file} should be valid: ${JSON.stringify(result.errors)}`);
    }
  });

  it('all extended templates pass validation and transpile', () => {
    const extDir = path.join(templatesDir, 'extended');
    const files = fs.readdirSync(extDir).filter(f => f.endsWith('.yaml'));
    assert.ok(files.length >= 10, 'Should have at least 10 extended templates');

    for (const file of files) {
      const filePath = path.join(extDir, file);
      const detection = detect(filePath);
      assert.equal(detection.mode, 'extended', `${file} should be extended`);

      const result = validate(filePath);
      assert.equal(result.valid, true,
        `Template ${file} should be valid: ${JSON.stringify(result.errors)}`);

      const transpileResult = transpile(filePath);
      assert.ok(transpileResult.code,
        `Template ${file} should transpile: ${transpileResult.error || 'no code'}`);
    }
  });
});
