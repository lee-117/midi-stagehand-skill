# Midi Stagehand Skill — Claude Code 项目指引

## 项目概述

这是一个低代码浏览器自动化框架（Midscene YAML 超集生态系统），核心链路：**自然语言 → YAML → 执行 → 报告**。

支持两种执行模式：
- **Native**：基础操作（点击、输入、断言等），YAML 直接执行
- **Extended**：复杂逻辑（条件、循环、API 调用），先转译为 TypeScript 再执行

## 项目结构

```
src/utils/          → 共享工具模块 (yaml-helpers.js)：文件路径检测、flow/steps 别名解析、通用递归 walker
src/detector/       → 模式检测器 (mode-detector.js)，判断 YAML 是 native 还是 extended
src/validator/      → 4 层 YAML 验证（语法→结构→模式→语义）
src/transpiler/     → Extended YAML → TypeScript 转译器
  generators/       → 10 个代码生成器 + 共享工具模块
                      (native/variable/logic/loop/import/use/data-transform/try-catch/external-call/parallel + utils)
src/runner/         → 执行器（native-runner + ts-runner + runner-utils + report-parser）
scripts/            → CLI 入口 (midscene-run.js)
schema/             → 关键字 Schema 定义（native-keywords.json + extended-keywords.json）
templates/          → 41 个 YAML 模板（native 25 个 + extended 16 个）
                      新增 native: web-iframe-shadow-dom, mobile-gesture, web-file-chooser,
                        web-freeze-context, web-image-prompt, web-cache-strategy
                      新增 extended: web-visual-regression, cross-platform-workflow,
                        error-recovery-pattern, data-accumulation-loop
skills/             → Claude Code Skill 定义（见下方）
guide/              → 渐进式指导手册（L1-L5）
test/               → 745 个单元测试（13 个测试文件）
```

### 架构流程图

```
YAML 文件
  │
  ▼
mode-detector ──→ 判断 Native / Extended
  │
  ▼
yaml-validator ──→ 4 层验证（语法→结构→模式→语义）
  │
  ├─ Native ────→ native-runner ──→ @midscene/web 直接执行
  │
  └─ Extended ──→ transpiler ──→ TypeScript ──→ ts-runner ──→ 执行
                                                    │
                                                    ▼
                                              report-parser ──→ 报告解析
```

## Skills（技能）

项目包含两个互补的 Claude Code Skill：

### 1. Midscene YAML Generator (`skills/midscene-yaml-generator/`)
- **触发**: 用户描述浏览器自动化需求时
- **功能**: 将自然语言需求转换为 Midscene YAML 文件
- **流程**: 分析需求复杂度 → 确定平台 → 转换为 YAML → 选择模板 → 生成并验证

### 2. Midscene Runner (`skills/midscene-runner/`)
- **触发**: 用户需要执行 YAML 文件时
- **功能**: 验证、执行 YAML 文件并解读报告
- **流程**: 环境检查 → 定位文件 → 预验证 → 执行 → 分析结果 → 报告解读

### 典型工作流

```
用户需求 → [Generator] 生成 YAML → [Runner] --dry-run 验证 → [Runner] 执行 → 查看报告
```

## 常用命令

```bash
# 安装依赖
npm install

# 运行 YAML
node scripts/midscene-run.js <yaml-file>

# 仅验证不执行
node scripts/midscene-run.js <yaml-file> --dry-run

# 保存转译的 TS
node scripts/midscene-run.js <yaml-file> --output-ts output.ts

# 批量执行
node scripts/midscene-run.js "tests/**/*.yaml"

# 限制批量文件数
node scripts/midscene-run.js "tests/**/*.yaml" --max-files 50

# JSON Lines 格式输出
node scripts/midscene-run.js <yaml-file> --json-log

# 详细输出
node scripts/midscene-run.js <yaml-file> -v

# 运行测试
npm test

# 运行测试 + 覆盖率
npm run test:coverage

# 代码检查
npm run lint

# 环境健康检查
node scripts/health-check.js
```

## 关键技术约定

### YAML 语法约定

- YAML 缩进统一使用 **2 个空格**
- Extended 模式必须显式声明 `engine: extended`
- 变量引用语法: `${varName}`，环境变量: `${ENV:NAME}` 或 `${ENV.NAME}`
- 顶层 `variables` 和 `import` 块在 tasks 之前声明
- `sleep` schema 支持模板变量字符串 `${...}`
- `variables` schema 支持 null 类型
- 生成的 YAML 输出到 `./midscene-output/` 目录
- 执行报告输出到 `./midscene-report/` 目录

### Native 动作参考

- AI 指令使用自然语言描述，优先于 CSS 选择器或 XPath
- `aiAction` 为 `ai`/`aiAct` 的有效别名（推荐 `aiAct`）
- `aiLongPress` 支持 `duration` 参数（毫秒）
- `freezePageContext`/`unfreezePageContext` 冻结/恢复页面上下文（值为 `true`）
- Android 系统按钮: `AndroidBackButton`, `AndroidHomeButton`, `AndroidRecentAppsButton`（值为 `true`）
- iOS 系统按钮: `IOSHomeButton`, `IOSAppSwitcher`（值为 `true`）
- `domIncluded` 支持三值：`false` | `true` | `'visible-only'`

### Extended 语法参考

- `use` 步骤调用导入的子流程: `use: "${flowRef}"` + `with: { params }`
- `parallel` 支持 `tasks` 和 `branches` 两种别名
- `data_transform` 支持平面格式 (source/operation/name) 和嵌套格式 (input/operations/output)
- 循环支持 `itemVar`/`as`/`item` 别名和 `indexVar` 自定义索引变量
- `importDirective` schema 使用 `flow:`/`data:`/`file:` keys（非 `import:`）
- Guide 全文 `steps:` → `flow:` 统一（loop/try/catch/finally 内部）

### 平台配置

- **Android**: `deviceId`, `androidAdbPath`, `remoteAdbHost`, `remoteAdbPort`, `screenshotResizeScale`, `alwaysRefreshScreenInfo`, `keyboardDismissStrategy` (`esc-first`|`back-first`), `imeStrategy` (`always-yadb`|`yadb-for-non-ascii`, 默认 `yadb-for-non-ascii`), `scrcpyConfig` (对象), `displayId`, `launch`, `output`
- **iOS**: `wdaPort`, `wdaHost`, `autoDismissKeyboard`, `launch`, `output`, `unstableLogContent`
- **Computer**: `displayId`, `launch`, `output`, `xvfbResolution`（格式 `WIDTHxHEIGHTxDEPTH`）, `headless`（Linux Xvfb 无头模式）
- **Agent**: `modelConfig` (对象), `outputFormat` (`single-html`|`html-and-external-assets`), `cache` 策略等 15 个配置字段

### CLI 行为

- `--output-ts` 路径必须以 `.ts` 结尾
- CLI 失败任务详情和错误分类默认显示
- `native-runner` 执行 `MAX_FILE_SIZE` 文件大小检查
- 报告解析器 `parse()` 递归读取子目录

### 安全设计

- `setup.js` / `health-check.js` / runners 使用 `execFileSync`（防命令注入，不使用 shell）
- 临时文件使用 `crypto.randomUUID()` 命名
- `setup.js` 的 `findSystemChrome` 从 `runner-utils.js` 导入（memoized）
- 安全检测：JS 注入 / ADB 危险命令 / SSRF 内部 URL / 路径遍历 / `acceptInsecureCerts` 警告 / `runWdaRequest` 破坏性 URL 检测
- JS 注入扩展检测：`fetch(`、`XMLHttpRequest`、`sendBeacon`、`document.cookie`
- ADB 扩展检测：`am force-stop`、`settings put`、`svc data/wifi disable`、`pm disable`
- SSRF 扩展检测：IPv6 回环 (`[::1]`)、IPv6 映射 IPv4 (`[::ffff:127.0.0.1]`)、GCP 元数据 (`metadata.google.internal`)
- `runWdaRequest` 破坏性 URL 检测：delete / uninstall / reset 操作
- `maxAliases` 限制从 100 降低至 25（防 YAML alias 炸弹）
- 变量收集：支持 AI 动作 name 字段 + javascript 步骤 name/output

### 错误分类

13 类错误，含严重性级别：

| 类别 | 严重性 | 说明 |
|------|--------|------|
| `api_key` | fatal | API 密钥无效或缺失 |
| `timeout` | recoverable | 操作超时 |
| `element_not_found` | recoverable | 元素定位失败 |
| `assertion` | recoverable | 断言验证失败 |
| `navigation` | recoverable | 页面导航错误 |
| `transpiler` | fatal | YAML 转译失败 |
| `permission` | fatal | 权限不足 |
| `javascript` | recoverable | JavaScript 执行错误 |
| `rate_limit` | recoverable | API 调用频率受限 |
| `browser_crash` | fatal | 浏览器进程崩溃 |
| `browser_not_found` | fatal | 未找到浏览器 |
| `network_failure` | fatal | 网络连接失败 |
| `disk_full` | fatal | 磁盘空间不足 |

## 关键文件

| 文件 | 用途 |
|------|------|
| `scripts/midscene-run.js` | CLI 主入口 |
| `src/utils/yaml-helpers.js` | 共享工具：looksLikeFilePath, getNestedFlow, getParallelBranches, getLoopItemVar, walkFlow, walkAllFlows |
| `src/detector/mode-detector.js` | 模式检测 |
| `src/validator/yaml-validator.js` | 验证逻辑 |
| `src/transpiler/transpiler.js` | 转译核心 |
| `src/transpiler/generators/utils.js` | 生成器共享工具（resolveEnvRefs, resolveTemplate, toCodeString, escapeStringLiteral, getPad 等） |
| `src/runner/native-runner.js` | Native YAML 直接执行器 |
| `src/runner/ts-runner.js` | TypeScript 执行器 |
| `src/runner/runner-utils.js` | 执行器共享工具（resolveLocalBin, normaliseExecError, findSystemChrome） |
| `src/runner/report-parser.js` | Midscene 报告解析器（parse, classifyError） |
| `src/constants.js` | 共享常量（MAX_FILE_SIZE, DEFAULT_TIMEOUT, MAX_WALK_DEPTH 等） |
| `scripts/health-check.js` | 环境健康检查（Node.js、npm、Chrome、依赖） |
| `schema/native-keywords.json` | Native 关键字定义 |
| `schema/extended-keywords.json` | Extended 关键字定义 |
| `schema/yaml-superset-schema.json` | 完整 JSON Schema |
| `guide/MIDSCENE_YAML_GUIDE.md` | 用户指导手册 |

## 测试结构

745 个测试，分布在 13 个测试文件中：

| 测试文件 | 覆盖范围 |
|---------|---------|
| `test/detector.test.js` | 模式检测器：Native/Extended 判定逻辑 |
| `test/validator.test.js` | 4 层验证：语法、结构、模式、语义 + 安全检测 |
| `test/transpiler.test.js` | YAML → TypeScript 转译：10 个生成器 |
| `test/cli.test.js` | CLI 参数解析、选项验证、错误提示 |
| `test/runner.test.js` | Native/TS 执行器逻辑 |
| `test/runner-utils.test.js` | resolveLocalBin, normaliseExecError, findSystemChrome |
| `test/generator-utils.test.js` | 生成器共享工具函数 |
| `test/yaml-helpers.test.js` | YAML 工具函数：walkFlow, 别名解析 |
| `test/utils.test.js` | 通用工具函数 |
| `test/constants.test.js` | 共享常量导出验证 |
| `test/integration.test.js` | 端到端集成：检测→验证→转译 |
| `test/integration-skills.test.js` | Skills 集成：SKILL.md 格式、模板引用 |
| `test/health-check.test.js` | 健康检查脚本 |
