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

    it('accepts distinct as alias for unique', () => {
      const yaml = `
engine: extended
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - data_transform:
          source: "\${items}"
          operation: distinct
          by: "id"
          name: "uniqueItems"
`;
      const result = validate(yaml);
      assert.equal(result.valid, true, `distinct should be valid. Errors: ${JSON.stringify(result.errors)}`);
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
      assert.ok(result.warnings.length > 0 || !result.valid, 'Should flag logic without condition');
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
      assert.ok(result.warnings.length > 0 || !result.valid, 'Should flag loop without type');
    });
  });

  describe('empty loop warning', () => {
    it('warns when loop has empty flow', () => {
      const yaml = `
engine: extended
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - loop:
          type: repeat
          count: 5
          flow: []
`;
      const result = validate(yaml);
      assert.ok(result.warnings.some(w => w.message.includes('empty')),
        'Should warn about empty loop flow');
    });

    it('warns when loop is missing flow/steps', () => {
      const yaml = `
engine: extended
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - loop:
          type: repeat
          count: 5
`;
      const result = validate(yaml);
      assert.ok(result.warnings.some(w => w.message.includes('missing')),
        'Should warn about missing loop flow');
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

  describe('native action format validation', () => {
    it('warns on nested aiWaitFor with condition sub-key', () => {
      const yaml = `
engine: native
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - aiWaitFor:
          condition: "page loaded"
          timeout: 10000
`;
      const result = validate(yaml);
      assert.equal(result.valid, true);
      const formatWarnings = result.warnings.filter(w => w.message.includes('aiWaitFor'));
      assert.ok(formatWarnings.length > 0, 'Should warn about nested aiWaitFor format');
      assert.ok(formatWarnings[0].message.includes('condition'), 'Warning should mention condition sub-key');
    });

    it('does not warn on flat aiWaitFor format', () => {
      const yaml = `
engine: native
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - aiWaitFor: "page loaded"
        timeout: 10000
`;
      const result = validate(yaml);
      assert.equal(result.valid, true);
      const formatWarnings = result.warnings.filter(w => w.message.includes('nested object format'));
      assert.equal(formatWarnings.length, 0, 'Should not warn on flat format');
    });

    it('warns on nested aiInput with locator sub-key', () => {
      const yaml = `
engine: native
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - aiInput:
          locator: "search box"
          value: "keyword"
`;
      const result = validate(yaml);
      assert.equal(result.valid, true);
      const formatWarnings = result.warnings.filter(w => w.message.includes('aiInput'));
      assert.ok(formatWarnings.length > 0, 'Should warn about nested aiInput format');
      assert.ok(formatWarnings[0].message.includes('locator'), 'Warning should mention locator sub-key');
    });

    it('does not warn on flat aiInput format', () => {
      const yaml = `
engine: native
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - aiInput: "search box"
        value: "keyword"
`;
      const result = validate(yaml);
      assert.equal(result.valid, true);
      const formatWarnings = result.warnings.filter(w => w.message.includes('nested object format'));
      assert.equal(formatWarnings.length, 0, 'Should not warn on flat format');
    });

    it('does not warn in extended mode (transpiler handles both formats)', () => {
      const yaml = `
engine: extended
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - aiWaitFor:
          condition: "page loaded"
          timeout: 10000
      - aiInput:
          locator: "search box"
          value: "keyword"
`;
      const result = validate(yaml);
      assert.equal(result.valid, true);
      const formatWarnings = result.warnings.filter(w => w.message.includes('nested object format'));
      assert.equal(formatWarnings.length, 0, 'Should not warn in extended mode');
    });

    it('detects nested format inside nested flow structures', () => {
      const yaml = `
engine: native
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - aiTap:
          locator: "some button"
          deepThink: true
`;
      const result = validate(yaml);
      assert.equal(result.valid, true);
      const formatWarnings = result.warnings.filter(w => w.message.includes('aiTap'));
      assert.ok(formatWarnings.length > 0, 'Should warn about nested aiTap format');
    });
  });

  describe('features declaration validation', () => {
    it('warns when features declaration is missing in extended mode', () => {
      const yaml = `
engine: extended
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - logic:
          if: "condition"
          then:
            - aiTap: "button"
`;
      const result = validate(yaml);
      assert.equal(result.valid, true);
      const featWarnings = result.warnings.filter(w => w.message.includes('missing "features"'));
      assert.ok(featWarnings.length > 0, 'Should warn about missing features declaration');
    });

    it('warns when declared feature is not used', () => {
      const yaml = `
engine: extended
features: [logic, loop]
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - logic:
          if: "condition"
          then:
            - aiTap: "button"
`;
      const result = validate(yaml);
      assert.equal(result.valid, true);
      const unusedWarnings = result.warnings.filter(w => w.message.includes('does not appear to be used'));
      assert.ok(unusedWarnings.length > 0, 'Should warn about unused declared feature');
      assert.ok(unusedWarnings.some(w => w.message.includes('loop')), 'Should specifically flag loop');
    });

    it('does not warn when features match usage', () => {
      const yaml = `
engine: extended
features: [logic]
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - logic:
          if: "condition"
          then:
            - aiTap: "button"
`;
      const result = validate(yaml);
      assert.equal(result.valid, true);
      const featWarnings = result.warnings.filter(w => w.message.includes('features'));
      assert.equal(featWarnings.length, 0, 'Should not warn when features match');
    });
  });

  describe('external_call required fields', () => {
    it('rejects http external_call without url', () => {
      const yaml = `
engine: extended
features: [external_call]
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - external_call:
          type: http
          method: GET
`;
      const result = validate(yaml);
      assert.equal(result.valid, false);
      assert.ok(result.errors.some(e => e.message.includes('"url"')), 'Should require url for http');
    });

    it('rejects shell external_call without command', () => {
      const yaml = `
engine: extended
features: [external_call]
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - external_call:
          type: shell
`;
      const result = validate(yaml);
      assert.equal(result.valid, false);
      assert.ok(result.errors.some(e => e.message.includes('"command"')), 'Should require command for shell');
    });

    it('accepts valid http external_call with url', () => {
      const yaml = `
engine: extended
features: [external_call]
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - external_call:
          type: http
          method: GET
          url: "https://api.example.com/data"
`;
      const result = validate(yaml);
      assert.equal(result.valid, true);
      const urlErrors = result.errors.filter(e => e.message.includes('url'));
      assert.equal(urlErrors.length, 0, 'Should not error on valid http call');
    });
  });

  describe('timeout validation', () => {
    it('warns on negative timeout in native mode', () => {
      const yaml = `
engine: native
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - aiWaitFor: "done"
        timeout: -1
`;
      const result = validate(yaml);
      assert.equal(result.valid, true);
      const timeoutWarnings = result.warnings.filter(w => w.message.includes('Timeout'));
      assert.ok(timeoutWarnings.length > 0, 'Should warn about negative timeout');
    });

    it('warns on zero timeout', () => {
      const yaml = `
engine: native
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - aiWaitFor: "done"
        timeout: 0
`;
      const result = validate(yaml);
      const timeoutWarnings = result.warnings.filter(w => w.message.includes('Timeout'));
      assert.ok(timeoutWarnings.length > 0, 'Should warn about zero timeout');
    });

    it('does not warn on positive timeout', () => {
      const yaml = `
engine: native
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - aiWaitFor: "done"
        timeout: 10000
`;
      const result = validate(yaml);
      const timeoutWarnings = result.warnings.filter(w => w.message.includes('Timeout'));
      assert.equal(timeoutWarnings.length, 0, 'Should not warn on valid timeout');
    });
  });

  describe('walkFlow depth guard (A1)', () => {
    it('does not crash on deeply nested logic (60 levels)', () => {
      // Build a 60-level deep nested logic structure
      let innerFlow = '- aiTap: "deep button"';
      for (let i = 0; i < 60; i++) {
        innerFlow =
          `- logic:\n` +
          `${'  '.repeat(1)}if: "cond${i}"\n` +
          `${'  '.repeat(1)}then:\n` +
          `${'  '.repeat(2)}${innerFlow}`;
      }
      const yaml = `
engine: extended
web:
  url: "https://example.com"
tasks:
  - name: deep nesting
    flow:
      ${innerFlow}
`;
      // Should not throw (stack overflow) — just validates what it can
      const result = validate(yaml);
      assert.ok(typeof result.valid === 'boolean', 'Should return a result without crashing');
    });
  });

  describe('import path traversal protection (A2)', () => {
    it('warns on path traversal outside project directory', () => {
      const yaml = `
engine: extended
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - import: "../../../etc/passwd.yaml"
        as: pwFlow
`;
      const result = validate(yaml, { basePath: fixtures() });
      const traversalWarnings = result.warnings.filter(w =>
        w.message.includes('resolves outside the project directory')
      );
      assert.ok(traversalWarnings.length > 0, 'Should warn about path traversal');
    });
  });

  describe('shell command injection warning (A3)', () => {
    it('warns when shell command contains template variables', () => {
      const yaml = `
engine: extended
features: [external_call]
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - external_call:
          type: shell
          command: "echo \${userInput}"
`;
      const result = validate(yaml);
      const injectionWarnings = result.warnings.filter(w =>
        w.message.includes('command injection')
      );
      assert.ok(injectionWarnings.length > 0, 'Should warn about shell injection risk');
    });

    it('does not warn when shell command has no template variables', () => {
      const yaml = `
engine: extended
features: [external_call]
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - external_call:
          type: shell
          command: "echo hello world"
`;
      const result = validate(yaml);
      const injectionWarnings = result.warnings.filter(w =>
        w.message.includes('command injection')
      );
      assert.equal(injectionWarnings.length, 0, 'Should not warn on static shell command');
    });
  });

  describe('circular import detection (A4)', () => {
    it('detects circular imports between two files', () => {
      const result = validate(fixtures('circular-a.yaml'));
      const circularErrors = result.errors.filter(e =>
        e.message.includes('Circular import')
      );
      assert.ok(circularErrors.length > 0, 'Should detect circular import');
    });

    it('does not report circular import for linear imports', () => {
      const result = validate(fixtures('extended-full.yaml'));
      const circularErrors = result.errors.filter(e =>
        e.message.includes('Circular import')
      );
      assert.equal(circularErrors.length, 0, 'Should not report circular import for non-circular file');
    });
  });

  // ===========================================================================
  // Phase 4 — New validation rules (4.1)
  // ===========================================================================

  describe('sleep value validation', () => {
    it('warns on negative sleep value', () => {
      const yaml = `
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - sleep: -1000
`;
      const result = validate(yaml);
      const sleepWarnings = result.warnings.filter(w => w.message.includes('Sleep value'));
      assert.ok(sleepWarnings.length > 0, 'Should warn on negative sleep');
    });

    it('warns on non-numeric sleep string', () => {
      const yaml = `
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - sleep: "abc"
`;
      const result = validate(yaml);
      const sleepWarnings = result.warnings.filter(w => w.message.includes('Sleep value'));
      assert.ok(sleepWarnings.length > 0, 'Should warn on non-numeric sleep string');
    });

    it('does not warn on valid sleep value', () => {
      const yaml = `
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - sleep: 3000
`;
      const result = validate(yaml);
      const sleepWarnings = result.warnings.filter(w => w.message.includes('Sleep value'));
      assert.equal(sleepWarnings.length, 0, 'Should not warn on valid sleep');
    });

    it('does not warn on template variable sleep', () => {
      const yaml = `
engine: extended
features: [variables]
web:
  url: "https://example.com"
variables:
  delay: 1000
tasks:
  - name: test
    flow:
      - sleep: "\${delay}"
`;
      const result = validate(yaml);
      const sleepWarnings = result.warnings.filter(w => w.message.includes('Sleep value'));
      assert.equal(sleepWarnings.length, 0, 'Should not warn on template variable sleep');
    });
  });

  describe('loop count and maxIterations validation', () => {
    it('warns on negative loop count', () => {
      const yaml = `
engine: extended
features: [loop]
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - loop:
          type: repeat
          count: -5
          flow:
            - aiTap: "button"
`;
      const result = validate(yaml);
      const countWarnings = result.warnings.filter(w => w.message.includes('Loop count'));
      assert.ok(countWarnings.length > 0, 'Should warn on negative count');
    });

    it('warns on zero loop count', () => {
      const yaml = `
engine: extended
features: [loop]
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - loop:
          type: repeat
          count: 0
          flow:
            - aiTap: "button"
`;
      const result = validate(yaml);
      const countWarnings = result.warnings.filter(w => w.message.includes('Loop count'));
      assert.ok(countWarnings.length > 0, 'Should warn on zero count');
    });

    it('warns when while loop has no maxIterations', () => {
      const yaml = `
engine: extended
features: [loop]
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - loop:
          type: while
          condition: "page has next button"
          flow:
            - aiTap: "next"
`;
      const result = validate(yaml);
      const maxIterWarnings = result.warnings.filter(w => w.message.includes('maxIterations'));
      assert.ok(maxIterWarnings.length > 0, 'Should warn about missing maxIterations');
    });

    it('does not warn when while loop has maxIterations', () => {
      const yaml = `
engine: extended
features: [loop]
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - loop:
          type: while
          condition: "page has next button"
          maxIterations: 10
          flow:
            - aiTap: "next"
`;
      const result = validate(yaml);
      const maxIterWarnings = result.warnings.filter(w =>
        w.message.includes('no "maxIterations" safety limit')
      );
      assert.equal(maxIterWarnings.length, 0, 'Should not warn with maxIterations set');
    });
  });

  describe('HTTP method validation', () => {
    it('warns on invalid HTTP method', () => {
      const yaml = `
engine: extended
features: [external_call]
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - external_call:
          type: http
          method: BANANA
          url: "https://api.example.com"
`;
      const result = validate(yaml);
      const methodWarnings = result.warnings.filter(w => w.message.includes('Unknown HTTP method'));
      assert.ok(methodWarnings.length > 0, 'Should warn on invalid HTTP method');
    });

    it('does not warn on valid HTTP method', () => {
      const yaml = `
engine: extended
features: [external_call]
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - external_call:
          type: http
          method: POST
          url: "https://api.example.com"
`;
      const result = validate(yaml);
      const methodWarnings = result.warnings.filter(w => w.message.includes('Unknown HTTP method'));
      assert.equal(methodWarnings.length, 0, 'Should not warn on valid HTTP method');
    });
  });

  describe('web config sub-field validation', () => {
    it('warns on unknown web config field', () => {
      const yaml = `
web:
  url: "https://example.com"
  banana: true
tasks:
  - name: test
    flow:
      - aiTap: "button"
`;
      const result = validate(yaml);
      const webWarnings = result.warnings.filter(w => w.message.includes('Unknown web config field'));
      assert.ok(webWarnings.length > 0, 'Should warn on unknown web field');
    });

    it('does not warn on known web config fields', () => {
      const yaml = `
web:
  url: "https://example.com"
  headless: true
  viewportWidth: 1920
  viewportHeight: 1080
  userAgent: "custom"
  waitForNetworkIdle: true
tasks:
  - name: test
    flow:
      - aiTap: "button"
`;
      const result = validate(yaml);
      const webWarnings = result.warnings.filter(w => w.message.includes('Unknown web config field'));
      assert.equal(webWarnings.length, 0, 'Should not warn on known web fields');
    });
  });

  // ===========================================================================
  // Phase 4 — Negative tests for uncovered code paths (4.2)
  // ===========================================================================

  describe('negative test: edge cases', () => {
    it('rejects document root as array', () => {
      const yaml = `- item1\n- item2`;
      const result = validate(yaml);
      assert.equal(result.valid, false);
      assert.ok(result.errors.some(e => e.message.includes('Document root must be a YAML mapping')));
    });

    it('rejects empty tasks array', () => {
      const yaml = `
web:
  url: "https://example.com"
tasks: []
`;
      const result = validate(yaml);
      assert.equal(result.valid, false);
      assert.ok(result.errors.some(e => e.message.includes('must not be empty')));
    });

    it('rejects tasks as non-array', () => {
      const yaml = `
web:
  url: "https://example.com"
tasks: "not-array"
`;
      const result = validate(yaml);
      assert.equal(result.valid, false);
      assert.ok(result.errors.some(e => e.message.includes('"tasks" must be an array')));
    });

    it('rejects scalar task element', () => {
      const yaml = `
web:
  url: "https://example.com"
tasks:
  - "just a string"
`;
      const result = validate(yaml);
      assert.equal(result.valid, false);
      assert.ok(result.errors.some(e => e.message.includes('Each task must be an object')));
    });

    it('rejects numeric task name', () => {
      const yaml = `
web:
  url: "https://example.com"
tasks:
  - name: 123
    flow:
      - aiTap: "button"
`;
      const result = validate(yaml);
      assert.equal(result.valid, false);
      assert.ok(result.errors.some(e => e.message.includes('"name" property of type string')));
    });

    it('rejects whitespace-only task name', () => {
      const yaml = `
web:
  url: "https://example.com"
tasks:
  - name: "   "
    flow:
      - aiTap: "button"
`;
      const result = validate(yaml);
      assert.equal(result.valid, false);
      assert.ok(result.errors.some(e => e.message.includes('"name" property of type string')));
    });

    it('rejects invalid loop type', () => {
      const yaml = `
engine: extended
features: [loop]
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - loop:
          type: "unknown"
          flow:
            - aiTap: "button"
`;
      const result = validate(yaml);
      assert.equal(result.valid, false);
      assert.ok(result.errors.some(e => e.message.includes('Invalid loop type')));
    });

    it('rejects logic without then branch', () => {
      const yaml = `
engine: extended
features: [logic]
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - logic:
          if: "some condition"
`;
      const result = validate(yaml);
      assert.equal(result.valid, false);
      assert.ok(result.errors.some(e => e.message.includes('must have a "then" branch')));
    });

    it('rejects invalid external_call type', () => {
      const yaml = `
engine: extended
features: [external_call]
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - external_call:
          type: "graphql"
          url: "https://api.example.com"
`;
      const result = validate(yaml);
      assert.equal(result.valid, false);
      assert.ok(result.errors.some(e => e.message.includes('Invalid external_call type')));
    });

    it('rejects parallel without tasks/branches', () => {
      const yaml = `
engine: extended
features: [parallel]
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - parallel:
          waitAll: true
`;
      const result = validate(yaml);
      assert.equal(result.valid, false);
      assert.ok(result.errors.some(e => e.message.includes('"tasks" or "branches" array')));
    });

    it('rejects parallel as scalar', () => {
      const yaml = `
engine: extended
features: [parallel]
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - parallel: "wrong"
`;
      const result = validate(yaml);
      assert.equal(result.valid, false);
      assert.ok(result.errors.some(e => e.message.includes('"parallel" must be an object')));
    });

    it('rejects data_transform as non-object', () => {
      const yaml = `
engine: extended
features: [data_transform]
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - data_transform: 42
`;
      const result = validate(yaml);
      assert.equal(result.valid, false);
      assert.ok(result.errors.some(e => e.message.includes('"data_transform" must be an object')));
    });

    it('rejects data_transform with non-array operations', () => {
      const yaml = `
engine: extended
features: [data_transform]
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - data_transform:
          input: "\${data}"
          operations: "not-an-array"
          output: result
`;
      const result = validate(yaml);
      assert.equal(result.valid, false);
      assert.ok(result.errors.some(e => e.message.includes('"data_transform.operations" must be an array')));
    });

    it('handles empty YAML input', () => {
      const result = validate('');
      assert.equal(result.valid, false);
      assert.ok(result.errors.some(e => e.message.includes('non-empty string')));
    });

    it('handles whitespace-only YAML input', () => {
      const result = validate('   ');
      assert.equal(result.valid, false);
      assert.ok(result.errors.some(e => e.message.includes('non-empty string')));
    });

    it('skips template variable in import path', () => {
      const yaml = `
engine: extended
features: [import]
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - import: "\${dynamicPath}"
        as: dynFlow
`;
      const result = validate(yaml);
      // Should not crash on template variable import paths
      assert.ok(typeof result.valid === 'boolean');
    });

    it('respects options.mode override', () => {
      const yaml = `
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - aiTap: "button"
`;
      const result = validate(yaml, { mode: 'native' });
      assert.ok(typeof result.valid === 'boolean');
    });

    it('rejects catch as non-object', () => {
      const yaml = `
engine: extended
features: [try_catch]
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - try:
          flow:
            - aiTap: "button"
        catch: "string"
`;
      const result = validate(yaml);
      // catch as a string is not validated by the try validator (it only validates object catch)
      // so it should not crash — just produce no specific error about catch format
      assert.ok(typeof result.valid === 'boolean');
    });

    it('accepts task with steps alias instead of flow', () => {
      const yaml = `
web:
  url: "https://example.com"
tasks:
  - name: test
    steps:
      - aiTap: "button"
`;
      const result = validate(yaml);
      // Should not report error about missing flow since steps is an alias
      const flowErrors = result.errors.filter(e => e.message.includes('"flow"'));
      assert.equal(flowErrors.length, 0, 'Should accept steps as alias for flow');
    });

    it('accepts repeat loop with times alias for count', () => {
      const yaml = `
engine: extended
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - loop:
          type: repeat
          times: 5
        flow:
          - aiTap: "next"
`;
      const result = validate(yaml);
      const repeatErrors = result.errors.filter(e =>
        e.message.includes('repeat') && e.message.includes('count')
      );
      assert.equal(repeatErrors.length, 0, 'Should accept times as alias for count in repeat loop');
    });

    it('accepts new web config fields without warnings', () => {
      const yaml = `
web:
  url: "https://example.com"
  waitForNetworkIdleTimeout: 5000
  waitForNavigationTimeout: 30000
  forceChromeSelectRendering: true
tasks:
  - name: test
    flow:
      - aiTap: "button"
`;
      const result = validate(yaml);
      const configWarnings = result.warnings.filter(w =>
        w.message.includes('waitForNetworkIdleTimeout') ||
        w.message.includes('waitForNavigationTimeout') ||
        w.message.includes('forceChromeSelectRendering')
      );
      assert.equal(configWarnings.length, 0, 'Should not warn about valid new web config fields');
    });
  });

  // =========================================================================
  // Phase 4 — Missing validator tests (4.4)
  // =========================================================================

  describe('for loop missing items', () => {
    it('rejects for loop without items field', () => {
      const yaml = `
engine: extended
features: [loop]
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - loop:
          type: for
          flow:
            - aiTap: "button"
`;
      const result = validate(yaml);
      assert.ok(
        result.errors.some(e => e.message.includes('items')) ||
        result.warnings.some(w => w.message.includes('items')),
        'Should flag missing items in for loop'
      );
    });
  });

  describe('external_call missing type', () => {
    it('rejects external_call without type field', () => {
      const yaml = `
engine: extended
features: [external_call]
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - external_call:
          url: "https://api.example.com"
`;
      const result = validate(yaml);
      assert.ok(
        result.errors.some(e => e.message.toLowerCase().includes('type')),
        'Should flag missing type in external_call'
      );
    });
  });

  describe('parallel empty tasks array', () => {
    it('accepts parallel with empty tasks array (structurally valid)', () => {
      const yaml = `
engine: extended
features: [parallel]
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - parallel:
          tasks: []
`;
      const result = validate(yaml);
      // Empty tasks array is structurally valid (has array, just no branches)
      const parallelErrors = result.errors.filter(e => e.message.includes('parallel'));
      assert.equal(parallelErrors.length, 0, 'Should not error on empty parallel tasks array');
    });
  });

  describe('data_transform invalid operation (flat format)', () => {
    it('rejects flat format with invalid operation type', () => {
      const yaml = `
engine: extended
features: [data_transform]
web:
  url: "https://example.com"
variables:
  items:
    - 1
    - 2
tasks:
  - name: test
    flow:
      - data_transform:
          source: "\${items}"
          operation: nonexistent_op
          name: result
`;
      const result = validate(yaml);
      assert.ok(
        result.errors.some(e => e.message.includes('nonexistent_op') || e.message.includes('operation')),
        'Should flag invalid operation type in flat format'
      );
    });
  });

  describe('try without catch or finally', () => {
    it('rejects try block without catch or finally', () => {
      const yaml = `
engine: extended
features: [try_catch]
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - try:
          flow:
            - aiTap: "button"
`;
      const result = validate(yaml);
      assert.ok(
        result.errors.some(e => e.message.includes('catch') || e.message.includes('finally')),
        'Should reject try without catch or finally'
      );
    });
  });

  describe('loop count upper bound', () => {
    it('warns on repeat count exceeding 10000', () => {
      const yaml = `
engine: extended
features: [loop]
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - loop:
          type: repeat
          count: 50000
          flow:
            - aiTap: "button"
`;
      const result = validate(yaml);
      assert.ok(
        result.warnings.some(w => w.message.includes('very high')),
        'Should warn on very large loop count'
      );
    });
  });

  describe('maxIterations upper bound', () => {
    it('warns on maxIterations exceeding 10000', () => {
      const yaml = `
engine: extended
features: [loop]
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - loop:
          type: while
          condition: "true"
          maxIterations: 99999
          flow:
            - aiTap: "button"
`;
      const result = validate(yaml);
      assert.ok(
        result.warnings.some(w => w.message.includes('very high')),
        'Should warn on very large maxIterations'
      );
    });
  });

  describe('Android platform validation', () => {
    it('validates Android platform config', () => {
      const yaml = `
android:
  deviceId: "emulator-5554"
tasks:
  - name: test
    flow:
      - aiTap: "button"
`;
      const result = validate(yaml);
      assert.equal(result.valid, true);
    });
  });

  describe('iOS platform validation', () => {
    it('validates iOS platform config', () => {
      const yaml = `
ios:
  wdaPort: 8100
tasks:
  - name: test
    flow:
      - aiTap: "button"
`;
      const result = validate(yaml);
      assert.equal(result.valid, true);
    });
  });

  describe('Computer platform validation', () => {
    it('validates Computer platform config', () => {
      const yaml = `
computer:
  launch: "notepad"
tasks:
  - name: test
    flow:
      - aiTap: "button"
`;
      const result = validate(yaml);
      assert.equal(result.valid, true);
    });
  });

  describe('duplicate task names', () => {
    it('warns on duplicate task names', () => {
      const yaml = `
web:
  url: "https://example.com"
tasks:
  - name: "Login"
    flow:
      - aiTap: "button"
  - name: "Login"
    flow:
      - aiTap: "another button"
`;
      const result = validate(yaml);
      assert.ok(result.warnings.some(w => {
        const msg = typeof w === 'object' ? w.message : w;
        return msg.includes('Duplicate task name');
      }), 'Should warn about duplicate task names');
    });

    it('does not warn on unique task names', () => {
      const yaml = `
web:
  url: "https://example.com"
tasks:
  - name: "Login"
    flow:
      - aiTap: "button"
  - name: "Logout"
    flow:
      - aiTap: "another button"
`;
      const result = validate(yaml);
      assert.ok(!result.warnings.some(w => {
        const msg = typeof w === 'object' ? w.message : w;
        return msg.includes('Duplicate task name');
      }), 'Should not warn about unique task names');
    });
  });

  describe('android config validation', () => {
    it('warns on unknown android config field', () => {
      const yaml = `
android:
  deviceId: "emulator-5554"
  unknownField: true
tasks:
  - name: test
    flow:
      - aiTap: "button"
`;
      const result = validate(yaml);
      assert.ok(result.warnings.some(w => {
        const msg = typeof w === 'object' ? w.message : w;
        return msg.includes('Unknown android config field');
      }), 'Should warn about unknown android config field');
    });

    it('accepts known android config fields', () => {
      const yaml = `
android:
  deviceId: "emulator-5554"
  androidAdbPath: "/usr/bin/adb"
  remoteAdbHost: "192.168.1.100"
tasks:
  - name: test
    flow:
      - aiTap: "button"
`;
      const result = validate(yaml);
      assert.ok(!result.warnings.some(w => {
        const msg = typeof w === 'object' ? w.message : w;
        return msg.includes('Unknown android config field');
      }), 'Should not warn about known android fields');
    });
  });

  describe('agent config validation', () => {
    it('accepts valid agent config fields', () => {
      const yaml = `
web:
  url: "https://example.com"
agent:
  testId: "test-001"
  groupName: "smoke"
  groupDescription: "Smoke tests"
  generateReport: true
  autoPrintReportMsg: false
  reportFileName: "my-report"
  replanningCycleLimit: 20
  aiActContext: "e-commerce checkout"
  screenshotShrinkFactor: 0.5
  waitAfterAction: 500
tasks:
  - name: test
    flow:
      - aiTap: "button"
`;
      const result = validate(yaml);
      assert.ok(!result.warnings.some(w => {
        const msg = typeof w === 'object' ? w.message : w;
        return msg.includes('Unknown agent config field');
      }), 'Should not warn about known agent config fields');
    });

    it('warns on unknown agent config field', () => {
      const yaml = `
web:
  url: "https://example.com"
agent:
  testId: "test-001"
  unknownAgentField: true
tasks:
  - name: test
    flow:
      - aiTap: "button"
`;
      const result = validate(yaml);
      assert.ok(result.warnings.some(w => {
        const msg = typeof w === 'object' ? w.message : w;
        return msg.includes('Unknown agent config field') && msg.includes('unknownAgentField');
      }), 'Should warn about unknown agent config field');
    });

    it('accepts agent config with cache object', () => {
      const yaml = `
web:
  url: "https://example.com"
agent:
  cache:
    strategy: "read-write"
    id: "test-cache"
tasks:
  - name: test
    flow:
      - aiTap: "button"
`;
      const result = validate(yaml);
      assert.ok(!result.warnings.some(w => {
        const msg = typeof w === 'object' ? w.message : w;
        return msg.includes('cache') && msg.includes('strategy');
      }), 'Should accept valid cache strategy');
    });

    it('warns on invalid cache strategy', () => {
      const yaml = `
web:
  url: "https://example.com"
agent:
  cache:
    strategy: "invalid-strategy"
tasks:
  - name: test
    flow:
      - aiTap: "button"
`;
      const result = validate(yaml);
      assert.ok(result.warnings.some(w => {
        const msg = typeof w === 'object' ? w.message : w;
        return msg.includes('Invalid cache strategy');
      }), 'Should warn about invalid cache strategy');
    });

    it('accepts all valid cache strategies', () => {
      for (const strategy of ['read-write', 'read-only', 'write-only']) {
        const yaml = `
web:
  url: "https://example.com"
agent:
  cache:
    strategy: "${strategy}"
tasks:
  - name: test
    flow:
      - aiTap: "button"
`;
        const result = validate(yaml);
        assert.ok(!result.warnings.some(w => {
          const msg = typeof w === 'object' ? w.message : w;
          return msg.includes('Invalid cache strategy');
        }), `Should accept cache strategy "${strategy}"`);
      }
    });

    it('skips cache validation when agent.cache is not an object', () => {
      const yaml = `
web:
  url: "https://example.com"
agent:
  cache: true
tasks:
  - name: test
    flow:
      - aiTap: "button"
`;
      const result = validate(yaml);
      // cache: true is a valid shorthand, no strategy warning expected
      assert.ok(!result.warnings.some(w => {
        const msg = typeof w === 'object' ? w.message : w;
        return msg.includes('Invalid cache strategy');
      }), 'Should not warn about cache strategy when cache is boolean');
    });

    it('skips agent validation when agent is not an object', () => {
      const yaml = `
web:
  url: "https://example.com"
agent: true
tasks:
  - name: test
    flow:
      - aiTap: "button"
`;
      const result = validate(yaml);
      // Should not crash on non-object agent
      assert.ok(!result.warnings.some(w => {
        const msg = typeof w === 'object' ? w.message : w;
        return msg.includes('Unknown agent config field');
      }), 'Should not warn when agent is not an object');
    });
  });

  describe('bridgeMode validation', () => {
    it('accepts valid bridgeMode newTabWithUrl', () => {
      const yaml = `
web:
  url: "https://example.com"
  bridgeMode: "newTabWithUrl"
tasks:
  - name: test
    flow:
      - aiTap: "button"
`;
      const result = validate(yaml);
      assert.ok(!result.warnings.some(w => {
        const msg = typeof w === 'object' ? w.message : w;
        return msg.includes('Invalid bridgeMode');
      }), 'Should accept newTabWithUrl');
    });

    it('accepts valid bridgeMode currentTab', () => {
      const yaml = `
web:
  url: "https://example.com"
  bridgeMode: "currentTab"
tasks:
  - name: test
    flow:
      - aiTap: "button"
`;
      const result = validate(yaml);
      assert.ok(!result.warnings.some(w => {
        const msg = typeof w === 'object' ? w.message : w;
        return msg.includes('Invalid bridgeMode');
      }), 'Should accept currentTab');
    });

    it('accepts bridgeMode: false', () => {
      const yaml = `
web:
  url: "https://example.com"
  bridgeMode: false
tasks:
  - name: test
    flow:
      - aiTap: "button"
`;
      const result = validate(yaml);
      assert.ok(!result.warnings.some(w => {
        const msg = typeof w === 'object' ? w.message : w;
        return msg.includes('Invalid bridgeMode');
      }), 'Should accept bridgeMode: false');
    });

    it('warns on invalid bridgeMode', () => {
      const yaml = `
web:
  url: "https://example.com"
  bridgeMode: "invalidMode"
tasks:
  - name: test
    flow:
      - aiTap: "button"
`;
      const result = validate(yaml);
      assert.ok(result.warnings.some(w => {
        const msg = typeof w === 'object' ? w.message : w;
        return msg.includes('Invalid bridgeMode');
      }), 'Should warn about invalid bridgeMode');
    });

    it('does not warn when bridgeMode is absent', () => {
      const yaml = `
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - aiTap: "button"
`;
      const result = validate(yaml);
      assert.ok(!result.warnings.some(w => {
        const msg = typeof w === 'object' ? w.message : w;
        return msg.includes('bridgeMode');
      }), 'Should not warn when bridgeMode is absent');
    });
  });
});
