'use strict';

const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');

/**
 * Extended keywords that trigger needs_transpilation = true when found
 * as keys anywhere in the YAML document.
 */
const EXTENDED_KEYWORDS = new Set([
  'variables',
  'logic',
  'loop',
  'import',
  'use',
  'data_transform',
  'try',
  'catch',
  'finally',
  'external_call',
  'parallel',
]);

/**
 * Regex matching the template variable syntax ${...} within string values.
 */
const TEMPLATE_SYNTAX_REGEX = /\$\{[^}]+\}/;

/**
 * Maps raw extended keywords to the canonical feature name reported in the
 * `features` array. Keywords that belong to the same logical feature (e.g.
 * `try`, `catch`, `finally`) are collapsed into a single feature name.
 */
const KEYWORD_TO_FEATURE = {
  variables: 'variables',
  logic: 'logic',
  loop: 'loop',
  import: 'import',
  use: 'import',
  data_transform: 'data_transform',
  try: 'try_catch',
  catch: 'try_catch',
  finally: 'try_catch',
  external_call: 'external_call',
  parallel: 'parallel',
};

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
      flags.templateUsed = true;
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
 * Determine whether `input` looks like a file path rather than raw YAML
 * content. A string is treated as a path when it does not contain a newline
 * and ends with `.yaml` or `.yml`.
 *
 * @param {string} input
 * @returns {boolean}
 */
function looksLikeFilePath(input) {
  if (input.includes('\n')) {
    return false;
  }
  const ext = path.extname(input).toLowerCase();
  return ext === '.yaml' || ext === '.yml';
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
  if (typeof yamlInput !== 'string' || yamlInput.trim() === '') {
    return { mode: 'native', features: [], needs_transpilation: false };
  }

  let content;
  try {
    content = resolveContent(yamlInput);
  } catch (err) {
    return { mode: 'native', features: [], needs_transpilation: false };
  }

  let doc;
  try {
    doc = yaml.load(content);
  } catch (err) {
    return { mode: 'native', features: [], needs_transpilation: false };
  }

  // ------------------------------------------------------------------
  // 1. If the document explicitly declares an `engine` field, honour it.
  // ------------------------------------------------------------------
  if (doc && typeof doc === 'object' && !Array.isArray(doc) && doc.engine) {
    const declaredMode = String(doc.engine).toLowerCase();
    if (declaredMode === 'extended' || declaredMode === 'native') {
      // Even with an explicit engine declaration we still scan for features
      // so the caller knows which capabilities the file relies on.
      const foundKeywords = new Set();
      const flags = { templateUsed: false };
      scan(doc, foundKeywords, flags);

      const features = buildFeatureList(foundKeywords, flags.templateUsed);
      const needsTranspilation =
        declaredMode === 'extended' && (features.length > 0 || flags.templateUsed);

      return {
        mode: declaredMode,
        features,
        needs_transpilation: needsTranspilation,
      };
    }

    // Invalid engine value — warn and fall through to auto-detection.
    // The `warnings` array is returned so callers can surface this to users.
    const foundKeywords = new Set();
    const flags = { templateUsed: false };
    scan(doc, foundKeywords, flags);

    const features = buildFeatureList(foundKeywords, flags.templateUsed);
    const isExtended = features.length > 0;

    return {
      mode: isExtended ? 'extended' : 'native',
      features,
      needs_transpilation: isExtended,
      warnings: ['Unknown engine value "' + doc.engine + '". Valid values are "native" or "extended". Falling back to auto-detection.'],
    };
  }

  // ------------------------------------------------------------------
  // 2. No explicit engine – scan the entire document for extended usage.
  // ------------------------------------------------------------------
  const foundKeywords = new Set();
  const flags = { templateUsed: false };
  scan(doc, foundKeywords, flags);

  const features = buildFeatureList(foundKeywords, flags.templateUsed);
  const isExtended = features.length > 0;

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
  const ORDER = [
    'logic',
    'loop',
    'variables',
    'import',
    'data_transform',
    'try_catch',
    'external_call',
    'parallel',
  ];

  return ORDER.filter((f) => featureSet.has(f));
}

module.exports = {
  detect,
  EXTENDED_KEYWORDS,
  TEMPLATE_SYNTAX_REGEX,
};
