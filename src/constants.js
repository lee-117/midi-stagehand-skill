'use strict';

/**
 * constants.js
 * Centralized shared constants for the Midscene YAML Superset ecosystem.
 * Single source of truth — all modules should import from here.
 */

module.exports = {
  /** Maximum YAML file size in bytes (1 MB). */
  MAX_FILE_SIZE: 1024 * 1024,

  /** Default execution timeout in ms (5 minutes). */
  DEFAULT_TIMEOUT: 300000,

  /** Default report output directory. */
  DEFAULT_REPORT_DIR: './midscene-report',

  /** Default generated YAML output directory. */
  DEFAULT_OUTPUT_DIR: './midscene-output',

  /** Temporary directory for transpiled TypeScript files. */
  MIDSCENE_TMP_DIR: '.midscene-tmp',

  /** Maximum depth for import resolution (circular import guard). */
  MAX_IMPORT_DEPTH: 10,

  /** Midscene package specifier for npx fallback. */
  MIDSCENE_PKG: '@midscene/web@1',

  /** Stale temp file threshold in ms (24 hours). */
  STALE_TEMP_THRESHOLD_MS: 24 * 60 * 60 * 1000,

  /** Maximum error message length in CLI output before truncation. */
  MAX_ERROR_MESSAGE_LENGTH: 500,

  /** Maximum recursion depth for walkFlow to prevent stack overflow. */
  MAX_WALK_DEPTH: 50,
};
