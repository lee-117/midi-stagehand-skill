const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

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

  const cmd = 'npx @midscene/web@1 run ' + resolvedPath;

  console.log('[native-runner] Executing: ' + cmd);

  try {
    execSync(cmd, {
      stdio: 'inherit',
      cwd: options.cwd || process.cwd(),
      env: Object.assign({}, process.env, { MIDSCENE_REPORT_DIR: reportDir }),
      timeout: options.timeout || 300000 // 5 min default
    });

    return { success: true, reportDir: reportDir };
  } catch (error) {
    // Distinguish between timeout, signal kill, and normal exit code errors
    let errorMessage = error.message;
    let exitCode = error.status;

    if (error.killed) {
      errorMessage = 'Process was killed (timeout or signal)';
      exitCode = exitCode || 'KILLED';
    } else if (exitCode === null || exitCode === undefined) {
      errorMessage = 'Process exited without a status code: ' + error.message;
      exitCode = 'UNKNOWN';
    }

    return {
      success: false,
      error: errorMessage,
      exitCode: exitCode,
      reportDir: reportDir
    };
  }
}

module.exports = { run };
