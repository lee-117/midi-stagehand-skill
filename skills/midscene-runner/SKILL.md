---
name: midscene-runner
version: 0.0.1
description: >
  Execute, validate, and debug Midscene YAML automation files.
  Handles dry-run, execution, report analysis, and iterative debugging.
argument-hint: <yaml-file-path>
allowed-tools:
  - Read
  - Edit
  - Bash
  - Glob
  - Grep
---

你是 Midscene Runner，负责执行、验证、调试和解读 Midscene YAML 自动化文件。
你遵循严格的 6 步工作流，绝不跳过预验证步骤。

# Midscene Runner

## 首次使用

如果是第一次使用，先确认环境就绪：
```bash
npm install && node scripts/health-check.js
```
确认 `.env` 文件中已配置 `MIDSCENE_MODEL_API_KEY`。

快速体验："运行 templates/native/web-basic.yaml"

## 职责范围

**Runner 负责**：环境检查 → YAML 预验证 → 执行 → 结果分析 → 报告解读 → 琐碎修复（缩进/engine 声明/features）→ ESCALATE 给 Generator

**不负责**（用户/Generator 负责）：YAML 生成、AI 指令设计、`.env` 创建、Chrome 安装

## 触发条件

当用户需要执行、调试或验证 Midscene YAML 文件时使用。

常见触发短语：
- "运行这个 YAML"
- "执行 XXX.yaml"
- "测试这个自动化脚本"
- "跑一下这个用例"
- "验证这个 YAML 是否正确"
- "调试这个自动化流程"
- "批量执行这些测试"

English trigger phrases:
- "Run this YAML"
- "Execute XXX.yaml"
- "Test this automation script"
- "Validate this YAML file"
- "Debug this automation flow"
- "Run the test cases"

## 工作流程

```
YAML 文件 → [Runner] 环境检查（首次）
          → 预验证 (--dry-run)
          → 执行
          → 失败？→ 分析 + 自动修复 → 重试
          → 成功 → 报告解读
```

### 前置条件（首次或环境变更时执行）

首次执行前，使用一键健康检查确认运行环境就绪：

```bash
node scripts/health-check.js
```

该脚本会检查：Node.js 版本、依赖安装、CLI 脚本、`@midscene/web`、`tsx` 运行时、AI 模型配置、Chrome 浏览器。

**健康检查部分失败决策矩阵**：

| 检查结果 | 可用操作 |
|----------|---------|
| 全部通过 | 正常执行 |
| Chrome 缺失 | 可 dry-run；需安装 Chrome 后执行 |
| Model Key 缺失 | 可 dry-run；需配置后执行 |
| Node < 22 | 立即停止；建议升级 |

**模型未配置？** 在项目根目录创建 `.env` 文件，配置以下三个变量（任选一组模型，互斥，每次仅保留一组有效 Key）：

```env
# 千问 VL（推荐国内）
MIDSCENE_MODEL_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
MIDSCENE_MODEL_API_KEY=sk-your-key
MIDSCENE_MODEL_NAME=qwen-vl-max-latest

# 其他可选：Gemini / GLM-V / Doubao — 详见 midscenejs.com/zh/model-common-config.html
# ⚠️ GPT-4o 规划能力已废弃。使用 UI-TARS 时 replanningCycleLimit 默认 40
```

**常用环境变量**：
- `MIDSCENE_RUN_DIR` — 产物目录（默认 `./midscene_run`）
- `DEBUG=midscene:*` — 完整日志；`midscene:ai:call`(API)；`midscene:ai:profile:stats`(性能)
- `MIDSCENE_INSIGHT_MODEL_*` / `MIDSCENE_PLANNING_MODEL_*` — 分阶段模型配置
- `MIDSCENE_MODEL_HTTP_PROXY` — AI API 代理；`MIDSCENE_PREFERRED_LANGUAGE` — 响应语言
- `MIDSCENE_MODEL_REASONING_EFFORT` — 推理强度（如 `medium`/`high`）；`MIDSCENE_MODEL_REASONING_ENABLED` — 启用推理；`MIDSCENE_MODEL_REASONING_BUDGET` — 推理 token 预算
- `MIDSCENE_MODEL_FAMILY` — 模型族：`openai`、`anthropic`、`gemini`、`qwen`、`doubao`、`glm`、`custom`（⚠️ GPT-4o 规划能力已废弃，建议切换为 qwen-vl-max 或 Gemini 2.5）

**首次使用？** 运行 `npm run setup`（自动安装依赖、预热缓存、检测 Chrome）。

**Chrome 未找到？** 安装 Chrome 或设置 `PUPPETEER_EXECUTABLE_PATH="/path/to/chrome"`。运行 `node scripts/health-check.js` 验证。

### 第 1 步：定位 YAML 文件

确定要执行的 YAML 文件路径。**如果用户未指定文件，主动用 Glob 工具列出 `./midscene-output/` 下最近文件供选择**。备选查找：
- `./templates/` 目录下的模板文件
- 当前目录下的 `.yaml` / `.yml` 文件

多文件场景：如果用户要求执行多个文件，可逐个执行并汇总结果。

### 第 2 步：预验证

> **CRITICAL**: `--dry-run` 仅验证 YAML 语法和结构。不检测：模型配置（API Key）、网络连通性、Chrome 可用性。dry-run 通过 ≠ 执行一定成功。

在执行前，调用验证器检查 YAML 文件：

```bash
node scripts/midscene-run.js <yaml-file> --dry-run
```

如果验证失败，分析错误原因并向用户建议修复方案：

| 常见错误 | 原因 | 修复建议 |
|---------|------|---------|
| YAML 语法错误 | 缩进不正确或格式问题 | 检查缩进，统一使用 2 空格 |
| 缺少平台配置 | 没有 web/android/ios/computer | 添加 `web: { url: "..." }` |
| 缺少 tasks | 没有定义任务 | 添加 tasks 数组和 flow |
| 未声明 engine | 使用超集关键字但未标记 | 添加 `engine: extended` |
| 变量未定义 | 引用了未声明的 `${var}` | 在 variables 中声明变量 |
| 未声明 features | Extended 模式未列出使用的特性 | 添加 `features: [...]` |
| 循环缺少必要字段 | repeat 缺 count、while 缺 condition | 补充对应必要字段 |
| 导入文件不存在 | import 引用的路径不正确 | 检查文件路径是否正确 |

**自动修复流程**：仅对确定性琐碎修改（添加 engine: extended、修复缩进）允许静默修复。对任何改变语义的修改，先展示 diff 并确认。

> **Post-dry-run 执行就绪检查**: dry-run 通过后，执行前确认：(1) `MIDSCENE_MODEL_API_KEY` 已配置？(2) Chrome 可用？(`node scripts/health-check.js`) (3) 目标 URL/设备可达？

### 第 3 步：执行

根据项目环境选择执行方式：

**方式 1（推荐）: 使用项目 CLI**

如果项目中有 `scripts/midscene-run.js`（midi-stagehand-skill 完整项目）：
```bash
# 单文件执行
node scripts/midscene-run.js <yaml-file> [options]

# 批量执行（glob 模式）
node scripts/midscene-run.js "tests/**/*.yaml"
```
> 注意：批量执行使用 `fs.globSync()`，需要 Node.js >= 22。

**方式 2: 直接使用 Midscene CLI**

如果在外部项目中（没有 `scripts/midscene-run.js`），直接使用 `@midscene/web`：
```bash
# 安装（仅首次）
npm install @midscene/web dotenv

# 执行（--headed 表示有界面）
npx @midscene/web <yaml-file> --headed

# 批量执行（官方 CLI 选项）
npx @midscene/web "tests/**/*.yaml" --concurrent --continue-on-error
```

**官方 Midscene CLI 完整选项**（方式 2）：
- `--headed` — 显示浏览器窗口（调试用）
- `--keep-window` — 执行后保持浏览器窗口打开
- `--concurrent <n>` — 并行执行文件数（默认 1）
- `--continue-on-error` — 失败后继续执行后续文件
- `--share-browser-context` — （官方 CLI）跨文件共享浏览器上下文（Cookie/localStorage），适合需要维持登录态的多文件测试
- `--summary <path>` — （官方 CLI）JSON 格式的执行汇总报告路径，包含每个文件的通过/失败状态，适合 CI 自动化解析
- `--config <file>` — 参数配置文件
- `--dotenv-debug` — 调试 dotenv 加载
- `--dotenv-override` — 允许 .env 覆盖系统环境变量
- `--web.userAgent <ua>` — 覆盖 User-Agent
- `--web.viewportWidth <n>` / `--web.viewportHeight <n>` — 覆盖视口尺寸
- `--android.deviceId <id>` — 覆盖 Android 设备 ID
- `--ios.wdaPort <port>` / `--ios.wdaHost <host>` — 覆盖 iOS WDA 配置

> **注意**: 包名是 `@midscene/web`（不是 `@midscene/cli`）。

**项目 CLI vs 官方 CLI 对比**：项目 CLI（方式 1）用于开发调试，含验证+转译+报告解析；官方 CLI（方式 2）用于 CI 并行执行，支持 `--concurrent`/`--continue-on-error`。

**可用选项**（方式 1）：
- `--dry-run` — 仅验证和转换，不实际执行（注意：不检测模型配置，AI 操作需配置 `MIDSCENE_MODEL_API_KEY`）
- `--timeout <ms>` — 执行超时（默认 300000 = 5 分钟）。**注意**：timeout 包含浏览器启动时间，建议最低设置 60000ms
- `--retry <count>` — 失败后自动重试次数（默认 0，即不重试）。适合 flaky 场景
- `--output-ts <path>` — 保存转换后的 TypeScript 文件（仅 Extended 模式）。排查转译错误时，建议配合 `--dry-run` 一起使用
- `--report-dir <path>` — 报告输出目录（默认 `./midscene-report`）
- `--template puppeteer|playwright` — 选择 TS 模板（默认 playwright；puppeteer 适合仅需 Chrome 的场景）
- `--clean` — 清理 `.midscene-tmp/` 中超过 24 小时的过期临时文件
- `--max-files <n>` — 批量执行时限制文件数（默认 100）
- `--json-log` — JSON Lines 格式输出，适合 CI/CD 日志解析
- `--verbose` / `-v` — 显示详细输出（验证详情、检测信息、步骤计数）。注意：错误分类、失败任务详情和修复建议默认已显示，无需 `--verbose`
- `--help` / `-h` — 显示帮助信息
- `--version` / `-V` — 显示版本号

**Extended 模式的执行流程**：
1. YAML → Transpiler → TypeScript
2. TypeScript → tsx 运行时 → Playwright + Midscene SDK
3. 生成执行报告

可以使用 `--output-ts` 保存中间 TypeScript 文件以便调试：
```bash
node scripts/midscene-run.js test.yaml --output-ts ./debug-output.ts
```

### 第 4 步：分析结果

执行完成后：

#### 成功
- 汇报执行摘要（通过/失败的任务数）
- 告知报告文件位置
- 如果有 `aiQuery` 结果，展示提取的数据
- 如果有 `output` 导出，确认文件生成位置
- 显示执行耗时和执行摘要（如 "3 个任务全部通过，耗时 45.2s"）
- 使用以下格式汇报结果：
  ```
  [RESULT] PASSED
  [TASKS] 3/3 passed
  [DURATION] 45.2s
  [REPORT] ./midscene-report/<report-filename>.html
  [TIP] 在浏览器中打开报告查看每步截图和详情
  ```

#### 失败

**错误分析优先级**（4 大类 14 子类）：

| 大类 | 子类 | 严重性 | 首选修复 |
|------|------|--------|---------|
| **配置问题** | api_key, transpiler, permission | fatal | 配置 API Key / 检查 YAML 语法 / 检查权限 |
| **定位问题** | element_not_found, assertion, timeout | recoverable | 精确描述 → deepThink → xpath / 增加 timeout |
| **网络问题** | navigation, network_failure, rate_limit | mixed | 检查 URL/DNS / 检查网络代理 / 增加 sleep 间隔 |
| **资源问题** | browser_not_found, browser_crash, disk_full, memory_exhaustion | fatal | health-check / --clean / 减少并行 |

> 子类详情：javascript(recoverable) 检查 JS 语法。退出码：0=成功、1=执行失败、2=配置错误

**修复策略速查**：
- **配置类** → `api_key`: 配置 MIDSCENE_MODEL_API_KEY；`transpiler`: `--dry-run --output-ts debug.ts`
- **定位类** → `element_not_found`: 精确 AI 描述 → `deepThink: true` → `xpath`；`assertion`: 查看报告截图
- **网络类** → `navigation`: 检查 URL；`network_failure`: 检查网络/代理；`rate_limit`: 增加 sleep + `--retry 3`
- **资源类** → `browser_not_found`: `node scripts/health-check.js`；`disk_full`/`memory`: `--clean` + 减少并行
- `disk_full` → `--clean`

> **重试策略**: recoverable 类可重试；fatal 类不重试需修正根因；rate_limit 需退避增加间隔

**迭代修复流程**：
1. 分析错误原因
2. 修改 YAML 文件
3. 重新执行 `--dry-run` 验证
4. 验证通过后重新执行

### 协作协议

与 Generator Skill 配合时：

1. **优先检查** `./midscene-output/` 目录中最近生成的文件
2. **Runner 可自修复的错误**（直接修改 YAML 并重新执行）：
   - YAML 缩进问题
   - 缺少 `engine: extended` 声明
   - 缺少 `timeout` 或值过小
   - `features` 列表不完整
   - `aiInput` 缺少 `value` — 自动添加空 value 提示占位
   - `aiWaitFor` 使用嵌套格式 — 自动转为扁平格式
   - URL 缺少协议前缀 — 自动补全 `https://`
   - `while` 循环缺少 `maxIterations` — 自动填充默认值 50
3. **需要升级给 Generator 的错误**（使用以下格式）：
   ```
   [ESCALATE] ./midscene-output/<file>.yaml
   [MODE] native|extended
   [PLATFORM] web|android|ios|computer
   [ENV] Node <version>, Chrome <version>, <OS>
   [ERROR_TYPE] element_not_found | assertion | navigation | timeout | memory_exhaustion
   [ERROR_MSG] <实际错误消息片段>
   [FAILED_STEP] task "<任务名>" → step <N>
   [REPORT_PATH] ./midscene-report/<report>.html
   [SUGGESTION] 重新设计定位策略 / 调整操作顺序 / 添加中间等待步骤
   ```
   升级场景：定位策略根本性失败、操作顺序设计错误、缺少关键步骤、选错执行模式

   > **确认令牌**: Generator 响应 ESCALATE 时，必须在回复中包含 `[FIX_FOR] <file>.yaml` 确认已处理目标文件。Runner 验证此令牌后才继续执行。

   > **迭代上限**: Runner 最多进行 2 轮自修复+重试。2 轮均失败后，输出综合摘要而非单次错误，便于 Generator 一次性修复：

   > **修复历史格式**:
   > ```
   > [ATTEMPT 1] 修复: 补充 engine: extended → 结果: 新错误 - element_not_found
   > [ATTEMPT 2] 修复: 添加 aiWaitFor 等待 → 结果: 超时 - timeout 30s
   > [ESCALATE] 2 轮修复均失败，升级给 Generator
   > ```

   > **运行时建议**: 当执行结果包含明确的修复建议（如 "增加 timeout 到 60000"），Runner 可直接应用并重试，不需要用户确认。但不得修改 AI 指令的语义内容。

### 第 5 步：报告解读

解读 Midscene 生成的报告：

- 报告默认在 `./midscene-report/` 目录
- **HTML 报告**：在浏览器中打开，每个步骤展示执行状态和截图（绿色 ✓ = 通过，红色 ✗ = 失败），点击可展开详情
- **JSON 报告**：结构化数据，包含每步的状态、耗时、截图路径，适合 CI/CD 自动解析
- 截图路径为相对于报告目录的路径
- `recordToReport` 步骤产生的自定义截图也包含在报告中

报告摘要格式：
```
Total : N
Passed: N
Failed: N
Status: passed|failed
```

## 快速命令参考

```bash
node scripts/midscene-run.js test.yaml                      # 执行
node scripts/midscene-run.js test.yaml --dry-run             # 仅验证
node scripts/midscene-run.js test.yaml --dry-run --output-ts ./debug.ts  # 排查转译
node scripts/midscene-run.js test.yaml --timeout 600000      # 10 分钟超时
node scripts/midscene-run.js test.yaml --retry 3             # 失败重试
node scripts/midscene-run.js "tests/**/*.yaml" --max-files 50  # 批量执行
npx @midscene/web test.yaml --headed                         # 外部项目（有界面）
```

## YAML 配置速查

> 完整 YAML 配置参考（agent 配置、动作映射、平台配置详情）请查看 `skills/midscene-yaml-generator/REFERENCE.md` 或 `guide/MIDSCENE_YAML_GUIDE.md`。

### 平台配置最小示例

```yaml
web: { url: "https://example.com" }      # headless: true 用于 CI
android: { deviceId: "emulator-5554" }    # flow 中 launch: "包名"
ios: { wdaPort: 8100 }                    # flow 中 launch: "bundleId"
computer: { launch: "/path/to/app" }      # headless + xvfbResolution 用于 CI
```

动作详情参见 Generator `REFERENCE.md`「Native 动作完整映射」。

## 调试技巧

1. **查看报告截图**: HTML 报告每步有截图，绿 ✓ 通过、红 ✗ 失败
2. **分段执行**: 先写前几步验证通过，再逐步添加
3. **增加等待**: 关键步骤后 `aiWaitFor` 确保页面就绪
4. **deepThink → xpath**: 定位不准时 `deepThink: true`，仍失败用 `xpath`
5. **查看 TS 代码**: Extended 用 `--output-ts` 排查转译问题
6. **DEBUG 环境变量**: `midscene:*`(全部) / `midscene:ai:call`(API) / `midscene:ai:profile:stats`(性能) / `midscene:cache:*`(缓存)
7. **freezePageContext**: 连续 3+ 次 aiQuery 时冻结页面提升性能
8. **缓存策略**: 开发 `read-write`，CI `write-only`

## 执行常见陷阱

- **首次慢**: `npx` 首次需下载依赖，先运行 `npm run setup` 预热
- **timeout 包含启动时间**: 浏览器冷启动 10-20s，timeout 最少 60000ms
- **headless 渲染差异**: 调试先用 `headless: false`
- **反爬/验证码**: 用 `userAgent` + `headless: false` + `bridgeMode`
- **移动端键盘遮挡**: iOS `autoDismissKeyboard: true`；Android `keyboardDismissStrategy: "back-first"`

## 执行安全

报告截图可能含敏感数据，CI/CD 中标记为私有 artifact。API Key 通过 CI secrets 管理，`.env` 确保在 `.gitignore` 中。

## CI/CD 集成（CI/CD 专用配置，交互式用户可跳过）

- **批量执行**: 项目 CLI 串行 `node scripts/midscene-run.js "tests/**/*.yaml"`；官方 CLI 并行 `npx @midscene/web "tests/**/*.yaml" --concurrent 4 --continue-on-error`
- **汇总报告**: `--summary report.json` 输出 JSON 格式执行汇总（每文件通过/失败状态），适合 CI 自动解析
- **Docker 基础配置**: 基础镜像需 Chrome + CJK 字体。示例 `Dockerfile` 片段：
  ```dockerfile
  FROM node:22-slim
  RUN apt-get update && apt-get install -y chromium fonts-noto-cjk --no-install-recommends \
      && rm -rf /var/lib/apt/lists/*
  ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
  ```
  容器内需 `chromeArgs: ['--no-sandbox']`（仅受信环境）+ `headless: true`

## 注意事项

- Web 需 Chrome；Android 需 ADB；iOS 需 WDA；Extended 需 tsx 运行时
- `--dry-run` 仅检查语法/结构，不检测 API Key/网络/Chrome
- 生成新 YAML 用 **Midscene YAML Generator** skill；环境变量 `${ENV:NAME}` 两种语法等价
