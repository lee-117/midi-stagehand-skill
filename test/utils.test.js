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
  escapeRegExp,
  getPad,
  isValidIdentifier,
  sanitizeIdentifier,
} = require('../src/transpiler/generators/utils');

describe('transpiler generator utils', () => {
  // -------------------------------------------------------------------------
  // resolveEnvRefs
  // -------------------------------------------------------------------------
  describe('resolveEnvRefs', () => {
    it('resolves ${ENV.XXX} to process.env', () => {
      assert.equal(resolveEnvRefs('${ENV.API_KEY}'), '${process.env.API_KEY}');
    });

    it('resolves ${ENV:XXX} colon syntax', () => {
      assert.equal(resolveEnvRefs('${ENV:SECRET}'), '${process.env.SECRET}');
    });

    it('resolves multiple env refs', () => {
      assert.equal(
        resolveEnvRefs('${ENV.A} and ${ENV:B}'),
        '${process.env.A} and ${process.env.B}'
      );
    });

    it('returns non-env strings unchanged', () => {
      assert.equal(resolveEnvRefs('plain text'), 'plain text');
    });

    it('returns non-string values unchanged', () => {
      assert.equal(resolveEnvRefs(42), 42);
      assert.equal(resolveEnvRefs(null), null);
    });
  });

  // -------------------------------------------------------------------------
  // resolveTemplate
  // -------------------------------------------------------------------------
  describe('resolveTemplate', () => {
    it('returns plain strings unchanged', () => {
      assert.equal(resolveTemplate('hello'), 'hello');
    });

    it('returns __expr for single variable expression', () => {
      const result = resolveTemplate('${myVar}');
      assert.equal(result.__expr, 'myVar');
    });

    it('returns __template for mixed template', () => {
      const result = resolveTemplate('hello ${name}!');
      assert.equal(result.__template, '`hello ${name}!`');
    });

    it('resolves ENV references in template', () => {
      const result = resolveTemplate('${ENV.KEY}');
      assert.equal(result.__expr, 'process.env.KEY');
    });

    it('returns non-string values unchanged', () => {
      assert.equal(resolveTemplate(42), 42);
      assert.equal(resolveTemplate(null), null);
    });
  });

  // -------------------------------------------------------------------------
  // toCodeString
  // -------------------------------------------------------------------------
  describe('toCodeString', () => {
    it('wraps plain strings in single quotes', () => {
      assert.equal(toCodeString('hello'), "'hello'");
    });

    it('converts numbers to string', () => {
      assert.equal(toCodeString(42), '42');
    });

    it('converts booleans to string', () => {
      assert.equal(toCodeString(true), 'true');
      assert.equal(toCodeString(false), 'false');
    });

    it('returns __template as-is', () => {
      assert.equal(toCodeString({ __template: '`hi ${x}`' }), '`hi ${x}`');
    });

    it('returns __expr as-is', () => {
      assert.equal(toCodeString({ __expr: 'myVar' }), 'myVar');
    });

    it('returns undefined for null/undefined', () => {
      assert.equal(toCodeString(null), 'undefined');
      assert.equal(toCodeString(undefined), 'undefined');
    });

    it('JSON-stringifies other objects', () => {
      assert.equal(toCodeString({ a: 1 }), '{"a":1}');
    });
  });

  // -------------------------------------------------------------------------
  // extractVarRef
  // -------------------------------------------------------------------------
  describe('extractVarRef', () => {
    it('extracts simple variable name', () => {
      assert.equal(extractVarRef('${items}'), 'items');
    });

    it('extracts dotted variable path', () => {
      assert.equal(extractVarRef('${data.list}'), 'data.list');
    });

    it('returns null for non-variable strings', () => {
      assert.equal(extractVarRef('hello'), null);
    });

    it('returns null for partial variable', () => {
      assert.equal(extractVarRef('prefix${x}'), null);
    });

    it('returns null for non-string input', () => {
      assert.equal(extractVarRef(42), null);
    });
  });

  // -------------------------------------------------------------------------
  // escapeStringLiteral
  // -------------------------------------------------------------------------
  describe('escapeStringLiteral', () => {
    it('escapes backslashes', () => {
      assert.equal(escapeStringLiteral('a\\b'), 'a\\\\b');
    });

    it('escapes single quotes', () => {
      assert.equal(escapeStringLiteral("it's"), "it\\'s");
    });

    it('escapes backticks', () => {
      assert.equal(escapeStringLiteral('a`b'), 'a\\`b');
    });

    it('escapes template expressions', () => {
      assert.equal(escapeStringLiteral('${x}'), '\\${x}');
    });

    it('escapes newlines, carriage returns, tabs', () => {
      assert.equal(escapeStringLiteral('a\nb'), 'a\\nb');
      assert.equal(escapeStringLiteral('a\rb'), 'a\\rb');
      assert.equal(escapeStringLiteral('a\tb'), 'a\\tb');
    });

    it('returns non-string input unchanged', () => {
      assert.equal(escapeStringLiteral(42), 42);
    });
  });

  // -------------------------------------------------------------------------
  // escapeForTemplateLiteral
  // -------------------------------------------------------------------------
  describe('escapeForTemplateLiteral', () => {
    it('escapes backslashes', () => {
      assert.equal(escapeForTemplateLiteral('a\\b'), 'a\\\\b');
    });

    it('escapes backticks', () => {
      assert.equal(escapeForTemplateLiteral('a`b'), 'a\\`b');
    });

    it('escapes ${', () => {
      assert.equal(escapeForTemplateLiteral('${x}'), '\\${x}');
    });

    it('returns non-string input unchanged', () => {
      assert.equal(escapeForTemplateLiteral(null), null);
    });
  });

  // -------------------------------------------------------------------------
  // escapeRegExp
  // -------------------------------------------------------------------------
  describe('escapeRegExp', () => {
    it('escapes regex special characters', () => {
      assert.equal(escapeRegExp('a.b*c?d'), 'a\\.b\\*c\\?d');
    });

    it('escapes brackets and parens', () => {
      assert.equal(escapeRegExp('[a](b)'), '\\[a\\]\\(b\\)');
    });
  });

  // -------------------------------------------------------------------------
  // getPad
  // -------------------------------------------------------------------------
  describe('getPad', () => {
    it('returns empty string for 0', () => {
      assert.equal(getPad(0), '');
    });

    it('returns 2 spaces for indent 1', () => {
      assert.equal(getPad(1), '  ');
    });

    it('returns 4 spaces for indent 2', () => {
      assert.equal(getPad(2), '    ');
    });

    it('handles undefined as 0', () => {
      assert.equal(getPad(undefined), '');
    });
  });

  // -------------------------------------------------------------------------
  // isValidIdentifier
  // -------------------------------------------------------------------------
  describe('isValidIdentifier', () => {
    it('accepts valid identifiers', () => {
      assert.equal(isValidIdentifier('myVar'), true);
      assert.equal(isValidIdentifier('_private'), true);
      assert.equal(isValidIdentifier('$jquery'), true);
      assert.equal(isValidIdentifier('a1b2'), true);
    });

    it('rejects invalid identifiers', () => {
      assert.equal(isValidIdentifier('1abc'), false);
      assert.equal(isValidIdentifier('my-var'), false);
      assert.equal(isValidIdentifier('my var'), false);
      assert.equal(isValidIdentifier(''), false);
    });

    it('rejects non-string input', () => {
      assert.equal(isValidIdentifier(42), false);
      assert.equal(isValidIdentifier(null), false);
    });
  });

  // -------------------------------------------------------------------------
  // sanitizeIdentifier
  // -------------------------------------------------------------------------
  describe('sanitizeIdentifier', () => {
    it('returns valid identifiers unchanged', () => {
      assert.equal(sanitizeIdentifier('myVar'), 'myVar');
    });

    it('replaces invalid characters with underscore', () => {
      assert.equal(sanitizeIdentifier('my-var'), 'my_var');
      assert.equal(sanitizeIdentifier('my var'), 'my_var');
    });

    it('prepends underscore if starts with number', () => {
      assert.equal(sanitizeIdentifier('1abc'), '_1abc');
    });

    it('returns _unnamed for empty string', () => {
      assert.equal(sanitizeIdentifier(''), '_unnamed');
    });

    it('returns _unnamed for non-string', () => {
      assert.equal(sanitizeIdentifier(null), '_unnamed');
    });
  });
});
