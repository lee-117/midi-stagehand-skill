const { execSync } = require('child_process');
const path = require('path');

function run(yamlPath, options = {}) {
  const resolvedPath = path.resolve(yamlPath);
  const reportDir = options.reportDir || './midscene-report';

  const cmd = `npx @midscene/web@1 run ${resolvedPath}`;

  console.log(`[native-runner] Executing: ${cmd}`);

  try {
    const output = execSync(cmd, {
      stdio: 'inherit',
      cwd: options.cwd || process.cwd(),
      env: { ...process.env, MIDSCENE_REPORT_DIR: reportDir },
      timeout: options.timeout || 300000 // 5 min default
    });

    return { success: true, reportDir };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      exitCode: error.status,
      reportDir
    };
  }
}

module.exports = { run };
