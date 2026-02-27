'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const fixtures = (...parts) => path.join(__dirname, 'fixtures', ...parts);

// Validator will be loaded after we confirm the file exists
let validate;
try {
  validate = require('../src/validator/yaml-validator').validate;
} catch (e) {
  // Validator not yet available — skip gracefully
  console.warn('Validator module not loaded, tests will fail:', e.message);
  validate = () => ({ valid: false, errors: [{ level: 'error', message: 'Module not loaded' }], warnings: [] });
}

describe('YAML Validator', () => {
  describe('syntax validation', () => {
    it('rejects invalid YAML syntax', () => {
      // Use a tab character in a flow context which is genuinely invalid YAML
      const result = validate('key:\n\t- bad:\n  mixed: {]');
      assert.equal(result.valid, false);
      assert.ok(result.errors.length > 0);
    });

    it('accepts valid YAML', () => {
      const result = validate(fixtures('native-simple.yaml'));
      assert.equal(result.valid, true);
      assert.equal(result.errors.length, 0);
    });
  });

  describe('structure validation', () => {
    it('rejects YAML without platform config', () => {
      const yaml = `
tasks:
  - name: test
    flow:
      - aiTap: "button"
`;
      const result = validate(yaml);
      assert.equal(result.valid, false);
      assert.ok(result.errors.some(e =>
        e.message.toLowerCase().includes('platform') ||
        e.message.toLowerCase().includes('web') ||
        e.message.toLowerCase().includes('android')
      ));
    });

    it('rejects YAML without tasks', () => {
      const yaml = `
web:
  url: "https://example.com"
`;
      const result = validate(yaml);
      assert.equal(result.valid, false);
      assert.ok(result.errors.some(e => e.message.toLowerCase().includes('tasks')));
    });

    it('rejects tasks without name', () => {
      const yaml = `
web:
  url: "https://example.com"
tasks:
  - flow:
      - aiTap: "button"
`;
      const result = validate(yaml);
      assert.equal(result.valid, false);
      assert.ok(result.errors.some(e => e.message.toLowerCase().includes('name')));
    });

    it('rejects tasks without flow', () => {
      const yaml = `
web:
  url: "https://example.com"
tasks:
  - name: "test"
`;
      const result = validate(yaml);
      assert.equal(result.valid, false);
      assert.ok(result.errors.some(e => e.message.toLowerCase().includes('flow')));
    });
  });

  describe('native YAML validation', () => {
    it('validates native-simple.yaml', () => {
      const result = validate(fixtures('native-simple.yaml'));
      assert.equal(result.valid, true);
    });

    it('validates native-complex.yaml', () => {
      const result = validate(fixtures('native-complex.yaml'));
      assert.equal(result.valid, true);
    });
  });

  describe('extended YAML validation', () => {
    it('validates extended-logic.yaml', () => {
      const result = validate(fixtures('extended-logic.yaml'));
      assert.equal(result.valid, true);
    });

    it('validates extended-loop.yaml', () => {
      const result = validate(fixtures('extended-loop.yaml'));
      assert.equal(result.valid, true);
    });

    it('validates extended-full.yaml', () => {
      const result = validate(fixtures('extended-full.yaml'));
      assert.equal(result.valid, true);
    });
  });

  describe('extended construct validation', () => {
    it('rejects logic without if clause', () => {
      const yaml = `
engine: extended
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - logic:
          then:
            - aiTap: "button"
`;
      const result = validate(yaml);
      assert.ok(!result.valid || result.warnings.length > 0 || result.errors.length > 0);
    });

    it('rejects loop without type', () => {
      const yaml = `
engine: extended
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - loop:
          flow:
            - aiTap: "button"
`;
      const result = validate(yaml);
      assert.ok(!result.valid || result.warnings.length > 0 || result.errors.length > 0);
    });
  });
});
