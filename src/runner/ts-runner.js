const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const { resolveLocalBin, normaliseExecError, findSystemChrome } = require('./runner-utils');

/**
 * Run transpiled TypeScript code using tsx.
 *
 * @param {string} tsCode - TypeScript code string (or ignored if options.tsPath is set).
 * @param {object} [options]
 * @param {string} [options.tsPath] - Path to an existing .ts file to run instead.
 * @param {string} [options.reportDir='./midscene-report'] - Directory for reports.
 * @param {string} [options.cwd] - Working directory.
 * @param {number} [options.timeout=300000] - Execution timeout in ms.
 * @param {boolean} [options.keepTs=false] - Keep the generated temp file after execution.
 * @returns {{ success: boolean, tsPath: string, reportDir: string, error?: string, exitCode?: number|string }}
 */
function run(tsCode, options = {}) {
  const reportDir = options.reportDir || './midscene-report';

  // Validate input
  if (!options.tsPath && (!tsCode || typeof tsCode !== 'string' || tsCode.trim() === '')) {
    return { success: false, error: 'TypeScript code or tsPath is required', exitCode: null, tsPath: null, reportDir: reportDir };
  }

  // Write TS to temp file if code string is provided
  let tsPath = options.tsPath;
  let isTempFile = false;

  if (!tsPath) {
    const tmpDir = path.join(options.cwd || process.cwd(), '.midscene-tmp');
    try {
      if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    } catch (mkdirErr) {
      return { success: false, error: 'Failed to create temp directory: ' + mkdirErr.message, exitCode: null, tsPath: null, reportDir: reportDir };
    }
    tsPath = path.join(tmpDir, 'generated-' + Date.now() + '.ts');
    try {
      fs.writeFileSync(tsPath, tsCode, 'utf-8');
    } catch (writeErr) {
      return { success: false, error: 'Failed to write temp file: ' + writeErr.message, exitCode: null, tsPath: null, reportDir: reportDir };
    }
    isTempFile = true;
  } else {
    // Validate provided tsPath exists
    if (!fs.existsSync(tsPath)) {
      return { success: false, error: 'TypeScript file not found: ' + tsPath, exitCode: null, tsPath: tsPath, reportDir: reportDir };
    }
  }

  // Prefer local tsx installation over npx to avoid re-download
  const cmd = resolveTsxCommand() + ' "' + tsPath + '"';

  console.log('[ts-runner] Executing: ' + cmd);

  try {
    execSync(cmd, {
      stdio: 'inherit',
      cwd: options.cwd || process.cwd(),
      env: Object.assign({}, process.env, {
        MIDSCENE_REPORT_DIR: reportDir,
        PUPPETEER_EXECUTABLE_PATH: process.env.PUPPETEER_EXECUTABLE_PATH || findSystemChrome() || '',
      }),
      timeout: options.timeout || 300000
    });

    return { success: true, tsPath: tsPath, reportDir: reportDir };
  } catch (error) {
    const { errorMessage, exitCode } = normaliseExecError(error);
    return {
      success: false,
      error: errorMessage,
      exitCode: exitCode,
      tsPath: tsPath,
      reportDir: reportDir
    };
  } finally {
    // Clean up temp file unless user wants to keep it
    if (isTempFile && !options.keepTs) {
      try {
        if (fs.existsSync(tsPath)) {
          fs.unlinkSync(tsPath);
        }
      } catch (_cleanupErr) {
        // Silently ignore cleanup failures
      }
    }
  }
}

/**
 * Resolve the tsx command, preferring local installation.
 * @returns {string}
 */
function resolveTsxCommand() {
  return resolveLocalBin('tsx', 'npx tsx');
}

module.exports = { run };
