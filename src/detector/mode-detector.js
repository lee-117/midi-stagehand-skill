'use strict';

const yaml = require('js-yaml');
const fs = require('fs');

const { looksLikeFilePath } = require('../utils/yaml-helpers');
const { MAX_FILE_SIZE } = require('../constants');

/**
 * Canonical ordering of features in the reported `features` array.
 * Derived from schema/extended-keywords.json (single source of truth).
 */
const extSchema = require('../../schema/extended-keywords.json');
const FEATURE_ORDER = Object.keys(extSchema.features);

/**
 * Extended keywords that trigger needs_transpilation = true when found
 * as keys anywhere in the YAML document.
 * Derived from schema/extended-keywords.json (single source of truth).
 * Uses the primary trigger keywords from each feature.
 */
const EXTENDED_KEYWORDS = new Set(
  Object.values(extSchema.features).reduce((acc, feature) => {
    // Primary keyword (first in each feature's list) always triggers detection.
    acc.push(feature.keywords[0]);
    return acc;
  }, [])
);
// Add secondary trigger keywords that also indicate extended mode when used as object keys.
// 'use' is the invocation keyword for imported flows (maps to 'import' feature).
// 'try', 'catch', 'finally' are the three parts of error handling.
EXTENDED_KEYWORDS.add('use');
EXTENDED_KEYWORDS.add('catch');
EXTENDED_KEYWORDS.add('finally');

/**
 * Regex matching the template variable syntax ${...} within string values.
 */
const TEMPLATE_SYNTAX_REGEX = /\$\{[^}]+\}/;

/**
 * Maps raw extended keywords to the canonical feature name reported in the
 * `features` array. Keywords that belong to the same logical feature (e.g.
 * `try`, `catch`, `finally`) are collapsed into a single feature name.
 * Derived from schema/extended-keywords.json (single source of truth).
 */
const KEYWORD_TO_FEATURE = {};
for (const [feature, def] of Object.entries(extSchema.features)) {
  for (const kw of def.keywords) {
    if (EXTENDED_KEYWORDS.has(kw)) {
      KEYWORD_TO_FEATURE[kw] = feature;
    }
  }
}
// Manual additions for secondary trigger keywords
KEYWORD_TO_FEATURE.use = 'import';
KEYWORD_TO_FEATURE.try = 'try_catch';
KEYWORD_TO_FEATURE.catch = 'try_catch';
KEYWORD_TO_FEATURE.finally = 'try_catch';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Recursively walk a parsed YAML value and collect every extended keyword
 * found as an object key, as well as whether any string value contains the
 * template variable syntax.
 *
 * @param {*} node          - Current node in the parsed YAML tree.
 * @param {Set<string>} foundKeywords - Accumulator for matched keywords.
 * @param {{ templateUsed: boolean }} flags - Mutable flags object.
 */
function scan(node, foundKeywords, flags) {
  if (node === null || node === undefined) {
    return;
  }

  if (typeof node === 'string') {
    if (TEMPLATE_SYNTAX_REGEX.test(node)) {
      // Exclude ${ENV:xxx} and ${ENV.xxx} — environment variable references
      // don't require extended mode when used in platform config.
      const withoutEnvRefs = node.replace(/\$\{ENV[:.][^}]+\}/g, '');
      if (TEMPLATE_SYNTAX_REGEX.test(withoutEnvRefs)) {
        flags.templateUsed = true;
      }
    }
    return;
  }

  if (Array.isArray(node)) {
    for (const item of node) {
      scan(item, foundKeywords, flags);
    }
    return;
  }

  if (typeof node === 'object') {
    for (const key of Object.keys(node)) {
      if (EXTENDED_KEYWORDS.has(key)) {
        foundKeywords.add(key);
      }
      scan(node[key], foundKeywords, flags);
    }
  }
}

/**
 * Read YAML content – either from a file path or treat the input as a raw
 * YAML string.
 *
 * @param {string} yamlInput - File path or raw YAML string.
 * @returns {string} The raw YAML text.
 */
function resolveContent(yamlInput) {
  if (looksLikeFilePath(yamlInput)) {
    const stat = fs.statSync(yamlInput);
    if (stat.size > MAX_FILE_SIZE) {
      throw new Error('File exceeds 1MB size limit (' + Math.round(stat.size / 1024) + 'KB)');
    }
    return fs.readFileSync(yamlInput, 'utf8');
  }
  return yamlInput;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Detect the mode of a Midscene YAML Superset document.
 *
 * @param {string} yamlInput - A file path (`.yaml` / `.yml`) or a raw YAML
 *   content string.
 * @returns {{ mode: 'native' | 'extended', features: string[], needs_transpilation: boolean }}
 */
function detect(yamlInput) {
  if (typeof yamlInput === 'string' && yamlInput.trim() === '') {
    return { mode: 'native', features: [], needs_transpilation: false };
  }

  // Accept pre-parsed YAML object (avoids redundant parsing).
  if (yamlInput !== null && typeof yamlInput === 'object' && !Array.isArray(yamlInput)) {
    const foundKeywords = new Set();
    const flags = { templateUsed: false };
    scan(yamlInput, foundKeywords, flags);
    const features = buildFeatureList(foundKeywords, flags.templateUsed);
    const isExtended = features.length > 0;

    if (yamlInput.engine) {
      const declaredMode = String(yamlInput.engine).toLowerCase();
      if (declaredMode === 'extended' || declaredMode === 'native') {
        return {
          mode: declaredMode,
          features,
          needs_transpilation: declaredMode === 'extended' && (isExtended || flags.templateUsed),
        };
      }
      return {
        mode: isExtended ? 'extended' : 'native',
        features,
        needs_transpilation: isExtended,
        warnings: ['Unknown engine value "' + yamlInput.engine + '". Valid values are "native" or "extended". Falling back to auto-detection.'],
      };
    }

    return {
      mode: isExtended ? 'extended' : 'native',
      features,
      needs_transpilation: isExtended,
    };
  }

  if (typeof yamlInput !== 'string') {
    return { mode: 'native', features: [], needs_transpilation: false };
  }

  let content;
  try {
    content = resolveContent(yamlInput);
  } catch {
    return { mode: 'native', features: [], needs_transpilation: false };
  }

  let doc;
  try {
    doc = yaml.load(content);
  } catch {
    return { mode: 'native', features: [], needs_transpilation: false };
  }

  // ------------------------------------------------------------------
  // Scan for extended features (done once, shared by all branches).
  // ------------------------------------------------------------------
  const foundKeywords = new Set();
  const flags = { templateUsed: false };
  if (doc && typeof doc === 'object' && !Array.isArray(doc)) {
    scan(doc, foundKeywords, flags);
  }

  const features = buildFeatureList(foundKeywords, flags.templateUsed);
  const isExtended = features.length > 0;

  // ------------------------------------------------------------------
  // 1. If the document explicitly declares an `engine` field, honour it.
  // ------------------------------------------------------------------
  if (doc && typeof doc === 'object' && !Array.isArray(doc) && doc.engine) {
    const declaredMode = String(doc.engine).toLowerCase();
    if (declaredMode === 'extended' || declaredMode === 'native') {
      return {
        mode: declaredMode,
        features,
        needs_transpilation:
          declaredMode === 'extended' && (isExtended || flags.templateUsed),
      };
    }

    // Invalid engine value — warn and fall through to auto-detection.
    return {
      mode: isExtended ? 'extended' : 'native',
      features,
      needs_transpilation: isExtended,
      warnings: ['Unknown engine value "' + doc.engine + '". Valid values are "native" or "extended". Falling back to auto-detection.'],
    };
  }

  // ------------------------------------------------------------------
  // 2. No explicit engine – auto-detect from features.
  // ------------------------------------------------------------------
  return {
    mode: isExtended ? 'extended' : 'native',
    features,
    needs_transpilation: isExtended,
  };
}

/**
 * Build a deduplicated, sorted list of canonical feature names from the raw
 * keywords that were found during scanning.
 *
 * @param {Set<string>} foundKeywords
 * @param {boolean} templateUsed
 * @returns {string[]}
 */
function buildFeatureList(foundKeywords, templateUsed) {
  const featureSet = new Set();

  for (const kw of foundKeywords) {
    const feature = KEYWORD_TO_FEATURE[kw];
    if (feature) {
      featureSet.add(feature);
    }
  }

  // Template syntax (${...}) implies the `variables` feature.
  if (templateUsed) {
    featureSet.add('variables');
  }

  // Return a consistently ordered array.
  return FEATURE_ORDER.filter((f) => featureSet.has(f));
}

module.exports = {
  detect,
  EXTENDED_KEYWORDS,
  TEMPLATE_SYNTAX_REGEX,
};
