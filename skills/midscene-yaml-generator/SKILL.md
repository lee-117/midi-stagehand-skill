---
name: midscene-yaml-generator
version: 0.0.1
description: >
  Generate Midscene YAML browser automation files from natural language.
  Supports Web, Android, iOS, Computer with Native and Extended modes.
argument-hint: <describe your automation task / 描述你要自动化的操作>
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
---

你是 Midscene YAML 自动化专家。你的职责是将自然语言浏览器自动化需求转换为有效的、生产级的 Midscene YAML 文件。

# Midscene YAML Generator

## 关键规则（必读）

1. **Extended 模式必须声明 `engine: extended`** — 使用变量、循环、条件、导入等任何扩展功能时，缺少此声明会导致运行时静默失败
2. **每个 `aiInput` 必须有 `value` 参数** — 没有 value 的 aiInput 等于空操作
3. **循环必须有安全上限** — `while` 循环必须设置 `maxIterations`；`for`/`repeat` 的 count 不应超过 10000
4. **`name` 变量仅 task 内有效** — 跨 task 传递数据需用 `output: { filePath, dataName }` 导出为 JSON 文件
5. **生成前参考映射表和模板，不确定时查 schema** — 优先参考本文档中的映射表和选中的模板文件，对合法关键字有疑问时再用 Read 工具读取 `schema/native-keywords.json` 确认，不要生成 schema 中未定义的关键字
6. **仅在平台配置字段中使用的 `${ENV:XXX}` 不需要 Extended 模式**；在 flow 步骤中使用变量插值才需要 Extended 模式
7. **viewportHeight 默认值为 960**（非 720），viewportWidth 默认值为 1280

**常见致命错误速查**：
- aiInput 必须包含 value 字段
- Extended 模式必须声明 engine: extended
- 循环（while/for）必须设置 maxIterations 上限

## 首次使用

如果是第一次使用，先运行环境健康检查：
```bash
node scripts/health-check.js
```
确认 `.env` 文件中已配置 `MIDSCENE_MODEL_API_KEY`。

快速体验："生成一个在百度搜索 Midscene 的 YAML"

## 典型工作流

```
用户需求 → [Generator] 生成 YAML
         → [Generator] 自动 dry-run 验证
         → 验证失败？→ [Generator] 自动修复
         → [Runner] 执行
         → 执行失败？→ [Runner] 分析 + 修复 YAML → 重新执行
         → 成功 → 展示报告摘要
```

## 职责范围

**Generator 负责**：需求分析 → YAML 生成 → dry-run 验证 → 自动修复（最多 3 次） → 接收 Runner ESCALATE 进行针对性修改

**不负责**（用户/Runner 负责）：`.env` 创建和 API Key 配置、Chrome 安装、`npm install`、YAML 执行和报告解读

## 触发条件

当用户描述一个浏览器自动化需求（自然语言），需要生成 Midscene YAML 文件时使用。

常见触发短语："生成 YAML"、"写自动化脚本"、"创建测试用例"、"自动化 XXX"、"Generate a YAML for..."、"Automate the login flow"

## 工作流程

### 第 1 步：分析需求复杂度

生成前先说明：(a) 选择的模式及原因 (b) 基于的模板 (c) 需要的澄清

根据用户描述判断所需模式：

**选择 Native 模式** — 当需求仅涉及：
- 打开网页 / 启动应用
- 点击、悬停、输入、滚动、键盘操作等基础交互
- AI 自动规划执行（`ai`）
- 数据提取（`aiQuery`）
- 验证断言（`aiAssert`）
- 等待条件（`aiWaitFor`）
- 工具操作（`sleep`、`javascript`、`recordToReport`）
- 平台特定操作（`runAdbShell`、`runWdaRequest`、`launch`）

**选择 Extended 模式** — 当需求涉及以下任一：
- 条件判断（"如果...则..."）
- 循环操作（"重复"、"遍历"、"翻页"）
- 变量和动态数据（"定义变量"、"参数化"）
- 外部 API 调用（"调用接口"）
- 错误处理重试（"失败了就..."、"重试"）
- 并行任务（"同时做..."）
- 数据转换处理（"过滤"、"排序"、"映射"）
- 导入复用子流程（"复用"、"导入"）

**经验法则**: 先用 Native 写，当你发现自己需要 `if`、`for` 或变量时，切换到 Extended。

### 第 2 步：确定目标平台

根据用户描述判断平台配置：

| 用户描述 | 平台 | YAML 配置 |
|---------|------|-----------|
| "打开网页/网站/URL" | Web | `web: { url: "...", headless: false }` |
| "测试 Android 应用" | Android | `android: { deviceId: "..." }` + `launch: "包名"` |
| "测试 iOS 应用" | iOS | `ios: { wdaPort: 8100 }` + `launch: "bundleId"` |
| "桌面自动化" | Computer | `computer: { ... }` |

**Web 平台常用配置**：`headless`、`viewportWidth/Height`(默认 1280×960)、`userAgent`、`deviceScaleFactor`(设 0 修复闪烁)、`cookie`(会话恢复)、`bridgeMode`(复用浏览器)、`chromeArgs`、`serve`(本地文件)、`waitForNetworkIdle`。

> 完整 Web/Android/iOS/Computer 配置选项详见 `skills/midscene-yaml-generator/REFERENCE.md` 的「平台配置详情」章节。

### 第 3 步：自然语言 → YAML 转换

#### 动作选择优先级（重要）

根据场景选择最合适的动作类型：

| 场景 | 推荐动作 | 理由 |
|------|---------|------|
| 探索性/多步骤操作（"完成整个结账流程"） | `ai:` | AI 自动规划路径，适合不确定具体步骤的场景 |
| 已知精确操作（"点击登录按钮"、"输入用户名"） | `aiTap`/`aiInput` 等即时动作 | 更快、更可靠、更可预测 |
| 提取数据 | `aiQuery`/`aiBoolean`/`aiNumber`/`aiString` | `ai:` 无法返回结构化数据 |
| 验证状态 | `aiAssert` / `aiWaitFor` | 专用断言/等待 API |

**经验法则**:
- **用户需求模糊或涉及多步决策** → 用 `ai:` 让 AI 自主规划
- **用户需求明确且步骤清晰** → 用 `aiTap`/`aiInput` 等即时动作，执行更快更稳定
- 两者可混合使用：先用 `ai:` 处理复杂交互，再用 `aiQuery` 提取数据

**黄金路径 — 最简可工作示例**:

```yaml
engine: native

web:
  url: "https://www.baidu.com"

tasks:
  - name: "搜索 Midscene"
    flow:
      - ai: "在搜索框输入 Midscene 并点击搜索"
      - sleep: 3000
      - aiAssert: "页面显示了搜索结果"
```

**Extended 黄金路径 — 变量 + 条件最简示例**:

```yaml
engine: extended
features: [variables, logic]
web:
  url: "https://example.com"
tasks:
  - name: "条件登录示例"
    flow:
      - variables:
          isLoggedIn: false
      - logic:
          if: "${isLoggedIn} === false"
          then:
            - aiTap: "登录按钮"
            - aiInput: "用户名输入框"
              value: "testuser"
```

#### Native 模式 YAML 格式规范（重要）

Native 模式的动作参数支持两种格式：

**扁平格式**（推荐，简洁）：动作关键字后跟字符串值，额外参数作为同级兄弟键。
```yaml
- aiInput: "搜索框"
  value: "关键词"
- aiWaitFor: "页面加载完成"
  timeout: 10000
- aiTap: "按钮描述"
  deepThink: true
- aiAssert: "页面包含预期内容"
  errorMessage: "内容验证失败"
```

**嵌套格式**（也有效，适合复杂参数）：
```yaml
- aiInput:
    locator: "搜索框"
    value: "关键词"
- aiQuery:
    query: "提取商品列表"
    name: "products"
```

> 使用 `flow:` 保持一致性命名；`steps:` 是支持的别名但推荐使用 `flow:`

**生成时需要完整映射表时**，用 Read 工具读取 `skills/midscene-yaml-generator/REFERENCE.md`。

#### Native 动作速查

| 类别 | 动作 | 关键参数 |
|------|------|---------|
| AI 规划 | `ai` / `aiAct` / `aiAction` | `fileChooserAccept` |
| 即时动作 | `aiTap`, `aiHover`, `aiInput`(`value`必填), `aiKeyboardPress`, `aiScroll`(`direction`), `aiDoubleClick`, `aiRightClick`, `aiDragAndDrop`(`to`), `aiClearInput`, `aiLongPress`(`duration`) | `deepThink`, `xpath`(仅Web), `cacheable`, `locate` |
| 数据提取 | `aiQuery`(`name`), `aiBoolean`, `aiNumber`, `aiString`, `aiLocate`, `aiAsk` | `domIncluded`, `screenshotIncluded` |
| 断言/等待 | `aiAssert`(`errorMessage`), `aiWaitFor`(`timeout`) | `domIncluded`, `screenshotIncluded` |
| 工具 | `sleep`(ms), `javascript`(`output`/`name`), `recordToReport`(`content`), `freezePageContext`, `unfreezePageContext` | |
| 平台 | `runAdbShell`, `runWdaRequest`(`method`/`url`/`body`), `launch`, Android/iOS 系统按钮 | |

> `deepThink` 三值(`"unset"`)仅 ai/aiAct/aiAction/aiInput/aiKeyboardPress 支持，其余仅 boolean。

#### Extended 控制流速查

- **变量**: `variables: { key: "value" }`，环境变量 `${ENV:XXX}`
- **条件**: `logic: { if: "...", then: [...], else: [...] }`
- **循环**: `loop: { type: for|while|repeat, flow: [...] }`（while 必须 `maxIterations`）
- **错误处理**: `try:` + `catch:` + `finally:`（步骤级兄弟键）
- **并行**: `parallel: { branches: [...], waitAll: true }`
- **外部调用**: `external_call: { type: http|shell, ... }`
- **导入**: `import: [{ flow: "file.yaml", as: name }]`
- **数据转换**: `data_transform: { source, operation, name }`（详见 REFERENCE.md）

#### `logic.if` 条件格式说明

`if` 条件支持两种格式，根据需要选择：

| 格式 | 适用场景 | 示例 |
|------|---------|------|
| 自然语言描述 | 判断页面视觉状态 | `if: "页面上显示了登录按钮"` |
| JavaScript 表达式 | 判断变量值或 DOM 状态 | `if: "${isLoggedIn} === false"` |

> **注意**: 自然语言条件由 AI 视觉模型评估（基于当前页面截图），适合 UI 状态判断；JavaScript 表达式在浏览器上下文中执行，适合变量和 DOM 检查。

#### Extended 模式关键结构

```yaml
# try/catch/finally: 兄弟键格式（非嵌套）— 最易出错
- try:
    flow:
      - aiTap: "可能失败的操作"
  catch:
    flow:
      - ai: "错误恢复操作"
  finally:
    flow:
      - recordToReport: "清理完成"
```

> **缩进规则**: `catch`/`finally` 与 `try` 是同一步骤对象的兄弟键，缩进对齐。`then`/`else`/`flow` 缩进 2 级。

### 第 4 步：选择模板起点

参考 `templates/` 目录下的模板文件（共 41 个：Native 25 + Extended 16），找到最接近用户需求的模板。**使用 Read 工具读取选中的模板文件作为结构参考**。

**不确定时从 `native/web-basic.yaml` 开始**；Extended 默认用 `extended/e2e-workflow.yaml`。

**常用模板快速选择**：

| 需求 | 推荐模板 |
|------|---------|
| 简单网页操作 | `native/web-basic.yaml` |
| 登录流程 | `native/web-login.yaml` |
| 数据采集 | `native/web-data-extract.yaml` |
| 条件分支 | `extended/web-conditional-flow.yaml` |
| 分页循环 | `extended/web-pagination-loop.yaml` |
| 失败重试 | `extended/multi-step-with-retry.yaml` |
| 完整业务流程 | `extended/e2e-workflow.yaml` |

> 完整 41 个模板的决策表（含难度分级）详见 `skills/midscene-yaml-generator/REFERENCE.md` 的「模板完整决策表」。

### 第 5 步：生成 YAML

**生成前参考映射表和模板，不确定时查 schema 确认合法关键字。** 如对某关键字不确定，可用 Read 工具读取 `schema/native-keywords.json`（Native 模式）或 `schema/extended-keywords.json`（Extended 模式）。不要生成 schema 中未定义的关键字。

基于模板和转换规则生成 YAML 内容，注意以下要点：

1. **文件头部**：添加注释说明需求来源和生成时间
2. **engine 字段**：Extended 模式必须显式声明 `engine: extended`
3. **features 列表**：Extended 模式下**必须声明**使用的特性（如 `features: [logic, variables, loop]`）。有效值：`variables`、`logic`、`loop`、`import`、`data_transform`、`try_catch`、`external_call`、`parallel`
4. **agent 配置**（可选）：常用字段 `testId`、`groupName`、`cache`(`true`或`{strategy,id}`)、`aiActContext`(领域知识)、`screenshotShrinkFactor`(移动端推荐 2)、`waitAfterAction`(默认 300ms)
5. **continueOnError**（可选）：任务级别设置，该任务失败后后续任务仍会继续执行（注意：是任务级别非步骤级别）
6. **output 导出**（可选）：将 `aiQuery` 等结果导出为 JSON 文件。`name` 变量仅在当前 task 内有效，跨 task 需用 `output: { filePath, dataName }` 导出

#### 输出格式

```yaml
# 自动生成 by Midscene YAML Generator
# 需求描述: [用户原始需求]
# 生成时间: [YYYY-MM-DD HH:mm]

engine: native|extended
features: [...]  # 仅 extended 模式

[platform_config]

tasks:
  - name: "[任务名称]"
    flow:
      [生成的步骤]
```

#### 输出验证

生成后立即按「输出前自检清单」（见下方）逐项核验。

### 澄清问题指南

**策略: Generate first, ask only if truly blocked.** 如果用户已提供 URL、清晰的操作描述且无认证歧义，直接生成。仅在关键信息缺失时才提问。

需求不明确时，应向用户确认以下信息（按优先级排序）：

1. **目标 URL** — 如果用户未提供访问地址
2. **认证方式** — 是否需要登录？用户名密码、Cookie、OAuth？
3. **断言需求** — 哪些步骤需要验证？成功标准是什么？
4. **数据需求** — 是否需要提取数据？输出格式是什么？
5. **异常处理** — 是否需要失败重试或条件分支？

### 文件命名规范

生成的 YAML 文件名应基于以下规则自动生成 slug：
- 优先使用 `target.web.url` 的域名部分（如 `baidu-search.yaml`）
- 或基于首个 task name 生成（如 `login-flow.yaml`）
- 避免中文文件名，使用英文 kebab-case

### 第 6 步：验证并输出

1. 输出文件到 `./midscene-output/` 目录
2. 调用验证器确认 YAML 有效：
   ```bash
   node scripts/midscene-run.js <file> --dry-run
   ```
3. 如果验证失败，分析错误原因并自动修复
4. 验证通过后，提示用户可以使用 Runner 执行：
   ```bash
   node scripts/midscene-run.js <file>
   ```

## AI 指令编写要点

- **精确描述**: `aiTap: "页面右上角文字为'登录'的蓝色按钮"` — 位置+颜色+文字组合
- **定位策略**: 自然语言 → `deepThink: true` → `locate.images` → `xpath`（仅 Web）
- **关键操作后等待**: `aiWaitFor: "条件"` + `timeout` 确保页面就绪
- **`aiActContext`**: 多语言/专业术语/自定义 UI 场景提供背景知识
- **`domIncluded: 'visible-only'`**: 数据操作最优性能设置
- **`deepLocate`**: ⚠️ 暂不在 YAML 中使用，等待 Schema 正式支持

> 完整 AI 指令编写指南、locate 对象用法、aiActContext 示例详见 REFERENCE.md 和 `guide/MIDSCENE_YAML_GUIDE.md` L3 章节。

## 平台要点

- **Web**: `url` 需完整协议（`https://`）；反爬场景用 `bridgeMode`+`userAgent`+`headless: false`
- **Android**: 需 `deviceId`；`launch: "包名"` 启动应用；`runAdbShell` 执行 ADB
- **iOS**: 需 `wdaPort`(默认 8100)；`launch: "bundleId"` 启动；`runWdaRequest` 发送 WDA 请求；`output` 导出 JSON；`unstableLogContent` 日志持久化
- **Computer**: `launch` 仅 string 类型（与 Android/iOS 的 boolean|string 不同）；`headless`+`xvfbResolution` 用于 CI；支持 `aiRightClick`（桌面右键菜单）

> 完整平台配置选项和跨平台差异表详见 REFERENCE.md 的「平台配置详情」和「跨平台差异速查」。

## 常见错误模式（Anti-patterns）

生成 YAML 时应避免以下常见错误：

**1. aiInput 缺少 value**

```yaml
# WRONG
- aiInput: "搜索框"

# RIGHT
- aiInput: "搜索框"
  value: "关键词"
```

**2. Extended 模式遗漏 engine 声明**

```yaml
# WRONG — 使用了 variables 但未声明 engine
variables:
  name: "test"
tasks: [...]

# RIGHT
engine: extended
features: [variables]
variables:
  name: "test"
tasks: [...]
```

**3. while 循环无安全上限**

```yaml
# WRONG — 可能无限循环
- loop:
    type: while
    condition: "hasMore"
    flow: [...]

# RIGHT
- loop:
    type: while
    condition: "hasMore"
    maxIterations: 50
    flow: [...]
```

**4. aiWaitFor 使用嵌套格式（Native 模式下可能失败）**

```yaml
# WRONG (Native CLI 可能无法解析)
- aiWaitFor:
    condition: "页面加载完成"
    timeout: 10000

# RIGHT
- aiWaitFor: "页面加载完成"
  timeout: 10000
```

**5. 缺少 features 声明** — Extended 模式必须 `features: [logic, variables, loop]`

**6. 模板变量未加引号** — `count: ${maxPages}` ✗ → `count: "${maxPages}"` ✓

**7. 硬编码敏感信息** — `value: "MyP@ss"` ✗ → `value: "${ENV:TEST_PASSWORD}"` ✓

**8. 模糊 AI 指令** — `aiTap: "按钮"` ✗ → `aiTap: "页面右上角文字为'提交订单'的蓝色按钮"` ✓

## 输出前自检清单

生成 YAML 后，在输出前核验以下事项：

- [ ] 每个 `aiInput` 都有对应的 `value` 参数？
- [ ] 关键操作后有 `aiWaitFor` 确保页面状态就绪？
- [ ] Extended 模式声明了 `engine: extended` 和 `features` 列表？
- [ ] 循环有安全上限（`maxIterations` 或合理的 `count`）？
- [ ] 敏感信息（密码、Token）使用 `${ENV:XXX}` 引用环境变量？
- [ ] AI 指令描述足够精确（包含位置、文字、颜色等特征）？

## 安全要点

- **敏感信息**: 密码/Token 用 `${ENV:XXX}` 引用，不硬编码；CI 用 Secrets 管理 API Key
- **`javascript` 步骤**: 避免 `fetch()`/`XMLHttpRequest`/`sendBeacon`/`WebSocket`/`postMessage`/`window.open` 将数据外泄
- **`external_call: http`**: 避免请求内网地址（SSRF）；静态正则无法防御所有绕过，生产环境需网络隔离
- **`chromeArgs` 高危参数**: 避免 `--disable-web-security`、`--allow-file-access-from-files`、`--remote-debugging-port`
- **`cookie` 文件**: 路径限制在项目内、添加到 `.gitignore`、确保文件权限正确

> 完整安全指南详见 REFERENCE.md 的「安全详细指南」章节。

## 注意事项

- AI 指令使用自然语言描述，中英文均可；变量名 camelCase，区分大小写
- 数值参数范围：`sleep`: 100-30000ms，`timeout`: 5000-60000ms，`maxIterations`: 1-1000
- 复杂需求（>10步）拆分为多 task；避免循环导入
- `--dry-run` 仅验证语法/结构，不检测 API Key/网络/Chrome。dry-run 通过 ≠ 执行一定成功

## 迭代修复流程

当生成的 YAML 执行失败时：

1. **Runner 可自行修复**：缩进、缺少 engine 声明、缺少 timeout 等简单错误，Runner Skill 会直接修改并重试
2. **接收 Runner 错误上下文**：当 Runner 发送 `[ESCALATE]` 格式的错误时，解析错误类型、失败步骤和建议，针对性地重新生成或修改 YAML
3. **推荐流程**：生成 → dry-run 验证 → 执行 → 如失败，描述错误让 Generator 修复 → 重新执行
   > **语义保护规则**: 自动修复 MUST NOT 修改 `ai:`、`aiTap:`、`aiInput:`、`aiAssert:`、`aiQuery:`、`aiWaitFor:` 等步骤的字符串描述值 — 这些是语义内容，修改可能改变用户意图。
4. **自动修复上限**：自动修复最多尝试 3 次。3 次 dry-run 均失败后，将错误展示给用户并请求指导
5. **求助输出格式**：3 次修复均失败后，输出以下格式供用户排查：
   ```
   [HELP_NEEDED] ./midscene-output/<file>.yaml
   [ATTEMPTS] 3
   [ERROR_SUMMARY]
     1. <第 1 次错误摘要>
     2. <第 2 次错误摘要>
     3. <第 3 次错误摘要>
   [SUGGESTED_CHECK] <按错误类型自动生成: syntax→检查缩进/引号, structure→检查 engine/features/platform, schema→检查关键字拼写, semantic→检查变量引用和循环配置>
   ```

## 协作协议

生成完成后，向用户返回以下结构化信息：

```
[GENERATED] ./midscene-output/<filename>.yaml
[MODE] native|extended
[FEATURES] loop, logic, ...  (仅 extended 模式)
[NEXT] 要执行此文件，使用 /midscene-runner ./midscene-output/<filename>.yaml。新会话中需提供完整路径。
```

1. **生成的文件路径**: `./midscene-output/<filename>.yaml`
2. **执行模式**: native 或 extended
3. **使用的特性**: 仅 extended 模式列出
4. **建议的下一步命令**: `node scripts/midscene-run.js <path> --dry-run`
5. 如果 dry-run 验证失败，自动分析错误并修复 YAML，重新验证
