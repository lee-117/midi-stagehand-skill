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

function isPassed(task) {
  return task.status === 'passed' || task.success === true;
}

function summarizeTasks(tasks) {
  const total = tasks.length;
  const passed = tasks.filter(isPassed).length;
  return { total, passed, failed: total - passed };
}

function extractSummary(content) {
  // Handle various Midscene report formats
  if (Array.isArray(content)) {
    return summarizeTasks(content);
  }
  if (content.tasks) {
    return summarizeTasks(content.tasks);
  }
  // Unknown format — return zero counts so callers get a consistent shape
  return { total: 0, passed: 0, failed: 0 };
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
