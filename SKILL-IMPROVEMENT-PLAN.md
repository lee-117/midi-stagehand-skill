# Skill 改造计划 — 综合多角色分析

> 基于 5 组子代理、15 个角色视角的多维度分析结果合并而成。
> 分析维度：API/Schema 对齐、转译器代码生成、Skill 定义与 UX、测试覆盖与验证器、模板与文档质量。

---

## 一、分析概览

| 子代理 | 角色 | 发现数 |
|--------|------|--------|
| #1 API/Schema 对齐 | SDK Expert + Schema Architect + QA | 18 |
| #2 转译器审计 | TS Expert + SDK User + Security Auditor | 14 |
| #3 Skill/UX | PM + UX Designer + Skill Expert | 12 |
| #4 测试/验证器 | QA Lead + YAML Expert + DevOps | 16 |
| #5 模板/文档 | Power User + Tech Writer + Competitor Analyst | 24 |

去重合并后共计 **62 项独立改进点**，分为 5 个优先级阶段。

---

## 二、Phase 1 — Critical: API 签名修正与 Schema 对齐 (P0)

这些问题会导致**生成的代码在运行时报错**或**与官方 Midscene SDK 行为不一致**。

### 1.1 aiAssert errorMessage 应作为 options 对象传递

**来源**: Agent #1, #2 (3 个角色交叉确认)

**现状**: 转译器生成 `await agent.aiAssert("断言", "错误消息")`
**官方**: `await agent.aiAssert(assertion, { errorMessage })`

**涉及文件**:
- `src/transpiler/generators/native-gen.js` — 修改 aiAssert 代码生成
- `test/transpiler.test.js` — 更新断言

### 1.2 aiKeyboardPress 参数语义错误

**来源**: Agent #1, #2

**现状**: 转译器把 `aiKeyboardPress: "Enter"` 生成为 `agent.aiKeyboardPress("Enter")`，把 `keyName` 也作为第二参数
**官方**: `aiKeyboardPress(keyName, options?)` — 第一个参数就是 keyName

**涉及文件**:
- `src/transpiler/generators/native-gen.js` — 修正 keyName/value 映射逻辑
- `test/transpiler.test.js` — 更新用例

### 1.3 aiScroll locator 与 options 合并问题

**来源**: Agent #1, #2

**现状**: `aiScroll: "区域"` + `direction: "down"` 生成不正确的参数结构
**官方**: `aiScroll(locator?, { direction, scrollType, distance, scrollCount })`

**涉及文件**:
- `src/transpiler/generators/native-gen.js` — 重构 aiScroll 生成逻辑
- `test/transpiler.test.js` — 更新用例

### 1.4 JSON Schema 三大结构性错误

**来源**: Agent #5 (3 处 HIGH 级)

| Schema 定义 | 问题 | 正确结构 |
|-------------|------|---------|
| `tryCatchStep` | try/catch/finally 定义为直接数组 | 应为 object 含 flow/steps 数组 |
| `externalCallStep` | 用 method 混合 HTTP 动词和 "shell" | 应分离 type(http/shell) + method(GET/POST...) |
| `parallelStep` | 定义为数组的数组 | 应为 object 含 tasks/branches + waitAll + merge_results |

**涉及文件**:
- `schema/yaml-superset-schema.json` — 修正 3 个 step 定义

### 1.5 Schema 遗漏项补全

**来源**: Agent #4, #5

- `loopStep` 缺少 `steps`(flow别名)、`itemVar`、`indexVar`、`item`(别名)
- `flowStep.oneOf` 缺少 `useStep` 定义 (`use` + `with`)
- `task` 定义缺少 `output: { filePath, dataName }`
- `loopStep.count` 应支持 string（变量引用 `"${var}"`）

**涉及文件**:
- `schema/yaml-superset-schema.json` — 补全上述定义

### 1.6 ai/aiAct 的 deepThink 和 cacheable 参数被静默丢弃

**来源**: Agent #4 (H4+H5, QA Lead + YAML Expert 交叉确认)

**现状**: `native-gen.js` 中 `ai`/`aiAct` handler 生成 `agent.aiAct(prompt)` 不传任何 options；`buildOptionEntries()` 也不处理 `cacheable` 参数
**官方**: `ai`/`aiAct` 支持 `{ deepThink, cacheable }` options；所有动作都支持 `cacheable`

**涉及文件**:
- `src/transpiler/generators/native-gen.js` — ai/aiAct handler 增加 options 透传；`buildOptionEntries` 增加 cacheable 处理
- `test/transpiler.test.js` — 新增用例

### 1.7 javascript 动作 output/name 结果未捕获

**来源**: Agent #4 (M8)

**现状**: `javascript` 步骤生成 `await agent.evaluateJavaScript(...)` 但不捕获返回值
**官方**: 支持 `name` 字段将结果存储为变量

**涉及文件**:
- `src/transpiler/generators/native-gen.js` — javascript handler 检查 step.output/step.name，生成 `const varName = await ...`
- `test/transpiler.test.js` — 新增用例

### 1.8 ENV 变量引用被误报为未定义 (Bug)

**来源**: Agent #5 (H4, Power User)

**现状**: 验证器对 `${ENV:SITE_URL}` 等环境变量引用报 warning "Variable is referenced but does not appear to be defined"
**原因**: `collectVariableReferences` 未识别 `ENV:` / `ENV.` 前缀为环境变量

**涉及文件**:
- `src/validator/yaml-validator.js` — `validateVariableReferences` 或 `collectVariableReferences` 中跳过 ENV 前缀
- `test/validator.test.js` — 新增用例

### 1.9 locate/images 图片定位参数被忽略

**来源**: Agent #4 (M7), Agent #5

**现状**: Schema 定义了 `locateObject` (prompt + images)，但转译器完全不处理
**官方**: 所有动作支持 `images` 参数用于图片辅助定位

**涉及文件**:
- `src/transpiler/generators/native-gen.js` — `buildOptionEntries` 增加 images 处理
- `test/transpiler.test.js` — 新增用例

---

## 三、Phase 2 — High: 缺失 API 能力补全 (P1)

官方 Midscene SDK 支持但本项目完全缺失的能力。

### 2.1 新增 Native 动作支持

**来源**: Agent #1, #2, #4, #5 (全部 5 组均提及)

| 动作 | 官方签名 | 用途 |
|------|---------|------|
| `aiDoubleClick` | `aiDoubleClick(locator, options?)` | 双击交互 |
| `aiRightClick` | `aiRightClick(locator, options?)` | 右键菜单 |
| `aiLocate` | `aiLocate(locator, options?)` | 定位元素返回坐标 |

**涉及文件**:
- `schema/native-keywords.json` — aiActions 数组追加
- `src/transpiler/generators/native-gen.js` — 增加代码生成分支
- `guide/MIDSCENE_YAML_GUIDE.md` — L2 动作列表补全
- `skills/midscene-yaml-generator/SKILL.md` — 动作映射表追加
- `test/transpiler.test.js` — 新增用例

### 2.2 新增类型化数据提取动作

**来源**: Agent #1, #2, #4

| 动作 | 返回类型 | 用途 |
|------|---------|------|
| `aiBoolean` | boolean | 判断页面状态（如"是否已登录"） |
| `aiNumber` | number | 提取数值（如"商品价格"） |
| `aiString` | string | 提取文本（如"页面标题"） |

**涉及文件**: 同 2.1

### 2.3 aiInput mode 支持

**来源**: Agent #1, #4, #5

**官方**: `aiInput(locator, value, { mode: "replace" | "clear" | "typeOnly" })`
**现状**: 完全不支持 mode 参数

**涉及文件**:
- `schema/native-keywords.json` — actionOptions 追加 `mode`
- `src/transpiler/generators/native-gen.js` — mode 透传
- `guide/MIDSCENE_YAML_GUIDE.md` — aiInput 文档补全

### 2.4 native-keywords.json 缺失字段补全

**来源**: Agent #4

**缺失的配置字段**:
- Web 平台: `serve`, `bridgeMode`, `chromeArgs`, `acceptInsecureCerts`, `unstableLogContent`
- Agent: `generateReport`, `autoPrintReportMsg`, `reportFileName`, `replanningCycleLimit`, `aiActContext`
- 动作选项: `timeoutMs`, `images`, `convertHttpImage2Base64`

**涉及文件**:
- `schema/native-keywords.json` — 各分类数组补全

### 2.5 waitForNetworkIdle 对象格式支持

**来源**: Agent #5 (M4)

**现状**: Handlebars 模板只生成 `await page.waitForNetworkIdle()` 无参调用
**官方**: 支持 `{ timeout, continueOnError }` 参数对象

**涉及文件**:
- `src/transpiler/transpiler.js` — 序列化 waitForNetworkIdle options
- `src/transpiler/templates/puppeteer-boilerplate.ts.hbs` — 条件传参
- `src/transpiler/templates/playwright-boilerplate.ts.hbs` — 条件传参

### 2.6 cache 对象格式支持

**来源**: Agent #5

**现状**: 仅支持 `cache: true` (boolean)
**官方**: 还支持 `cache: { strategy: "read-only"|"read-write"|"write-only", id: "..." }`

**涉及文件**:
- `schema/yaml-superset-schema.json` — cache 定义扩展
- `src/transpiler/transpiler.js` — extractAgentConfig 处理对象格式
- `guide/MIDSCENE_YAML_GUIDE.md` — cache 文档补全

---

## 四、Phase 3 — Medium: Skill 定义优化 (P2)

### 3.1 argument-hint 从 metadata 移到顶层

**来源**: Agent #3

**现状**:
```yaml
metadata:
  argument-hint: <natural-language-requirement>
```

**问题**: Skills CLI 不解析 metadata 内的 argument-hint，导致补全提示不生效。

**修复**: 移到 frontmatter 顶层
```yaml
argument-hint: <natural-language-requirement>
```

**涉及文件**:
- `skills/midscene-yaml-generator/SKILL.md` — frontmatter 修正
- `skills/midscene-runner/SKILL.md` — frontmatter 修正

### 3.2 添加英文触发短语

**来源**: Agent #3

**问题**: 当前仅有中文触发短语，非中文用户无法发现 Skill。

**修复**: 每个 Skill 的触发条件增加英文版本:
- Generator: "generate a YAML for...", "write an automation script...", "create a test case..."
- Runner: "run this YAML", "execute this test", "validate this script..."

**涉及文件**:
- `skills/midscene-yaml-generator/SKILL.md` — 触发条件追加英文
- `skills/midscene-runner/SKILL.md` — 触发条件追加英文

### 3.3 Generator description 添加英文触发词

**来源**: Agent #3

**现状**: frontmatter `description` 已包含部分英文，但触发词覆盖不全。
**修复**: 确保 description 中包含 "generate YAML", "write automation", "create test" 等英文关键词。

### 3.4 添加 allowed-tools 声明

**来源**: Agent #3

**问题**: SKILL.md 未声明 allowed-tools，Skill 执行时可能缺少必要工具权限。

**修复**:
- Generator: `allowed-tools: ["Read", "Write", "Bash", "Glob", "Grep"]`
- Runner: `allowed-tools: ["Read", "Edit", "Bash", "Glob", "Grep"]`

**涉及文件**:
- `skills/midscene-yaml-generator/SKILL.md` — frontmatter 追加
- `skills/midscene-runner/SKILL.md` — frontmatter 追加

### 3.5 Runner 添加 context:fork 支持

**来源**: Agent #3

**问题**: Runner 执行时会改变工作目录状态，应支持 `context: fork` 以隔离执行环境。

**评估**: 此为 Skills 框架高级特性，需确认 Skills CLI 是否支持 context:fork。暂标记为**待评估**。

---

## 五、Phase 4 — Medium: 验证器增强与测试补全 (P2)

### 4.1 新增验证规则

**来源**: Agent #4

| 验证项 | 描述 |
|--------|------|
| sleep 值验证 | `sleep: -1000` 或 `sleep: "abc"` 应产生 warning |
| loop count/maxIterations 范围 | 负数或零值应 warning |
| while 循环缺 maxIterations | `type: while` 无 `maxIterations` 应 warning（安全最佳实践） |
| HTTP method 有效性 | `method: BANANA` 应 warning |
| Web config 子字段验证 | `web: { banana: true }` 应 warning 未知字段 |

**涉及文件**:
- `src/validator/yaml-validator.js` — 新增 4 个验证函数
- `test/validator.test.js` — 新增对应测试

### 4.2 补全缺失的负面测试与转译器测试

**来源**: Agent #4 (~15 个未测代码路径 + ~8 个转译器路径)

**验证器负面测试**:

| 测试场景 | 描述 |
|---------|------|
| 根文档为数组 | `- item1\n- item2` |
| 空 tasks 数组 | `tasks: []` |
| tasks 元素为标量 | `tasks:\n  - "string"` |
| 数字类型 name | `name: 123` |
| 空白 name | `name: "   "` |
| 非法 loop type | `loop:\n  type: "unknown"` |
| logic 缺 then | `logic:\n  if: "cond"` (无 then 分支) |
| catch 为非对象 | `catch: "string"` |
| 非法 external_call type | `type: "graphql"` |
| parallel 无 tasks/branches | `parallel:\n  waitAll: true` |
| parallel 为标量 | `parallel: "wrong"` |
| data_transform 为非对象 | `data_transform: 42` |
| data_transform 嵌套格式 | operations 为非数组 |
| 模板变量 import 路径跳过 | `import: "${dynamicPath}"` |
| options.mode 覆盖 | `validate(yaml, { mode: 'native' })` |
| 空 YAML 输入 | `validate("")` / `validate("   ")` |
| tasks 非数组 | `tasks: "not-array"` / `tasks: 42` |

**转译器缺失测试**:

| 测试场景 | 描述 |
|---------|------|
| `use` 步骤无参数 | `use: "${flowRef}"` |
| `use` 步骤带 with | `use: "${flowRef}"` + `with: { key: val }` |
| in-flow `import` 步骤 | JSON/YAML/JS 各变体 |
| aiScroll 扁平格式 | `aiScroll: "target"` + `direction: "down"` 兄弟格式 |
| aiAssert 扁平格式 | `aiAssert: "condition"` + `errorMessage: "msg"` 兄弟 |
| `times` 别名 | `loop: { type: repeat, times: 3 }` |
| runAdbShell/runWdaRequest | 平台特定动作转译（或文档为不支持） |

**涉及文件**:
- `test/validator.test.js` — 新增 ~12 个测试用例

### 4.3 新增平台 Fixtures

**来源**: Agent #4

**缺失**: 所有 fixtures 均为 web 平台，无 Android/iOS/Computer fixture。

**新增**:
- `test/fixtures/native-android.yaml` — Android 基本操作
- `test/fixtures/native-ios.yaml` — iOS 基本操作
- `test/fixtures/native-computer.yaml` — Computer 基本操作

### 4.4 修复 CLI parseArgs 测试脱耦问题

**来源**: Agent #4

**问题**: `test/runner.test.js` 中 parseArgs 是重新实现的副本而非导入实际函数。如果 CLI 修改了参数解析逻辑，测试仍会通过。

**修复**: 从 `scripts/midscene-run.js` 导出 parseArgs，在测试中导入实际函数。

**涉及文件**:
- `scripts/midscene-run.js` — 导出 parseArgs
- `test/runner.test.js` — 导入实际函数

---

## 六、Phase 5 — Low: 文档/模板完善与 DX 提升 (P3)

### 5.1 [Critical] Guide 全面使用嵌套 aiInput 格式 — 与 Skill/Validator 矛盾

**来源**: Agent #5 (C1+C2, Tech Writer + Power User + Competitor Analyst 交叉确认)

**问题**: Guide 中约 15+ 处示例使用嵌套格式 `aiInput: { locator: "...", value: "..." }`，
但 Generator Skill 明确标记此格式为**错误**（会导致运行时 undefined），Validator 也会 warn。
官方 Midscene 文档同样使用扁平格式。

**影响**: 用户按 Guide 学习写出的 YAML 会触发警告且可能运行失败。这是最影响用户信任的问题。

**修复**: Guide 所有 aiInput 示例改为扁平格式 `aiInput: "定位描述"` + `value: "值"` 兄弟键。

**涉及文件**:
- `guide/MIDSCENE_YAML_GUIDE.md` — 约 15 处 aiInput 示例修正

### 5.2 Guide 补充缺失内容

**来源**: Agent #5

| 缺失项 | 描述 |
|--------|------|
| L2 动作数量不正确 | 列为 "6 instant actions"，实际应为 8+ |
| L2 缺少工具动作 | `sleep`、`javascript`、`recordToReport` 未正式介绍 |
| aiAct 未文档化 | 是 ai 的别名，应在 L2 提及 |
| javascript 动作未文档化 | 执行任意 JS 代码 |
| aiScroll distance 参数未文档化 | Guide 未提及，但 Skill 和模板都用了 |
| runAdbShell / runWdaRequest 缺少详细说明 | 仅在平台特定部分提到，无示例 |
| waitForNetworkIdle 对象格式 | 只文档了 `true`，缺 `{ timeout, continueOnError }` |
| serve / bridgeMode 未文档化 | 转译器已支持但 Guide/Skill 未提及 |
| variables 双声明方式 | Guide 只展示顶层格式，模板多用 flow 内步骤格式 |
| Extended 模式常见错误表 | 仅有 Native 的常见错误 |
| 性能调优指南 | headless、cache、timeout 最佳实践 |
| 移动平台快速入门 | 无 Android/iOS 专门教程 |

**涉及文件**:
- `guide/MIDSCENE_YAML_GUIDE.md` — 补充 12 个小节

### 5.3 模板标准化与修复

**来源**: Agent #5

| 问题 | 修复 |
|------|------|
| aiQuery 格式不一致（flat vs nested） | 统一推荐一种格式，文档说明两种均可 |
| flow vs steps 混用 | 在同一模板中保持一致 |
| `multi-step-with-retry.yaml` 声明未使用的 `logic` feature | 移除或添加 logic 示例 |
| `external_call` 用 `response_as` 和 `name` 混用 | 统一推荐 `name:`，文档标注别名 |
| 数据提取模板缺少 `output` 配置 | `web-data-extract.yaml` 添加 output 示例 |
| 移动端模板 `launch: true` 在平台配置中 | 移除或文档说明（应在 flow 中使用） |
| 文件上传模板不现实 | 添加说明 note 或改用更真实的方法 |
| 模板 header 注释不一致 | 统一添加 header 注释 |

**涉及文件**:
- `templates/native/*.yaml` — 统一格式 + 修复
- `templates/extended/*.yaml` — 统一格式 + 修复

### 5.4 新增缺失模板

**来源**: Agent #5

| 模板 | 场景 |
|------|------|
| `native/web-auth-flow.yaml` | OAuth/登录认证流程 |
| `extended/responsive-test.yaml` | 多视口响应式测试 |
| `extended/image-locator.yaml` | 图片辅助定位示例 |

### 5.5 escapeStringLiteral 增强

**来源**: Agent #2

**问题**: `escapeStringLiteral()` 缺少对 `\n`、`\r`、`\t` 的转义处理。

**涉及文件**:
- `src/transpiler/generators/utils.js` — 补充转义字符
- `test/transpiler.test.js` — 新增用例

### 5.6 记录 Node.js 版本要求

**来源**: Agent #4

**问题**: `fs.globSync` 需要 Node.js 22+，未在任何文档中说明。

**涉及文件**:
- `package.json` — engines 字段添加 `"node": ">=22"`

### 5.7 Guide 版本号对齐

**来源**: Agent #5 (L2)

**问题**: Guide 标注 "Version: 1.1"，Skill 标注 "1.2.0"，不一致。

**涉及文件**:
- `guide/MIDSCENE_YAML_GUIDE.md` — 版本号对齐为 1.2.0

---

## 七、实施顺序与依赖

```
Phase 1 (P0) — API 签名 + Schema 修正
  ├── 1.1 aiAssert errorMessage                    ← 独立
  ├── 1.2 aiKeyboardPress 参数                     ← 独立
  ├── 1.3 aiScroll 参数                            ← 独立
  ├── 1.4 Schema 三大结构性错误                     ← 独立
  └── 1.5 Schema 遗漏项                            ← 依赖 1.4
      ↓
Phase 2 (P1) — 缺失 API 能力
  ├── 2.1 新增 3 个动作 (Double/Right/Locate)       ← 依赖 Phase 1
  ├── 2.2 类型化数据提取 (Boolean/Number/String)     ← 依赖 Phase 1
  ├── 2.3 aiInput mode                             ← 独立
  ├── 2.4 native-keywords 补全                      ← 独立
  └── 2.5 cache 对象格式                            ← 独立
      ↓
Phase 3 (P2) — Skill 定义优化
  ├── 3.1 argument-hint 位置修正                    ← 独立
  ├── 3.2 英文触发短语                              ← 独立
  ├── 3.3 description 优化                          ← 可并行
  └── 3.4 allowed-tools                            ← 可并行
      ↓
Phase 4 (P2) — 验证器 + 测试
  ├── 4.1 新增 4 个验证规则                         ← 独立
  ├── 4.2 补全负面测试 (~12个)                      ← 依赖 4.1
  ├── 4.3 平台 fixtures                             ← 独立
  └── 4.4 CLI parseArgs 测试修复                    ← 独立
      ↓
Phase 5 (P3) — 文档/模板完善
  ├── 5.1 Guide 7 处补充                            ← 依赖 Phase 2
  ├── 5.2 模板标准化                                ← 独立
  ├── 5.3 新增 3 个模板                             ← 依赖 Phase 2
  ├── 5.4 escapeStringLiteral                       ← 独立
  └── 5.5 Node.js 版本要求                          ← 独立
```

---

## 八、涉及文件汇总

| 文件 | Phase | 改动内容 |
|------|-------|---------|
| `src/transpiler/generators/native-gen.js` | 1,2 | aiAssert/aiKeyboardPress/aiScroll 修正 + deepThink/cacheable/images 透传 + javascript output + 新增动作 |
| `src/transpiler/generators/utils.js` | 5 | escapeStringLiteral 增强 |
| `src/transpiler/transpiler.js` | 2 | cache 对象格式处理 |
| `src/validator/yaml-validator.js` | 4 | 4 个新验证规则 |
| `schema/yaml-superset-schema.json` | 1 | 3 个结构修正 + 遗漏项补全 |
| `schema/native-keywords.json` | 2 | 新增动作 + 配置字段 + 选项 |
| `skills/midscene-yaml-generator/SKILL.md` | 3 | frontmatter + 触发短语 + 动作表 |
| `skills/midscene-runner/SKILL.md` | 3 | frontmatter + 触发短语 |
| `guide/MIDSCENE_YAML_GUIDE.md` | 5 | 7 处补充 |
| `templates/native/*.yaml` | 5 | 格式标准化 + 新增模板 |
| `templates/extended/*.yaml` | 5 | 格式标准化 + 新增模板 |
| `test/transpiler.test.js` | 1,2,4,5 | 签名修正 + 新动作 + 缺失路径补全 + escape |
| `test/validator.test.js` | 4 | ~20 个新测试 |
| `test/runner.test.js` | 4 | parseArgs 导入修复 |
| `test/fixtures/*.yaml` | 4 | 3 个新平台 fixture |
| `scripts/midscene-run.js` | 4 | 导出 parseArgs |
| `package.json` | 5 | engines 字段 |

---

## 九、预期成果

| 指标 | 改造前 | 改造后 |
|------|--------|--------|
| 官方 API 动作覆盖 | 10/17 (59%) | 16/17 (94%) |
| Schema 与 Validator 一致性 | 3 处结构性不匹配 | 完全一致 |
| native-keywords 完整性 | 缺 15+ 字段 | 完全覆盖 |
| 测试用例数 | 227 | ~270 |
| 平台 Fixture 覆盖 | web only | web + android + ios + computer |
| Skill 触发语言 | 仅中文 | 中英双语 |
| argument-hint 生效 | 否 | 是 |
| 转译代码 API 正确性 | 3 处签名错误 | 全部正确 |

---

## 十、验证方式

每个 Phase 完成后：
1. `npm test` — 全部测试通过
2. `node scripts/midscene-run.js test/fixtures/extended-full.yaml --dry-run` — 转译正常
3. 人工比对生成的 TS 代码与官方 SDK 签名
4. `npx skills check` — Skill 定义合规
5. 构造使用新增动作的 YAML 验证端到端链路
