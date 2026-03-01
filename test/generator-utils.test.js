'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  resolveEnvRefs,
  resolveTemplate,
  toCodeString,
  extractVarRef,
  escapeStringLiteral,
  escapeForTemplateLiteral,
  isValidIdentifier,
  sanitizeIdentifier,
  getPad,
} = require('../src/transpiler/generators/utils');

// ---------------------------------------------------------------------------
// resolveEnvRefs
// ---------------------------------------------------------------------------
describe('resolveEnvRefs', () => {
  it('resolves ${ENV.XXX} to process.env.XXX', () => {
    assert.equal(resolveEnvRefs('${ENV.API_KEY}'), '${process.env.API_KEY}');
  });

  it('resolves ${ENV:XXX} to process.env.XXX', () => {
    assert.equal(resolveEnvRefs('${ENV:DB_HOST}'), '${process.env.DB_HOST}');
  });

  it('returns non-string input unchanged', () => {
    assert.equal(resolveEnvRefs(42), 42);
    assert.equal(resolveEnvRefs(null), null);
  });

  it('handles strings without ENV refs', () => {
    assert.equal(resolveEnvRefs('hello world'), 'hello world');
  });
});

// ---------------------------------------------------------------------------
// resolveTemplate
// ---------------------------------------------------------------------------
describe('resolveTemplate', () => {
  it('returns plain string unchanged', () => {
    assert.equal(resolveTemplate('hello'), 'hello');
  });

  it('returns non-string unchanged', () => {
    assert.equal(resolveTemplate(42), 42);
  });

  it('resolves single ${var} to __expr', () => {
    const result = resolveTemplate('${myVar}');
    assert.deepEqual(result, { __expr: 'myVar' });
  });

  it('resolves mixed template to __template', () => {
    const result = resolveTemplate('prefix ${name} suffix');
    assert.ok(result.__template, 'Should have __template');
    assert.ok(result.__template.includes('${name}'));
  });

  it('resolves ENV.XXX inside template', () => {
    const result = resolveTemplate('${ENV.TOKEN}');
    assert.deepEqual(result, { __expr: 'process.env.TOKEN' });
  });
});

// ---------------------------------------------------------------------------
// toCodeString
// ---------------------------------------------------------------------------
describe('toCodeString', () => {
  it('wraps plain string in single quotes', () => {
    assert.equal(toCodeString('hello'), "'hello'");
  });

  it('returns number as string', () => {
    assert.equal(toCodeString(42), '42');
  });

  it('returns boolean as string', () => {
    assert.equal(toCodeString(true), 'true');
  });

  it('returns undefined for null', () => {
    assert.equal(toCodeString(null), 'undefined');
  });

  it('returns __template as-is', () => {
    assert.equal(toCodeString({ __template: '`hello ${name}`' }), '`hello ${name}`');
  });

  it('returns __expr as-is', () => {
    assert.equal(toCodeString({ __expr: 'myVar' }), 'myVar');
  });

  it('JSON-stringifies objects without __template/__expr', () => {
    const result = toCodeString({ key: 'val' });
    assert.equal(result, '{"key":"val"}');
  });
});

// ---------------------------------------------------------------------------
// extractVarRef
// ---------------------------------------------------------------------------
describe('extractVarRef', () => {
  it('extracts simple variable reference', () => {
    assert.equal(extractVarRef('${items}'), 'items');
  });

  it('extracts dotted variable reference', () => {
    assert.equal(extractVarRef('${data.list}'), 'data.list');
  });

  it('returns null for non-string', () => {
    assert.equal(extractVarRef(42), null);
  });

  it('returns null for non-template string', () => {
    assert.equal(extractVarRef('plain'), null);
  });

  it('returns null for mixed template', () => {
    assert.equal(extractVarRef('prefix ${var}'), null);
  });
});

// ---------------------------------------------------------------------------
// escapeStringLiteral
// ---------------------------------------------------------------------------
describe('escapeStringLiteral', () => {
  it('escapes single quotes', () => {
    assert.equal(escapeStringLiteral("it's"), "it\\'s");
  });

  it('escapes backslashes', () => {
    assert.equal(escapeStringLiteral('a\\b'), 'a\\\\b');
  });

  it('escapes backticks', () => {
    assert.equal(escapeStringLiteral('a`b'), 'a\\`b');
  });

  it('escapes template syntax', () => {
    assert.equal(escapeStringLiteral('${var}'), '\\${var}');
  });

  it('escapes newlines and tabs', () => {
    assert.equal(escapeStringLiteral('a\nb\tc'), 'a\\nb\\tc');
  });

  it('returns non-string unchanged', () => {
    assert.equal(escapeStringLiteral(42), 42);
  });
});

// ---------------------------------------------------------------------------
// escapeForTemplateLiteral
// ---------------------------------------------------------------------------
describe('escapeForTemplateLiteral', () => {
  it('escapes backtick and dollar-brace', () => {
    assert.equal(escapeForTemplateLiteral('`${x}`'), '\\`\\${x}\\`');
  });

  it('returns non-string unchanged', () => {
    assert.equal(escapeForTemplateLiteral(null), null);
  });
});

// ---------------------------------------------------------------------------
// isValidIdentifier / sanitizeIdentifier
// ---------------------------------------------------------------------------
describe('isValidIdentifier', () => {
  it('accepts valid identifiers', () => {
    assert.ok(isValidIdentifier('myVar'));
    assert.ok(isValidIdentifier('_private'));
    assert.ok(isValidIdentifier('$jquery'));
    assert.ok(isValidIdentifier('a1'));
  });

  it('rejects invalid identifiers', () => {
    assert.ok(!isValidIdentifier('1abc'));
    assert.ok(!isValidIdentifier('my-var'));
    assert.ok(!isValidIdentifier(''));
    assert.ok(!isValidIdentifier(42));
  });
});

describe('sanitizeIdentifier', () => {
  it('returns valid identifiers unchanged', () => {
    assert.equal(sanitizeIdentifier('myVar'), 'myVar');
  });

  it('replaces hyphens with underscores', () => {
    assert.equal(sanitizeIdentifier('my-var'), 'my_var');
  });

  it('prefixes leading digits', () => {
    assert.equal(sanitizeIdentifier('1abc'), '_1abc');
  });

  it('returns _unnamed for empty input', () => {
    assert.equal(sanitizeIdentifier(''), '_unnamed');
    assert.equal(sanitizeIdentifier(42), '_unnamed');
  });
});

// ---------------------------------------------------------------------------
// getPad
// ---------------------------------------------------------------------------
describe('getPad', () => {
  it('returns empty string for 0', () => {
    assert.equal(getPad(0), '');
  });

  it('returns 2 spaces per level', () => {
    assert.equal(getPad(1), '  ');
    assert.equal(getPad(3), '      ');
  });

  it('handles undefined/null', () => {
    assert.equal(getPad(undefined), '');
    assert.equal(getPad(null), '');
  });
});
