'use strict';

/**
 * run-yaml.js
 * Unified orchestration function: validate → detect → execute → parse report.
 *
 * This is the programmatic equivalent of `scripts/midscene-run.js`.
 * For CLI usage, prefer `node scripts/midscene-run.js <file>` instead.
 */

const path = require('path');
const { detect } = require('../detector/mode-detector');
const nativeRunner = require('./native-runner');
const tsRunner = require('./ts-runner');
const reportParser = require('./report-parser');
const { DEFAULT_REPORT_DIR } = require('../constants');

/**
 * Run a Midscene YAML file through the full pipeline:
 * validate → detect mode → execute (native or extended) → parse report.
 *
 * @param {string} yamlPath - Path to the YAML file.
 * @param {object} [options]
 * @param {string} [options.reportDir='./midscene-report'] - Report output directory.
 * @param {string} [options.template='playwright'] - TS template (puppeteer|playwright), for extended mode.
 * @param {number} [options.timeout=300000] - Execution timeout in ms.
 * @param {boolean} [options.skipValidation=false] - Skip YAML validation (not recommended).
 * @returns {{ success: boolean, mode: string, report?: object, error?: string, phase?: string, exitCode?: number|string }}
 */
function runYaml(yamlPath, options = {}) {
  const reportDir = options.reportDir || DEFAULT_REPORT_DIR;

  // Step 1: Validate (unless explicitly skipped)
  if (!options.skipValidation) {
    try {
      const { validate } = require('../validator/yaml-validator');
      const validation = validate(yamlPath);
      if (!validation.valid) {
        return {
          success: false,
          mode: 'unknown',
          phase: 'validation',
          error: (validation.errors || []).map(e => typeof e === 'object' ? e.message : String(e)).join('; '),
          warnings: validation.warnings,
        };
      }
    } catch (e) {
      return { success: false, mode: 'unknown', phase: 'validation', error: 'Validator unavailable: ' + e.message };
    }
  }

  // Step 2: Detect mode
  const detection = detect(yamlPath);

  // Step 3: Execute
  let result;
  if (detection.mode === 'native') {
    result = nativeRunner.run(yamlPath, {
      reportDir,
      cwd: path.dirname(path.resolve(yamlPath)),
      timeout: options.timeout,
    });
  } else {
    // Extended: transpile then execute
    try {
      const { transpile } = require('../transpiler/transpiler');
      const transpileResult = transpile(yamlPath, { templateType: options.template || 'playwright' });
      if (transpileResult.error) {
        return { success: false, mode: 'extended', phase: 'transpile', error: transpileResult.error };
      }
      result = tsRunner.run(transpileResult.code, {
        reportDir,
        cwd: path.dirname(path.resolve(yamlPath)),
        timeout: options.timeout,
      });
    } catch (e) {
      return { success: false, mode: 'extended', phase: 'transpile', error: e.message };
    }
  }

  // Step 4: Parse report
  let report;
  try {
    report = reportParser.parse(result.reportDir || reportDir);
  } catch { /* report parsing is best-effort */ }

  return {
    success: result.success,
    mode: detection.mode,
    features: detection.features,
    report,
    error: result.error,
    exitCode: result.exitCode,
  };
}

module.exports = { runYaml };
