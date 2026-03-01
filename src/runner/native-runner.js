const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const { resolveLocalBin, normaliseExecError, findSystemChrome } = require('./runner-utils');

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

  // Prefer local installation over npx to avoid re-download.
  // Use execFileSync (no shell) to prevent command injection via file paths.
  const { bin, args: binArgs } = resolveMidsceneCommand();
  const execArgs = binArgs.concat('run', resolvedPath);

  console.log('[native-runner] Executing: ' + bin + ' ' + execArgs.join(' '));

  // Build env: inherit + report dir + system Chrome path if available
  const execEnv = Object.assign({}, process.env, { MIDSCENE_REPORT_DIR: reportDir });
  if (!execEnv.PUPPETEER_EXECUTABLE_PATH) {
    const chromePath = findSystemChrome();
    if (chromePath) {
      execEnv.PUPPETEER_EXECUTABLE_PATH = chromePath;
    }
  }

  try {
    execFileSync(bin, execArgs, {
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
 * Resolve the midscene CLI command for execFileSync usage.
 * @returns {{ bin: string, args: string[] }}
 */
function resolveMidsceneCommand() {
  return resolveLocalBin('midscene', { bin: 'npx', args: ['@midscene/web@1'] });
}

module.exports = { run };
