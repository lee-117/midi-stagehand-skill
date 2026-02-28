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

  describe('template files validation', () => {
    const fs = require('fs');
    const templateDir = path.join(__dirname, '..', 'templates');

    const nativeTemplates = fs.readdirSync(path.join(templateDir, 'native'))
      .filter(f => f.endsWith('.yaml') || f.endsWith('.yml'))
      .map(f => path.join(templateDir, 'native', f));

    const extendedTemplates = fs.readdirSync(path.join(templateDir, 'extended'))
      .filter(f => f.endsWith('.yaml') || f.endsWith('.yml'))
      .map(f => path.join(templateDir, 'extended', f));

    for (const tpl of nativeTemplates) {
      it(`validates native template: ${path.basename(tpl)}`, () => {
        const result = validate(tpl);
        assert.equal(result.valid, true, `Template ${path.basename(tpl)} should be valid. Errors: ${JSON.stringify(result.errors)}`);
      });
    }

    for (const tpl of extendedTemplates) {
      it(`validates extended template: ${path.basename(tpl)}`, () => {
        const result = validate(tpl);
        assert.equal(result.valid, true, `Template ${path.basename(tpl)} should be valid. Errors: ${JSON.stringify(result.errors)}`);
      });
    }
  });

  describe('steps/flow alias support', () => {
    it('accepts try/catch with "steps" instead of "flow"', () => {
      const yaml = `
engine: extended
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - try:
          steps:
            - aiTap: "button"
        catch:
          steps:
            - aiAssert: "fallback"
`;
      const result = validate(yaml);
      assert.equal(result.valid, true, `Should accept steps in try/catch. Errors: ${JSON.stringify(result.errors)}`);
    });

    it('accepts loop with "steps" instead of "flow"', () => {
      const yaml = `
engine: extended
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - loop:
          type: repeat
          count: 3
          steps:
            - aiTap: "next"
`;
      const result = validate(yaml);
      assert.equal(result.valid, true, `Should accept steps in loop. Errors: ${JSON.stringify(result.errors)}`);
    });
  });

  describe('engine field validation', () => {
    it('warns on invalid engine value', () => {
      const yaml = `
engine: turbo
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - aiTap: "button"
`;
      const result = validate(yaml);
      // Should still be valid (it is a warning, not an error)
      assert.equal(result.valid, true);
      assert.ok(result.warnings.some(w => w.message.includes('engine') || w.message.includes('turbo')),
        `Should warn about invalid engine. Warnings: ${JSON.stringify(result.warnings)}`);
    });

    it('does not warn on valid engine: native', () => {
      const yaml = `
engine: native
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - aiTap: "button"
`;
      const result = validate(yaml);
      assert.equal(result.valid, true);
      assert.ok(!result.warnings.some(w =>
        (w.message || '').toLowerCase().includes('engine')
      ), 'Should not warn about valid engine');
    });

    it('does not warn on valid engine: extended', () => {
      const yaml = `
engine: extended
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - variables:
          x: 1
`;
      const result = validate(yaml);
      assert.equal(result.valid, true);
      assert.ok(!result.warnings.some(w =>
        (w.message || '').toLowerCase().includes('engine')
      ), 'Should not warn about valid engine');
    });
  });

  describe('use step validation', () => {
    it('accepts valid use step with with params', () => {
      const yaml = `
engine: extended
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - use: "\${loginFlow}"
        with:
          username: "admin"
`;
      const result = validate(yaml);
      assert.equal(result.valid, true, `Valid use step should pass. Errors: ${JSON.stringify(result.errors)}`);
    });

    it('rejects use step with empty string', () => {
      const yaml = `
engine: extended
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - use: ""
`;
      const result = validate(yaml);
      assert.ok(result.errors.some(e => e.message.includes('use')),
        'Should error on empty use reference');
    });

    it('rejects use step with invalid with type', () => {
      const yaml = `
engine: extended
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - use: "./login.yaml"
        with: "not-an-object"
`;
      const result = validate(yaml);
      assert.ok(result.errors.some(e => e.message.includes('with')),
        'Should error on non-object with');
    });
  });

  describe('data_transform validation', () => {
    it('accepts valid data_transform with flat format', () => {
      const yaml = `
engine: extended
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - data_transform:
          source: "\${items}"
          operation: filter
          condition: "item.price > 10"
          name: "filtered"
`;
      const result = validate(yaml);
      assert.equal(result.valid, true, `Valid data_transform should pass. Errors: ${JSON.stringify(result.errors)}`);
    });

    it('rejects invalid data_transform operation', () => {
      const yaml = `
engine: extended
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - data_transform:
          source: "\${items}"
          operation: shuffle
          name: "shuffled"
`;
      const result = validate(yaml);
      assert.ok(result.errors.some(e => e.message.includes('shuffle')),
        'Should error on invalid operation type');
    });

    it('warns when data_transform operation has no source', () => {
      const yaml = `
engine: extended
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - data_transform:
          operation: filter
          condition: "item.price > 10"
          name: "filtered"
`;
      const result = validate(yaml);
      assert.ok(result.warnings.some(w => w.message.includes('source')),
        'Should warn about missing source');
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

  describe('edge cases', () => {
    it('validates nested try/catch inside loop', () => {
      const yaml = `
engine: extended
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - loop:
          type: repeat
          count: 3
          steps:
            - try:
                steps:
                  - aiTap: "submit"
              catch:
                steps:
                  - aiAssert: "error handled"
`;
      const result = validate(yaml);
      assert.equal(result.valid, true, `Nested try in loop should be valid. Errors: ${JSON.stringify(result.errors)}`);
    });

    it('validates loop inside try', () => {
      const yaml = `
engine: extended
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - try:
          flow:
            - loop:
                type: while
                condition: "has more"
                maxIterations: 5
                flow:
                  - aiTap: "load more"
        catch:
          flow:
            - aiAssert: "loop failed"
`;
      const result = validate(yaml);
      assert.equal(result.valid, true, `Loop inside try should be valid. Errors: ${JSON.stringify(result.errors)}`);
    });

    it('validates logic inside loop inside try', () => {
      const yaml = `
engine: extended
web:
  url: "https://example.com"
tasks:
  - name: deeply nested
    flow:
      - try:
          steps:
            - loop:
                type: repeat
                count: 2
                steps:
                  - logic:
                      if: "button exists"
                      then:
                        - aiTap: "button"
                      else:
                        - aiAssert: "no button"
        catch:
          steps:
            - recordToReport
`;
      const result = validate(yaml);
      assert.equal(result.valid, true, `Deeply nested structures should be valid. Errors: ${JSON.stringify(result.errors)}`);
    });

    it('validates try with finally using steps', () => {
      const yaml = `
engine: extended
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - try:
          steps:
            - aiTap: "action"
        catch:
          steps:
            - aiAssert: "caught"
        finally:
          steps:
            - recordToReport
`;
      const result = validate(yaml);
      assert.equal(result.valid, true, `Finally with steps should be valid. Errors: ${JSON.stringify(result.errors)}`);
    });

    it('validates multiple tasks with continueOnError', () => {
      const yaml = `
web:
  url: "https://example.com"
tasks:
  - name: task A
    continueOnError: true
    flow:
      - aiTap: "button A"
  - name: task B
    flow:
      - aiTap: "button B"
`;
      const result = validate(yaml);
      assert.equal(result.valid, true, `continueOnError should be valid. Errors: ${JSON.stringify(result.errors)}`);
    });
  });
});
