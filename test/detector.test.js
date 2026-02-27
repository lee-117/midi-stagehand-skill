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
