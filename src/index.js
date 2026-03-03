'use strict';

/**
 * Unified API surface for the Midscene YAML Superset framework.
 *
 * Usage:
 *   const { detect, validate, transpile, run, runTs, parseReport, classifyError, findSystemChrome } = require('midi-stagehand-skill');
 *
 * For CLI usage, use `node scripts/midscene-run.js <file>` instead.
 */

const { detect } = require('./detector/mode-detector');
const { validate } = require('./validator/yaml-validator');
const { transpile } = require('./transpiler/transpiler');
const nativeRunner = require('./runner/native-runner');
const tsRunner = require('./runner/ts-runner');
const reportParser = require('./runner/report-parser');
const { findSystemChrome } = require('./runner/runner-utils');
const { runYaml } = require('./runner/run-yaml');

module.exports = {
  detect,
  validate,
  transpile,
  run: nativeRunner.run,
  runTs: tsRunner.run,
  runYaml,
  parseReport: reportParser.parse,
  classifyError: reportParser.classifyError,
  findSystemChrome,
};
