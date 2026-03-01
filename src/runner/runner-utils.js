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
 * @param {{ bin: string, args: string[] }} npxFallback - Fallback command for execFileSync.
 * @returns {{ bin: string, args: string[] }} Binary path and args for execFileSync (no shell).
 */
function resolveLocalBin(binName, npxFallback) {
  const isWin = os.platform() === 'win32';
  const localBin = path.resolve(__dirname, '..', '..', 'node_modules', '.bin', binName + (isWin ? '.cmd' : ''));
  if (fs.existsSync(localBin)) {
    return { bin: localBin, args: [] };
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
    const signal = error.signal ? ' (' + error.signal + ')' : '';
    errorMessage = 'Process was killed (timeout or signal)' + signal;
    exitCode = exitCode || 'KILLED';
  } else if (exitCode === null || exitCode === undefined) {
    errorMessage = 'Process exited without a status code: ' + error.message;
    exitCode = 'UNKNOWN';
  }

  return { errorMessage, exitCode };
}

/**
 * Find system Chrome/Chromium for Puppeteer.
 * @returns {string|null}
 */
function findSystemChrome() {
  const isWin = os.platform() === 'win32';
  const candidates = [];

  if (isWin) {
    const bases = [process.env['PROGRAMFILES'], process.env['PROGRAMFILES(X86)'], process.env['LOCALAPPDATA']].filter(Boolean);
    for (const base of bases) {
      candidates.push(path.join(base, 'Google', 'Chrome', 'Application', 'chrome.exe'));
    }
  } else if (os.platform() === 'darwin') {
    candidates.push('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
  } else {
    candidates.push('/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser');
  }

  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

module.exports = {
  resolveLocalBin,
  normaliseExecError,
  findSystemChrome,
};
