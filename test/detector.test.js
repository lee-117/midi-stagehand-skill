'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { detect, EXTENDED_KEYWORDS, TEMPLATE_SYNTAX_REGEX } = require('../src/detector/mode-detector');

const fixtures = (...parts) => path.join(__dirname, 'fixtures', ...parts);

describe('Mode Detector', () => {
  describe('detect() with file paths', () => {
    it('detects native-simple.yaml as native', () => {
      const result = detect(fixtures('native-simple.yaml'));
      assert.equal(result.mode, 'native');
      assert.equal(result.needs_transpilation, false);
      assert.deepEqual(result.features, []);
    });

    it('detects native-complex.yaml as native', () => {
      const result = detect(fixtures('native-complex.yaml'));
      assert.equal(result.mode, 'native');
      assert.equal(result.needs_transpilation, false);
    });

    it('detects extended-logic.yaml as extended', () => {
      const result = detect(fixtures('extended-logic.yaml'));
      assert.equal(result.mode, 'extended');
      assert.equal(result.needs_transpilation, true);
      assert.ok(result.features.includes('logic'));
      assert.ok(result.features.includes('variables'));
    });

    it('detects extended-loop.yaml as extended', () => {
      const result = detect(fixtures('extended-loop.yaml'));
      assert.equal(result.mode, 'extended');
      assert.equal(result.needs_transpilation, true);
      assert.ok(result.features.includes('loop'));
      assert.ok(result.features.includes('variables'));
    });

    it('detects extended-full.yaml with all features', () => {
      const result = detect(fixtures('extended-full.yaml'));
      assert.equal(result.mode, 'extended');
      assert.equal(result.needs_transpilation, true);
      assert.ok(result.features.includes('logic'));
      assert.ok(result.features.includes('loop'));
      assert.ok(result.features.includes('variables'));
      assert.ok(result.features.includes('try_catch'));
      assert.ok(result.features.includes('external_call'));
      assert.ok(result.features.includes('data_transform'));
      assert.ok(result.features.includes('parallel'));
    });
  });

  describe('detect() with inline YAML strings', () => {
    it('detects inline native YAML', () => {
      const yaml = `
engine: native
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - aiTap: "button"
`;
      const result = detect(yaml);
      assert.equal(result.mode, 'native');
      assert.equal(result.needs_transpilation, false);
    });

    it('detects inline extended YAML with variables', () => {
      const yaml = `
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - variables:
          user: "admin"
      - aiInput: "username"
        value: "\${user}"
`;
      const result = detect(yaml);
      assert.equal(result.mode, 'extended');
      assert.equal(result.needs_transpilation, true);
      assert.ok(result.features.includes('variables'));
    });

    it('detects template syntax as implying variables feature', () => {
      const yaml = `
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - aiTap: "click \${buttonName}"
`;
      const result = detect(yaml);
      assert.equal(result.mode, 'extended');
      assert.ok(result.features.includes('variables'));
    });

    it('auto-detects extended mode without engine field', () => {
      const yaml = `
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - logic:
          if: "button is visible"
          then:
            - aiTap: "button"
`;
      const result = detect(yaml);
      assert.equal(result.mode, 'extended');
      assert.equal(result.needs_transpilation, true);
      assert.ok(result.features.includes('logic'));
    });
  });

  describe('engine field handling', () => {
    it('honours explicit engine: native declaration', () => {
      const yaml = `
engine: native
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - aiTap: "button"
`;
      const result = detect(yaml);
      assert.equal(result.mode, 'native');
      assert.equal(result.needs_transpilation, false);
      assert.equal(result.warnings, undefined);
    });

    it('honours explicit engine: extended declaration', () => {
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
      const result = detect(yaml);
      assert.equal(result.mode, 'extended');
      assert.equal(result.needs_transpilation, true);
      assert.ok(result.features.includes('variables'));
      assert.equal(result.warnings, undefined);
    });

    it('returns warnings for invalid engine value', () => {
      const yaml = `
engine: turbo
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - aiTap: "button"
`;
      const result = detect(yaml);
      assert.ok(result.warnings);
      assert.ok(result.warnings.length > 0);
      assert.ok(result.warnings[0].includes('turbo'));
      // Falls back to native since no extended features
      assert.equal(result.mode, 'native');
    });

    it('auto-detects extended with invalid engine when features present', () => {
      const yaml = `
engine: v2
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - logic:
          if: "visible"
          then:
            - aiTap: "btn"
`;
      const result = detect(yaml);
      assert.ok(result.warnings);
      assert.equal(result.mode, 'extended');
      assert.equal(result.needs_transpilation, true);
      assert.ok(result.features.includes('logic'));
    });
  });

  describe('edge cases', () => {
    it('returns native for empty input', () => {
      const result = detect('');
      assert.equal(result.mode, 'native');
      assert.equal(result.needs_transpilation, false);
    });

    it('returns native for invalid YAML', () => {
      const result = detect(':::invalid:::yaml:::');
      assert.equal(result.mode, 'native');
      assert.equal(result.needs_transpilation, false);
    });

    it('returns native for non-string input', () => {
      const result = detect(null);
      assert.equal(result.mode, 'native');
    });

    it('returns native for non-existent file', () => {
      const result = detect('/non/existent/file.yaml');
      assert.equal(result.mode, 'native');
      assert.equal(result.needs_transpilation, false);
    });
  });

  describe('detect() with new fixture files', () => {
    it('detects extended-import-use.yaml as extended with import', () => {
      const result = detect(fixtures('extended-import-use.yaml'));
      assert.equal(result.mode, 'extended');
      assert.equal(result.needs_transpilation, true);
      assert.ok(result.features.includes('import'));
    });

    it('detects extended-data-transform.yaml as extended with data_transform', () => {
      const result = detect(fixtures('extended-data-transform.yaml'));
      assert.equal(result.mode, 'extended');
      assert.equal(result.needs_transpilation, true);
      assert.ok(result.features.includes('data_transform'));
    });
  });

  describe('use keyword detection', () => {
    it('detects use step as import feature', () => {
      const yaml = `
web:
  url: "https://example.com"
tasks:
  - name: test
    flow:
      - use: "./common/login.yaml"
        with:
          user: "admin"
`;
      const result = detect(yaml);
      assert.equal(result.mode, 'extended');
      assert.ok(result.features.includes('import'));
    });
  });

  describe('EXTENDED_KEYWORDS', () => {
    it('contains expected keywords', () => {
      assert.ok(EXTENDED_KEYWORDS.has('variables'));
      assert.ok(EXTENDED_KEYWORDS.has('logic'));
      assert.ok(EXTENDED_KEYWORDS.has('loop'));
      assert.ok(EXTENDED_KEYWORDS.has('import'));
      assert.ok(EXTENDED_KEYWORDS.has('data_transform'));
      assert.ok(EXTENDED_KEYWORDS.has('try'));
      assert.ok(EXTENDED_KEYWORDS.has('catch'));
      assert.ok(EXTENDED_KEYWORDS.has('finally'));
      assert.ok(EXTENDED_KEYWORDS.has('external_call'));
      assert.ok(EXTENDED_KEYWORDS.has('parallel'));
    });

    it('does not contain native keywords', () => {
      assert.ok(!EXTENDED_KEYWORDS.has('aiTap'));
      assert.ok(!EXTENDED_KEYWORDS.has('web'));
      assert.ok(!EXTENDED_KEYWORDS.has('tasks'));
    });
  });

  describe('detect() with pre-parsed objects', () => {
    it('detects native mode from pre-parsed object', () => {
      const doc = {
        web: { url: 'https://example.com' },
        tasks: [{ name: 'test', flow: [{ aiTap: 'button' }] }],
      };
      const result = detect(doc);
      assert.strictEqual(result.mode, 'native');
      assert.deepStrictEqual(result.features, []);
    });

    it('detects extended mode from pre-parsed object', () => {
      const doc = {
        engine: 'extended',
        features: ['variables', 'logic'],
        web: { url: 'https://example.com' },
        variables: { x: 1 },
        tasks: [{ name: 'test', flow: [{ logic: { if: 'true', then: [] } }] }],
      };
      const result = detect(doc);
      assert.strictEqual(result.mode, 'extended');
      assert.ok(result.features.includes('variables'));
      assert.ok(result.features.includes('logic'));
    });

    it('respects engine declaration in pre-parsed object', () => {
      const doc = {
        engine: 'native',
        web: { url: 'https://example.com' },
        tasks: [{ name: 'test', flow: [{ aiTap: 'button' }] }],
      };
      const result = detect(doc);
      assert.strictEqual(result.mode, 'native');
    });

    it('returns native for null input', () => {
      const result = detect(null);
      assert.strictEqual(result.mode, 'native');
    });

    it('returns native for array input', () => {
      const result = detect([1, 2, 3]);
      assert.strictEqual(result.mode, 'native');
    });
  });

  describe('ENV reference exclusion', () => {
    it('does not trigger variables feature for ENV-only references', () => {
      const yaml = `
web:
  url: "\${ENV:BASE_URL}"
tasks:
  - name: test
    flow:
      - aiTap: "button"
`;
      const result = detect(yaml);
      assert.strictEqual(result.mode, 'native');
      assert.ok(!result.features.includes('variables'));
    });

    it('still triggers variables for non-ENV template syntax', () => {
      const yaml = `
engine: extended
web:
  url: "https://example.com"
variables:
  name: "test"
tasks:
  - name: test
    flow:
      - aiInput: "field"
        value: "\${name}"
`;
      const result = detect(yaml);
      assert.ok(result.features.includes('variables'));
    });
  });

  describe('TEMPLATE_SYNTAX_REGEX', () => {
    it('matches template syntax', () => {
      assert.ok(TEMPLATE_SYNTAX_REGEX.test('${variable}'));
      assert.ok(TEMPLATE_SYNTAX_REGEX.test('hello ${name} world'));
      assert.ok(TEMPLATE_SYNTAX_REGEX.test('${ENV.API_KEY}'));
    });

    it('does not match non-template strings', () => {
      assert.ok(!TEMPLATE_SYNTAX_REGEX.test('no template here'));
      assert.ok(!TEMPLATE_SYNTAX_REGEX.test('$notTemplate'));
      assert.ok(!TEMPLATE_SYNTAX_REGEX.test('{}'));
    });
  });
});
