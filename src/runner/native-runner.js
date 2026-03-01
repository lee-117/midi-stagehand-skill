const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { resolveLocalBin, normaliseExecError } = require('./runner-utils');

/**
 * Check if a YAML file exists and is readable.
 * @param {string} filePath
 * @returns {{ ok: boolean, error?: string }}
 */
function checkYamlFile(filePath) {
  if (!filePath || typeof filePath !== 'string') {
    return { ok: false, error: 'YAML file path is required' };
  }
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    return { ok: false, error: 'YAML file not found: ' + resolved };
  }
  const ext = path.extname(resolved).toLowerCase();
  if (ext !== '.yaml' && ext !== '.yml') {
    return { ok: false, error: 'File must have .yaml or .yml extension: ' + resolved };
  }
  return { ok: true };
}

/**
 * Run a Midscene YAML file natively using @midscene/web CLI.
 *
 * @param {string} yamlPath - Path to the YAML file.
 * @param {object} [options]
 * @param {string} [options.reportDir='./midscene-report'] - Directory for reports.
 * @param {string} [options.cwd] - Working directory.
 * @param {number} [options.timeout=300000] - Execution timeout in ms.
 * @returns {{ success: boolean, reportDir: string, error?: string, exitCode?: number }}
 */
function run(yamlPath, options = {}) {
  // Validate input
  const check = checkYamlFile(yamlPath);
  if (!check.ok) {
    return { success: false, error: check.error, exitCode: null, reportDir: options.reportDir || './midscene-report' };
  }

  const resolvedPath = path.resolve(yamlPath);
  const reportDir = options.reportDir || './midscene-report';

  // Prefer local installation over npx to avoid re-download
  const cmd = resolveMidsceneCommand() + ' run "' + resolvedPath + '"';

  console.log('[native-runner] Executing: ' + cmd);

  // Build env: inherit + report dir + system Chrome path if available
  const execEnv = Object.assign({}, process.env, { MIDSCENE_REPORT_DIR: reportDir });
  if (!execEnv.PUPPETEER_EXECUTABLE_PATH) {
    const chromePath = findSystemChrome();
    if (chromePath) {
      execEnv.PUPPETEER_EXECUTABLE_PATH = chromePath;
    }
  }

  try {
    execSync(cmd, {
      stdio: 'inherit',
      cwd: options.cwd || process.cwd(),
      env: execEnv,
      timeout: options.timeout || 300000 // 5 min default
    });

    return { success: true, reportDir: reportDir };
  } catch (error) {
    const { errorMessage, exitCode } = normaliseExecError(error);
    return {
      success: false,
      error: errorMessage,
      exitCode: exitCode,
      reportDir: reportDir
    };
  }
}

/**
 * Resolve the midscene CLI command, preferring local installation.
 * @returns {string}
 */
function resolveMidsceneCommand() {
  return resolveLocalBin('midscene', 'npx @midscene/web@1');
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

module.exports = { run };
