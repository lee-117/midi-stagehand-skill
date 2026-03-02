'use strict';

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Error classification
// ---------------------------------------------------------------------------

/**
 * Known error patterns and their classification.
 * Each entry: [regex, category, suggestion, severity]
 *
 * ORDER MATTERS: More specific patterns must come before broader ones.
 * e.g. 'assertion' before 'javascript' (since assertion failures could
 * contain 'Error' which the javascript pattern would also match).
 */
const ERROR_PATTERNS = [
  [/MIDSCENE_MODEL_API_KEY|api[_-]?key|auth.*token|401/i, 'api_key',
    'Set MIDSCENE_MODEL_API_KEY in .env or environment variables.',
    'fatal'],
  [/429|rate.?limit|too many requests/i, 'rate_limit',
    'AI API 限流。增加操作间 sleep 间隔；使用 --retry 配合等待；或切换到更高配额的 API Key',
    'recoverable'],
  [/timeout|timed?\s*out|ETIMEDOUT/i, 'timeout',
    'Increase timeout with --timeout flag or add explicit sleep/wait steps.',
    'recoverable'],
  [/element.*not\s*found|cannot\s*find|no\s*matching|locate.*fail/i, 'element_not_found',
    'Check selector/description accuracy. Use deepThink: true for complex layouts. Add aiWaitFor before interaction.',
    'recoverable'],
  [/assert.*fail|assertion|expect.*but.*got/i, 'assertion',
    'Verify the expected condition matches the actual page state. Consider adding screenshots for debugging.',
    'recoverable'],
  [/target closed|browser.*crash|session.*closed|protocol error/i, 'browser_crash',
    'Chrome 进程崩溃。检查系统资源（内存/CPU）；尝试 headless: false 调试；运行 health-check.js 验证 Chrome',
    'fatal'],
  [/chrome.*not found|browser.*not found|no usable.*browser|ENOENT.*chrome/i, 'browser_not_found',
    'Chrome 未找到。运行 node scripts/health-check.js 检查；安装 Chrome 或设置 PUPPETEER_EXECUTABLE_PATH',
    'fatal'],
  [/ERR_INTERNET_DISCONNECTED|ECONNRESET|ECONNREFUSED|ERR_NETWORK_CHANGED/i, 'network_failure',
    '网络连接失败。检查网络状态和代理配置（MIDSCENE_MODEL_HTTP_PROXY）',
    'fatal'],
  [/navigation|navigate|ERR_NAME_NOT_RESOLVED|ERR_CONNECTION_REFUSED|net::/i, 'navigation',
    'Check the URL is correct and accessible. Ensure the site is running and network is available.',
    'recoverable'],
  [/transpil|compile|syntax\s*error|unexpected\s*token/i, 'transpiler',
    'Check YAML syntax: use 2 spaces for indentation, proper quoting, and valid extended constructs.',
    'fatal'],
  [/ENOSPC|no space left|disk full/i, 'disk_full',
    '磁盘空间不足。清理报告目录和临时文件（--clean）；释放磁盘空间',
    'fatal'],
  [/EACCES|EPERM|permission|denied/i, 'permission',
    'Check file permissions and ensure the process has access to the required directories.',
    'fatal'],
  [/javascript|script\s*error|ReferenceError|TypeError|EvalError/i, 'javascript',
    'Review the JavaScript code in your YAML steps. Check variable names and data types.',
    'recoverable'],
];

/**
 * Classify an error message into a category with a suggestion and severity.
 *
 * @param {string} errorMessage - The error message to classify.
 * @returns {{ category: string, suggestion: string, severity: 'fatal'|'recoverable'|'flaky' }}
 */
function classifyError(errorMessage) {
  if (!errorMessage || typeof errorMessage !== 'string') {
    return { category: 'unknown', suggestion: 'Check the full error output for details.', severity: 'recoverable' };
  }

  for (const [pattern, category, suggestion, severity] of ERROR_PATTERNS) {
    if (pattern.test(errorMessage)) {
      return { category, suggestion, severity };
    }
  }

  return { category: 'unknown', suggestion: 'Check the full error output for details.', severity: 'recoverable' };
}

// ---------------------------------------------------------------------------
// Task detail extraction
// ---------------------------------------------------------------------------

/**
 * Check if a task has passed.
 */
function isPassed(task) {
  return task.status === 'passed' || task.success === true;
}

/**
 * Extract detailed information from an array of tasks.
 *
 * @param {Array} tasks - Array of task objects from report JSON.
 * @returns {{ summary: object, failedTasks: Array, taskDetails: Array, aiQueryResults: object, totalDuration: number }}
 */
function extractTaskDetails(tasks) {
  const total = tasks.length;
  const passed = tasks.filter(isPassed).length;
  const failed = total - passed;

  const failedTasks = [];
  const taskDetails = [];
  const aiQueryResults = {};
  let totalDuration = 0;

  for (const task of tasks) {
    const taskPassed = isPassed(task);
    const duration = typeof task.duration === 'number' ? task.duration : 0;
    totalDuration += duration;

    const steps = task.flow || task.steps || [];
    const stepCount = Array.isArray(steps) ? steps.length : 0;

    taskDetails.push({
      name: task.name || '(unnamed)',
      status: taskPassed ? 'passed' : 'failed',
      duration,
      stepCount,
    });

    if (!taskPassed) {
      failedTasks.push({
        name: task.name || '(unnamed)',
        error: task.error || task.errorMessage || null,
        failedStep: task.failedStep || null,
        screenshotPath: task.screenshotPath || task.screenshot || null,
      });
    }

    // Extract aiQuery results from task output/results
    if (task.output && typeof task.output === 'object') {
      Object.assign(aiQueryResults, task.output);
    }
    if (task.results && typeof task.results === 'object') {
      Object.assign(aiQueryResults, task.results);
    }
  }

  return {
    summary: { total, passed, failed },
    failedTasks,
    taskDetails,
    aiQueryResults,
    totalDuration,
  };
}

/**
 * Extract summary from a single report content (backward-compatible).
 */
function extractSummary(content) {
  if (Array.isArray(content)) {
    return extractTaskDetails(content);
  }
  if (content.tasks && Array.isArray(content.tasks)) {
    return extractTaskDetails(content.tasks);
  }
  // Unknown format — return zero counts so callers get a consistent shape
  return {
    summary: { total: 0, passed: 0, failed: 0 },
    failedTasks: [],
    taskDetails: [],
    aiQueryResults: {},
    totalDuration: 0,
  };
}

// ---------------------------------------------------------------------------
// Overall summary
// ---------------------------------------------------------------------------

function buildOverallSummary(reports) {
  const jsonReports = reports.filter(r => r.type === 'json' && r.details && r.details.summary && r.details.summary.total);
  if (jsonReports.length === 0) return null;

  const total = jsonReports.reduce((sum, r) => sum + r.details.summary.total, 0);
  const passed = jsonReports.reduce((sum, r) => sum + r.details.summary.passed, 0);
  const failed = jsonReports.reduce((sum, r) => sum + r.details.summary.failed, 0);

  return { total, passed, failed, status: failed === 0 ? 'ALL PASSED' : 'HAS FAILURES' };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse report directory and extract detailed information.
 *
 * @param {string} reportDir - Path to the report directory.
 * @returns {{
 *   found: boolean,
 *   message?: string,
 *   reportDir?: string,
 *   files?: Array,
 *   summary?: { total: number, passed: number, failed: number, status: string },
 *   failedTasks?: Array<{ name: string, error: string|null, failedStep: string|null, screenshotPath: string|null }>,
 *   taskDetails?: Array<{ name: string, status: string, duration: number, stepCount: number }>,
 *   aiQueryResults?: object,
 *   totalDuration?: number,
 *   htmlReports?: string[]
 * }}
 */
function parse(reportDir) {
  const resolvedDir = path.resolve(reportDir);

  if (!fs.existsSync(resolvedDir)) {
    return { found: false, message: `Report directory not found: ${resolvedDir}` };
  }

  // Find report files (Midscene generates JSON reports).
  // { recursive: true } (Node 18.17+) returns relative paths including subdirectories.
  const files = fs.readdirSync(resolvedDir, { recursive: true })
    .filter(f => f.endsWith('.json') || f.endsWith('.html'))
    .map(f => path.join(resolvedDir, f));

  if (files.length === 0) {
    return { found: false, message: 'No report files found in directory' };
  }

  const reports = [];
  const allFailedTasks = [];
  const allTaskDetails = [];
  const allAiQueryResults = {};
  const htmlReports = [];
  let totalDuration = 0;

  for (const file of files) {
    if (file.endsWith('.json')) {
      try {
        const content = JSON.parse(fs.readFileSync(file, 'utf-8'));
        const details = extractSummary(content);
        reports.push({
          file: path.relative(resolvedDir, file),
          type: 'json',
          details,
        });

        // Aggregate details
        allFailedTasks.push(...details.failedTasks);
        allTaskDetails.push(...details.taskDetails);
        Object.assign(allAiQueryResults, details.aiQueryResults);
        totalDuration += details.totalDuration;
      } catch (parseErr) {
        reports.push({ file: path.relative(resolvedDir, file), type: 'json', error: 'Parse error: ' + (parseErr.message || 'unknown') });
      }
    } else {
      reports.push({ file: path.relative(resolvedDir, file), type: 'html' });
      htmlReports.push(file);
    }
  }

  const summary = buildOverallSummary(reports);

  return {
    found: true,
    reportDir: resolvedDir,
    files: reports,
    summary,
    failedTasks: allFailedTasks,
    taskDetails: allTaskDetails,
    aiQueryResults: Object.keys(allAiQueryResults).length > 0 ? allAiQueryResults : undefined,
    totalDuration,
    htmlReports: htmlReports.length > 0 ? htmlReports : undefined,
  };
}

module.exports = { parse, classifyError };
