const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

function run(tsCode, options = {}) {
  // Write TS to temp file if code string is provided
  let tsPath = options.tsPath;

  if (!tsPath) {
    const tmpDir = path.join(process.cwd(), '.midscene-tmp');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    tsPath = path.join(tmpDir, `generated-${Date.now()}.ts`);
    fs.writeFileSync(tsPath, tsCode, 'utf-8');
  }

  const reportDir = options.reportDir || './midscene-report';
  const cmd = `npx tsx ${tsPath}`;

  console.log(`[ts-runner] Executing: ${cmd}`);

  try {
    execSync(cmd, {
      stdio: 'inherit',
      cwd: options.cwd || process.cwd(),
      env: { ...process.env, MIDSCENE_REPORT_DIR: reportDir },
      timeout: options.timeout || 300000
    });

    return { success: true, tsPath, reportDir };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      exitCode: error.status,
      tsPath,
      reportDir
    };
  } finally {
    // Clean up temp file unless user wants to keep it
    if (!options.keepTs && !options.tsPath && fs.existsSync(tsPath)) {
      fs.unlinkSync(tsPath);
    }
  }
}

module.exports = { run };
