const fs = require('fs');
const path = require('path');

function parse(reportDir) {
  const resolvedDir = path.resolve(reportDir);

  if (!fs.existsSync(resolvedDir)) {
    return { found: false, message: `Report directory not found: ${resolvedDir}` };
  }

  // Find report files (Midscene generates JSON reports)
  const files = fs.readdirSync(resolvedDir)
    .filter(f => f.endsWith('.json') || f.endsWith('.html'))
    .map(f => path.join(resolvedDir, f));

  if (files.length === 0) {
    return { found: false, message: 'No report files found in directory' };
  }

  const reports = [];
  for (const file of files) {
    if (file.endsWith('.json')) {
      try {
        const content = JSON.parse(fs.readFileSync(file, 'utf-8'));
        reports.push({
          file: path.basename(file),
          type: 'json',
          summary: extractSummary(content)
        });
      } catch (e) {
        reports.push({ file: path.basename(file), type: 'json', error: 'Parse error' });
      }
    } else {
      reports.push({ file: path.basename(file), type: 'html' });
    }
  }

  return {
    found: true,
    reportDir: resolvedDir,
    files: reports,
    summary: buildOverallSummary(reports)
  };
}

function extractSummary(content) {
  // Handle various Midscene report formats
  if (Array.isArray(content)) {
    const total = content.length;
    const passed = content.filter(t => t.status === 'passed' || t.success === true).length;
    const failed = total - passed;
    return { total, passed, failed };
  }
  if (content.tasks) {
    const total = content.tasks.length;
    const passed = content.tasks.filter(t => t.status === 'passed' || t.success).length;
    return { total, passed, failed: total - passed };
  }
  return { raw: typeof content === 'object' ? Object.keys(content) : 'unknown format' };
}

function buildOverallSummary(reports) {
  const jsonReports = reports.filter(r => r.type === 'json' && r.summary && r.summary.total);
  if (jsonReports.length === 0) return null;

  const total = jsonReports.reduce((sum, r) => sum + r.summary.total, 0);
  const passed = jsonReports.reduce((sum, r) => sum + r.summary.passed, 0);
  const failed = jsonReports.reduce((sum, r) => sum + r.summary.failed, 0);

  return { total, passed, failed, status: failed === 0 ? 'ALL PASSED' : 'HAS FAILURES' };
}

module.exports = { parse };
