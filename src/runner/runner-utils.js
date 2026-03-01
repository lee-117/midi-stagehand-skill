'use strict';

/**
 * runner-utils.js
 * Shared utilities for native-runner and ts-runner.
 */

const path = require('path');
const fs = require('fs');
const os = require('os');

/**
 * Resolve a local CLI binary from `node_modules/.bin`, falling back to
 * an npx command if no local installation is found.
 *
 * @param {string} binName  - Binary name (e.g. 'midscene', 'tsx').
 * @param {string} npxFallback - npx command to use as fallback (e.g. 'npx tsx').
 * @returns {string} Quoted path to the local binary or the npx fallback.
 */
function resolveLocalBin(binName, npxFallback) {
  const isWin = os.platform() === 'win32';
  const localBin = path.resolve(__dirname, '..', '..', 'node_modules', '.bin', binName + (isWin ? '.cmd' : ''));
  if (fs.existsSync(localBin)) {
    return '"' + localBin + '"';
  }
  return npxFallback;
}

/**
 * Normalise an execSync error into a consistent `{ errorMessage, exitCode }` shape.
 * Handles killed processes (timeout/signal) and missing status codes.
 *
 * @param {Error} error - The error thrown by execSync.
 * @returns {{ errorMessage: string, exitCode: number|string }}
 */
function normaliseExecError(error) {
  let errorMessage = error.message;
  let exitCode = error.status;

  if (error.killed) {
    errorMessage = 'Process was killed (timeout or signal)';
    exitCode = exitCode || 'KILLED';
  } else if (exitCode === null || exitCode === undefined) {
    errorMessage = 'Process exited without a status code: ' + error.message;
    exitCode = 'UNKNOWN';
  }

  return { errorMessage, exitCode };
}

module.exports = {
  resolveLocalBin,
  normaliseExecError,
};
