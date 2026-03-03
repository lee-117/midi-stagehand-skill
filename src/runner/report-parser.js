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
    '在 .env 或环境变量中设置 MIDSCENE_MODEL_API_KEY',
    'fatal'],
  [/429|rate.?limit|too many requests/i, 'rate_limit',
    'AI API 限流。增加操作间 sleep 间隔；使用 --retry 配合等待；或切换到更高配额的 API Key',
    'recoverable'],
  [/timeout|timed?\s*out|ETIMEDOUT/i, 'timeout',
    '使用 --timeout 增加超时时间，或添加 sleep/aiWaitFor 等待步骤',
    'recoverable'],
  [/element.*not\s*found|cannot\s*find|no\s*matching|locate.*fail/i, 'element_not_found',
    '检查选择器/描述准确性。复杂布局使用 deepThink: true。交互前添加 aiWaitFor 等待元素就绪',
    'recoverable'],
  [/assert.*fail|assertion|expect.*but.*got/i, 'assertion',
    '检查断言条件是否匹配实际页面状态。查看 HTML 报告截图对比预期与实际',
    'recoverable'],
  [/target closed|browser.*crash|session.*closed|protocol error/i, 'browser_crash',
    'Chrome 进程崩溃。检查系统资源（内存/CPU）；尝试 headless: false 调试；运行 health-check.js 验证 Chrome',
    'fatal'],
  [/chrome.*not found|browser.*not found|no usable.*browser|ENOENT.*chrome/i, 'browser_not_found',
    'Chrome 未找到。运行 node scripts/health-check.js 检查；安装 Chrome 或设置 PUPPETEER_EXECUTABLE_PATH',
    'fatal'],
  [/ERR_INTERNET_DISCONNECTED|ECONNRESET|ECONNREFUSED|ERR_CONNECTION_REFUSED|ERR_NETWORK_CHANGED/i, 'network_failure',
    '网络连接失败。检查网络状态和代理配置（MIDSCENE_MODEL_HTTP_PROXY）',
    'fatal'],
  [/ERR_CERT|UNABLE_TO_VERIFY_LEAF_SIGNATURE|SSL_ERROR|certificate.*error|CERT_HAS_EXPIRED/i, 'ssl_certificate',
    'SSL/TLS 证书错误。检查目标网站证书是否有效；开发环境可设置 acceptInsecureCerts: true（仅开发环境）',
    'recoverable'],
  [/navigation|navigate|ERR_NAME_NOT_RESOLVED|net::/i, 'navigation',
    '检查 URL 是否正确且可访问。确认目标网站正在运行且网络可用',
    'recoverable'],
  [/transpil|compile|syntax\s*error|unexpected\s*token/i, 'transpiler',
    '检查 YAML 语法：使用 2 空格缩进、正确引号、有效的 Extended 语法结构',
    'fatal'],
  [/ENOSPC|no space left|disk full/i, 'disk_full',
    '磁盘空间不足。清理报告目录和临时文件（--clean）；释放磁盘空间',
    'fatal'],
  [/out of memory|heap.*limit|ENOMEM|allocation failed/i, 'memory_exhaustion',
    'OOM: 减少并行任务数、增加系统内存、或使用 --clean 清理临时文件',
    'fatal'],
  [/EACCES|EPERM|permission|denied/i, 'permission',
    '检查文件权限，确保进程有权访问所需目录',
    'fatal'],
  [/javascript|script\s*error|ReferenceError|TypeError|EvalError/i, 'javascript',
    '检查 YAML 中 javascript 步骤的代码。确认变量名和数据类型正确',
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
    return { category: 'unknown', suggestion: '查看完整错误输出了解详情', severity: 'recoverable' };
  }

  for (const [pattern, category, suggestion, severity] of ERROR_PATTERNS) {
    if (pattern.test(errorMessage)) {
      return { category, suggestion, severity };
    }
  }

  return { category: 'unknown', suggestion: '查看完整错误输出了解详情', severity: 'recoverable' };
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
  const aiQueryResults = Object.create(null);
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
    // Filter out prototype pollution keys before merging
    const BANNED_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
    if (task.output && typeof task.output === 'object') {
      for (const key of Object.keys(task.output)) {
        if (!BANNED_KEYS.has(key)) aiQueryResults[key] = task.output[key];
      }
    }
    if (task.results && typeof task.results === 'object') {
      for (const key of Object.keys(task.results)) {
        if (!BANNED_KEYS.has(key)) aiQueryResults[key] = task.results[key];
      }
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
  const allAiQueryResults = Object.create(null);
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
        if (details.aiQueryResults) {
          for (const key of Object.keys(details.aiQueryResults)) {
            allAiQueryResults[key] = details.aiQueryResults[key];
          }
        }
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
