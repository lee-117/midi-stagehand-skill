---
name: midscene-yaml-generator
version: 2.1.0
description: >
  Generate Midscene YAML browser automation files from natural language.
  Supports Web, Android, iOS with Native and Extended modes.
argument-hint: <描述你要自动化的操作，如 "登录 example.com 并提取商品价格">
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
5. **生成前必须读取 schema 和模板** — 使用 Read 工具读取 `schema/native-keywords.json` 和选中的模板文件，不要生成 schema 中未定义的关键字
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

## 触发条件

当用户描述一个浏览器自动化需求（自然语言），需要生成 Midscene YAML 文件时使用。

常见触发短语：
- "生成一个 YAML 来..."
- "帮我写个自动化脚本..."
- "创建 Midscene 测试用例..."
- "我想自动化 XXX 操作..."
- "把这个需求转成 YAML..."
- "写个 Midscene 配置文件..."

English trigger phrases:
- "Generate a YAML for..."
- "Write an automation script to..."
- "Create a test case for..."
- "Automate the login flow"
- "Convert this requirement to YAML"
- "Write a Midscene config file for..."

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

**Web 平台额外配置选项**：
- `headless: true/false` — 是否无头模式运行（默认 false）
- `viewportWidth` / `viewportHeight` — 视口大小（默认 1280×960）
- `userAgent` — 自定义 User-Agent
- `deviceScaleFactor` — 设备像素比（如 Retina 屏设 2）
- `waitForNetworkIdle` — 网络空闲等待配置，支持 `true` 或对象格式 `{ timeout: 2000, continueOnNetworkIdleError: true }`
- `waitForNavigationTimeout` — 导航完成等待时间（ms，默认 5000，设 0 禁用）
- `waitForNetworkIdleTimeout` — 网络空闲等待时间（ms，默认 2000，设 0 禁用）
- `cookie` — Cookie JSON 文件路径（实现免登录会话恢复）
- `bridgeMode` — Bridge 模式：`false`（默认）| `'newTabWithUrl'` | `'currentTab'`，复用已登录的桌面浏览器
- `chromeArgs` — 自定义 Chrome 启动参数数组（如 `['--disable-gpu', '--proxy-server=...']`）
- `serve` — 本地静态文件目录，启动内置服务器（本地开发测试用）
- `acceptInsecureCerts` — 忽略 HTTPS 证书错误（默认 false）
- `closeNewTabsAfterDisconnect` — 断开时关闭新打开的标签页（默认 false）
- `outputFormat` — 报告输出格式：`'single-html'` | `'html-and-external-assets'`
- `forceSameTabNavigation` — 限制导航在当前标签页（默认 true）

### 第 3 步：自然语言 → YAML 转换

#### 动作选择优先级（重要）

1. **首选 `ai:`** — 用自然语言描述整个意图，让 AI 自动规划并执行多步骤。适合绝大多数场景，成功率最高
2. **需要精确控制时** — 使用 `aiTap`、`aiInput` 等具体动作（如填写特定表单字段）
3. **需要提取数据时** — 必须使用 `aiQuery`（`ai:` 不能返回结构化数据）
4. **需要验证状态时** — 使用 `aiAssert` 或 `aiWaitFor`

**经验法则**: 如果用户需求可以用一句自然语言描述完成，优先用一个 `ai:` 步骤，而不是拆成多个 `aiInput` + `aiTap`。

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
            flow:
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

使用以下映射规则表将用户需求转换为 YAML：

#### Native 动作映射

| 自然语言模式 | YAML 映射 | 说明 |
|-------------|-----------|------|
| "打开/访问/进入 XXX 网站" | `web: { url: "XXX" }` | 平台配置 |
| "自动规划并执行 XXX" | `ai: "XXX"` | AI 自动拆解为多步骤执行；`aiAct` 为等价别名；可选 `fileChooserAccept: "path"` 处理文件上传对话框 |
| "点击/按/选择 XXX" | `aiTap: "XXX"` | 简写形式；通用选项 `deepThink`、`xpath`、`cacheable`；支持 `locate` 对象 |
| "悬停/移到 XXX 上" | `aiHover: "XXX"` | 触发下拉菜单或 tooltip；支持 `locate` 对象 |
| "在 XXX 输入 YYY" | `aiInput: "XXX"` + `value: "YYY"` | 扁平兄弟格式；`mode: "replace"(默认)\|"clear"\|"typeOnly"`（官方 API）；`"append"` 为超集扩展（非官方，慎用）；支持 `locate` 对象 |
| "按键盘 XXX 键" | `aiKeyboardPress: "XXX"` | 支持组合键如 "Control+A"；`keyName` 可作为替代参数 |
| "向下/上/左/右滚动" | `aiScroll: "目标区域"` + `direction: "down"` | 扁平兄弟格式；可选 `distance`、`scrollType: "singleAction"\|"scrollToBottom"\|"scrollToTop"\|"scrollToRight"\|"scrollToLeft"` |
| "等待 XXX 出现" | `aiWaitFor: "XXX"` | 可选 `timeout`（默认 15000ms）、`checkIntervalMs`（轮询间隔）；可选 `domIncluded`/`screenshotIncluded` 控制 AI 分析范围 |
| "检查/验证/确认 XXX" | `aiAssert: "XXX"` | 可选 errorMessage |
| "获取/提取/读取 XXX" | `aiQuery: { query: "XXX", name: "result" }` | name 用于存储结果 |
| "暂停/等待 N 秒" | `sleep: N*1000` | 参数为毫秒 |
| "执行 JS 代码" | `javascript: "代码内容"` | 直接执行 JavaScript |
| "截图记录到报告" | `recordToReport: "标题"` + `content: "描述"` | 截图并记录描述到报告 |
| "双击 XXX" | `aiDoubleClick: "XXX"` | 双击操作；可选 `deepThink: true`；支持 `locate` 对象 |
| "右键点击 XXX" | `aiRightClick: "XXX"` | 右键操作；可选 `deepThink: true`；支持 `locate` 对象 |
| "定位 XXX 元素" | `aiLocate: "XXX"` + `name: "elem"` | 定位元素，结果存入变量（Extended 模式可引用） |
| "XXX 是否为真？" | `aiBoolean: "XXX"` + `name: "flag"` | 返回布尔值；`domIncluded`(true/false/"visible-only") 控制是否使用 DOM 文本，`screenshotIncluded`(true/false) 控制是否使用截图 |
| "获取 XXX 数量" | `aiNumber: "XXX"` + `name: "count"` | 返回数字；同上 `domIncluded`/`screenshotIncluded` 选项 |
| "获取 XXX 文本" | `aiString: "XXX"` + `name: "text"` | 返回字符串；同上 `domIncluded`/`screenshotIncluded` 选项 |
| "询问 AI XXX" | `aiAsk: "XXX"` + `name: "answer"` | 自由提问，返回文本答案 |
| "拖拽 A 到 B" | `aiDragAndDrop: { from: "A", to: "B" }` | 推荐嵌套格式；也支持扁平简写 `aiDragAndDrop: "A"` + `to: "B"`；支持 `locate` 对象 |
| "清空 XXX 输入框" | `aiClearInput: "XXX"` | 清除输入框内容 |
| "执行 ADB 命令" | `runAdbShell: "命令"` | Android 平台特有 |
| "执行 WDA 请求" | `runWdaRequest: { ... }` | iOS 平台特有 |
| "启动应用" | `launch: "包名"` | 移动端启动应用 |
| "长按 XXX" | `aiLongPress: "XXX"` | 长按元素；可选 `duration`（ms）指定长按时长 |
| "Android 返回" | `AndroidBackButton: true` | Android 系统返回按钮 |
| "Android 主页" | `AndroidHomeButton: true` | Android 系统主页按钮 |
| "Android 最近任务" | `AndroidRecentAppsButton: true` | Android 最近应用按钮 |
| "iOS 主页" | `IOSHomeButton: true` | iOS 系统主页按钮 |
| "iOS 切换应用" | `IOSAppSwitcher: true` | iOS 应用切换器 |

#### Extended 控制流映射

| 自然语言模式 | YAML 映射 |
|-------------|-----------|
| "定义变量 XXX 为 YYY" | `variables: { XXX: "YYY" }` |
| "使用环境变量 XXX" | `${ENV:XXX}` 或 `${ENV.XXX}` |
| "如果 XXX 则 YYY 否则 ZZZ" | `logic: { if: "XXX", then: [YYY], else: [ZZZ] }` |
| "重复 N 次" | `loop: { type: repeat, count: N, steps: [...] }` |
| "对每个 XXX 执行" | `loop: { type: for, items: "XXX", itemVar: "item", steps: [...] }` （`itemVar`/`as`/`item` 均可）。循环支持 `indexVar: "i"` 自定义索引变量名（零基索引） |
| "当 XXX 时持续做 YYY" | `loop: { type: while, condition: "XXX", maxIterations: N, steps: [...] }` |
| "先做 A，失败了就做 B" | `try:` / `flow: [A]` / `catch:` / `flow: [B]`（try 和 catch 是步骤级别的兄弟键） |
| "同时做 A 和 B" | `parallel: { branches: [{steps: [A]}, {steps: [B]}], waitAll: true, merge_results: true }` |
| "调用 XXX 接口" | `external_call: { type: http, method: POST, url: "XXX", response_as: "varName" }` |
| "执行 Shell 命令" | `external_call: { type: shell, command: "XXX" }` |
| "导入/复用 XXX 流程" | `import: [{ flow: "XXX.yaml", as: name }]` |
| "过滤/排序/映射数据" | `data_transform: { source, operation, ... }` |
| "冻结页面上下文" | `freezePageContext: true` |
| "解冻页面上下文" | `unfreezePageContext: true` |

**Extended 模式完整示例**：

```yaml
engine: extended
features: [variables, logic, loop]

web:
  url: "https://example.com/products"

variables:
  keyword: "手机"
  maxPages: 5

tasks:
  - name: "搜索并采集多页商品"
    flow:
      - aiInput: "搜索框"
        value: "${keyword}"
      - aiTap: "搜索按钮"
      - aiWaitFor: "搜索结果列表已加载"
        timeout: 10000
      - loop:
          type: repeat
          count: "${maxPages}"
          maxIterations: 10
          steps:
            - aiQuery:
                query: "提取当前页所有商品名称，返回字符串数组"
                name: "products"
            - logic:
                if: "document.querySelector('.next-page.disabled')"
                then:
                  - ai: "点击下一页按钮"
                  - aiWaitFor: "新一页商品已加载"
                else:
                  - sleep: 1000
      - aiAssert: "已完成多页商品采集"
```

### 第 4 步：选择模板起点

参考 `templates/` 目录下的模板文件，找到最接近用户需求的模板作为起点。**使用 Read 工具读取选中的模板文件作为结构参考**。

**多模板匹配时选最具体的；无匹配时 native 用 `web-basic.yaml`，extended 用 `e2e-workflow.yaml`**。

**Native 模板**：
- `templates/native/web-basic.yaml` — 基础网页操作
- `templates/native/web-login.yaml` — 登录流程
- `templates/native/web-data-extract.yaml` — 数据提取
- `templates/native/web-search.yaml` — 网页搜索流程
- `templates/native/web-file-upload.yaml` — 文件上传表单
- `templates/native/web-multi-tab.yaml` — 多标签页操作
- `templates/native/deep-think-locator.yaml` — 图片辅助定位（deepThink/xpath）
- `templates/native/android-app.yaml` — Android 测试
- `templates/native/ios-app.yaml` — iOS 测试
- `templates/native/computer-desktop.yaml` — 桌面应用自动化
- `templates/native/web-bridge-mode.yaml` — Bridge 模式连接已运行浏览器
- `templates/native/web-cookie-session.yaml` — Cookie 会话恢复
- `templates/native/web-local-serve.yaml` — 本地静态文件服务测试

**Extended 模板**：
- `templates/extended/web-conditional-flow.yaml` — 条件分支
- `templates/extended/web-pagination-loop.yaml` — 分页循环
- `templates/extended/web-data-pipeline.yaml` — 数据流水线
- `templates/extended/multi-step-with-retry.yaml` — 带重试的多步骤
- `templates/extended/api-integration-test.yaml` — API 集成
- `templates/extended/e2e-workflow.yaml` — 端到端完整工作流
- `templates/extended/reusable-sub-flows.yaml` — 子流程复用（import/use）
- `templates/extended/responsive-test.yaml` — 多视口响应式测试
- `templates/extended/web-auth-flow.yaml` — OAuth/登录认证流程（使用变量和环境引用）

**模板选择决策**：

| 需求特征 | 推荐模板 |
|---------|---------|
| 简单页面操作（打开、点击、输入） | `native/web-basic.yaml` |
| 登录 / 表单填写 | `native/web-login.yaml` |
| 数据采集 / 信息提取 | `native/web-data-extract.yaml` |
| 搜索 + 结果验证 | `native/web-search.yaml` |
| 文件上传 / 附件提交 | `native/web-file-upload.yaml` |
| OAuth/第三方认证登录 | `extended/web-auth-flow.yaml` |
| 桌面应用自动化（非浏览器） | `native/computer-desktop.yaml` |
| 需要条件判断（如果登录了就...） | `extended/web-conditional-flow.yaml` |
| 需要翻页 / 列表遍历 | `extended/web-pagination-loop.yaml` |
| 数据过滤 / 排序 / 聚合 | `extended/web-data-pipeline.yaml` |
| 需要失败重试 | `extended/multi-step-with-retry.yaml` |
| 需要调用外部 API | `extended/api-integration-test.yaml` |
| 完整业务流程（多步骤 + 变量 + 导出） | `extended/e2e-workflow.yaml` |
| 子流程复用 / 模块化 | `extended/reusable-sub-flows.yaml` |
| 多屏幕尺寸响应式验证 | `extended/responsive-test.yaml` |
| 复杂元素定位 / deepThink | `native/deep-think-locator.yaml` |
| 多标签页操作 | `native/web-multi-tab.yaml` |
| 连接已运行的浏览器（Bridge 模式） | `native/web-bridge-mode.yaml` |
| 免登录会话恢复（Cookie） | `native/web-cookie-session.yaml` |
| 本地开发/构建产物测试 | `native/web-local-serve.yaml` |

### 第 5 步：生成 YAML

**生成前，使用 Read 工具读取 `schema/native-keywords.json`（Native 模式）或 `schema/extended-keywords.json`（Extended 模式）确认合法关键字。不要生成 schema 中未定义的关键字。**

基于模板和转换规则生成 YAML 内容，注意以下要点：

1. **文件头部**：添加注释说明需求来源和生成时间
2. **engine 字段**：Extended 模式必须显式声明 `engine: extended`
3. **features 列表**：Extended 模式下声明使用的特性（如 `features: [logic, variables, loop]`），Native 模式可省略
4. **agent 配置**（可选）：控制 AI 行为和报告生成
   - `testId` — 标识测试用例
   - `groupName` / `groupDescription` — 报告分组和描述
   - `cache: true` — 缓存 AI 结果加速重复运行；也支持对象格式 `{ strategy: "read-write"|"read-only"|"write-only", id: "cache-key" }`
   - `generateReport: true` / `autoPrintReportMsg: true` / `reportFileName` — 报告生成控制
   - `replanningCycleLimit` — AI 重新规划上限（默认 20，UI-TARS 模型为 40）
   - `aiActContext` — 为 AI 提供背景知识（如多语言网站标注语言、特殊领域术语）
   - `screenshotShrinkFactor` — 截图缩放因子（0-1，节省 token）
   - `waitAfterAction` — 每次操作后等待时间（ms，默认 300）
   - `modelConfig` — 自定义模型配置（覆盖环境变量中的模型设置）
   - `outputFormat` — 报告输出格式：`'single-html'` | `'html-and-external-assets'`
5. **continueOnError**（可选）：任务级别设置，该任务失败后后续任务仍会继续执行（注意：是任务级别非步骤级别）
6. **output 导出**（可选）：将 `aiQuery` 等结果导出为 JSON 文件。`name` 变量仅在当前 task 内有效，跨 task 需用 `output: { filePath, dataName }` 导出

#### 输出格式

```yaml
# 自动生成 by Midscene YAML Generator
# 需求描述: [用户原始需求]
# 生成时间: [YYYY-MM-DD HH:mm]
# validated: [ISO-8601 时间戳，dry-run 通过后自动填入]

engine: native|extended
features: [...]  # 仅 extended 模式

# 可选: agent 配置
# agent:
#   testId: "test-001"
#   groupName: "自动化测试组"
#   cache: true
#   screenshotShrinkFactor: 0.5
#   waitAfterAction: 500

[platform_config]

tasks:
  - name: "[任务名称]"
    # continueOnError: true  # 可选：任务失败后继续执行后续任务
    flow:
      [生成的步骤]
    # output:                # 可选：导出数据（跨 task 传递）
    #   filePath: "./midscene-output/data.json"
    #   dataName: "variableName"
```

#### 输出验证自检清单（生成后立即检查）

- [ ] 每个 `aiInput` 都有对应的 `value` 参数？
- [ ] 关键操作后有 `aiWaitFor` 确保页面状态就绪？
- [ ] Extended 模式声明了 `engine: extended` 和 `features` 列表？
- [ ] 循环有安全上限（`maxIterations` 或合理的 `count`）？
- [ ] 敏感信息（密码、Token）使用 `${ENV:XXX}` 引用环境变量？
- [ ] AI 指令描述足够精确（包含位置、文字、颜色等特征）？

### 澄清问题指南

如果用户已提供 URL、清晰的操作描述且无认证歧义，直接生成。仅在关键信息缺失时才提问。

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

## AI 指令编写最佳实践

生成 YAML 时，AI 指令（`aiTap`、`aiAssert` 等参数）的质量直接影响执行成功率。遵循以下原则：

### 描述精确性

- **差**: `aiTap: "按钮"` — 页面可能有多个按钮
- **好**: `aiTap: "页面右上角的蓝色登录按钮"` — 位置 + 颜色 + 功能
- **更好**: `aiTap: "导航栏中文字为'立即登录'的按钮"` — 精确到文字内容

### 定位策略优先级

1. **自然语言描述**（首选）：可读性高，适应页面变化
2. **deepThink 模式**：复杂页面中多个相似元素时启用，AI 会进行更深层分析，准确率更高但耗时更长
3. **图片辅助定位**（image prompting）：当文字描述不够时，可通过截图标注辅助 AI 理解目标元素（官方 `locate.images` 能力）
4. **xpath 选择器**（最后手段）：当自然语言无法精确定位时。**注意：xpath 仅适用于 Web 平台**，Android/iOS 应使用自然语言描述

```yaml
# 优先使用自然语言
- aiTap: "商品列表中第三行的编辑按钮"

# 复杂场景启用 deepThink（相似元素多、定位不准时使用）
- aiTap: "第三行数据中的编辑图标"
  deepThink: true

# 最后手段使用 xpath（仅 Web 平台）
- aiTap: ""
  xpath: "//table/tbody/tr[3]//button[@class='edit']"
```

### 图片辅助定位（locate 对象）

当自然语言描述不够精确时，可通过 `locate` 对象提供参考图片：

```yaml
# 使用图片辅助 AI 识别目标元素
- aiTap:
    locate:
      prompt: "与参考图片相似的图标按钮"
      images:
        - name: "target-icon"
          url: "https://example.com/icon.png"
      convertHttpImage2Base64: true

# 简化形式：直接在 images 选项中提供
- aiTap: "与参考图片相似的图标按钮"
  images:
    - "./images/target-icon.png"
```

### aiQuery 结果格式化

在 `query` 中明确指定期望的数据结构：

```yaml
- aiQuery:
    query: >
      提取页面上所有商品信息，返回数组格式。
      每个元素包含以下字段：
      - name: 商品名称（字符串）
      - price: 价格（数字）
      - inStock: 是否有库存（布尔值）
    name: "productList"
```

### 等待策略

在关键操作后添加 `aiWaitFor`，确保页面状态就绪：

```yaml
- aiTap: "提交按钮"
- aiWaitFor: "提交成功提示出现，或页面跳转到结果页"
  timeout: 10000
```

## 数据转换操作参考

Extended 模式下 `data_transform` 支持的操作：

| 操作 | 说明 | 关键参数 |
|------|------|---------|
| `filter` | 按条件过滤 | `condition`（JS 表达式，用 `item` 引用当前元素） |
| `sort` | 排序 | `by`（字段名）、`order`（asc/desc） |
| `map` | 映射/变换 | `template`（字段映射模板） |
| `reduce` | 聚合计算 | `reducer`（JS 表达式）、`initial`（初始值） |
| `unique` / `distinct` | 去重 | `by`（去重依据的字段） |
| `slice` | 截取子集 | `start`、`end` |
| `flatten` | 展平嵌套数组 | `depth`（展平深度，默认 1） |
| `groupBy` | 按字段分组 | `by` 或 `field`（分组依据的字段名） |

> **两种格式**: 平面格式 `{source, operation, name}` 适合单步操作；嵌套格式 `{input, operations:[], output}` 支持链式多步操作。两种格式均支持所有 8 种操作。

## 平台特定注意事项

### Web 平台
- `url` 必须包含完整协议（`https://`）；无协议默认补 `https://`，`localhost` 默认补 `http://`
- 使用 `aiWaitFor` 等待页面加载完成后再操作
- 表单操作前确保输入框处于可交互状态

### Android 平台
- 需要配置 `deviceId`（ADB 设备 ID，如 `emulator-5554`）
- 使用 `launch: "com.example.app"` 启动应用（在 flow 中作为 action 步骤）
- 可使用 `runAdbShell` 执行 ADB 命令
- 额外配置：`keyboardDismissStrategy`（`esc-first` | `back-first`）、`imeStrategy`（`adbBroadcast` | `adbInput`）、`scrcpyConfig`

### iOS 平台
- 需要配置 `wdaPort`（WebDriverAgent 端口，默认 8100）和 `wdaHost`（默认 localhost）
- 使用 `launch: "com.example.app"` 启动应用（在 flow 中作为 action 步骤）
- 可使用 `runWdaRequest` 发送 WebDriverAgent 请求

### Computer 平台
- 用于通用桌面自动化场景
- 额外配置：`xvfbResolution`（如 `'1920x1080x24'`，Linux 虚拟显示器分辨率）

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
    steps: [...]

# RIGHT
- loop:
    type: while
    condition: "hasMore"
    maxIterations: 50
    steps: [...]
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

**5. 缺少 features 声明**

```yaml
# WRONG
engine: extended
tasks: [...]

# RIGHT
engine: extended
features: [logic, variables, loop]
tasks: [...]
```

## 输出前自检清单

生成 YAML 后，在输出前核验以下事项：

- [ ] 每个 `aiInput` 都有对应的 `value` 参数？
- [ ] 关键操作后有 `aiWaitFor` 确保页面状态就绪？
- [ ] Extended 模式声明了 `engine: extended` 和 `features` 列表？
- [ ] 循环有安全上限（`maxIterations` 或合理的 `count`）？
- [ ] 敏感信息（密码、Token）使用 `${ENV:XXX}` 引用环境变量？
- [ ] AI 指令描述足够精确（包含位置、文字、颜色等特征）？

## 注意事项

- AI 指令（aiTap、aiAssert 等）的参数使用自然语言描述，不需要 CSS 选择器
- 中文和英文描述均可，Midscene 的 AI 引擎支持多语言
- `aiQuery` 的结果通过 `name` 字段存储，在后续步骤中用 `${name}` 引用（仅 Extended 模式）
- `aiWaitFor` 建议设置合理的 `timeout`（毫秒），官方默认 15000ms（15 秒）；`checkIntervalMs` 控制轮询间隔
- 循环中务必设置 `maxIterations` 作为安全上限，防止无限循环
- `${ENV:XXX}` 或 `${ENV.XXX}` 可引用环境变量，避免在 YAML 中硬编码敏感信息
- 始终显式声明 `engine` 字段，避免自动检测带来的意外行为
- 变量名必须是合法 JavaScript 标识符（字母/下划线开头），推荐 camelCase
- 变量引用区分大小写：`${userName}` 和 `${username}` 是不同的变量
- 数值参数范围：`sleep`: 100-30000ms，`timeout`: 5000-60000ms，`maxIterations`: 1-1000
- 避免循环导入：A.yaml 导入 B.yaml、B.yaml 又导入 A.yaml 会导致运行时错误
- 复杂需求拆分：>10 步建议拆分为多个 task，跨域操作拆分为多文件 + import/use
- 生成后务必通过 `--dry-run` 验证语法和结构（注意：`--dry-run` 不检测模型配置，AI 操作需要配置 `MIDSCENE_MODEL_API_KEY` 才能实际执行）
- 提示用户可以用 **Midscene Runner** skill 来执行生成的文件

## 迭代修复流程

当生成的 YAML 执行失败时：

1. **Runner 可自行修复**：缩进、缺少 engine 声明、缺少 timeout 等简单错误，Runner Skill 会直接修改并重试
2. **接收 Runner 错误上下文**：当 Runner 发送 `[ESCALATE]` 格式的错误时，解析错误类型、失败步骤和建议，针对性地重新生成或修改 YAML
3. **推荐流程**：生成 → dry-run 验证 → 执行 → 如失败，描述错误让 Generator 修复 → 重新执行
4. **自动修复上限**：自动修复最多尝试 3 次。3 次 dry-run 均失败后，将错误展示给用户并请求指导

## 协作协议

生成完成后，向用户返回以下结构化信息：

```
[GENERATED] ./midscene-output/<filename>.yaml
[MODE] native|extended
[FEATURES] loop, logic, ...  (仅 extended 模式)
[NEXT] /midscene-runner ./midscene-output/<filename>.yaml
```

1. **生成的文件路径**: `./midscene-output/<filename>.yaml`
2. **执行模式**: native 或 extended
3. **使用的特性**: 仅 extended 模式列出
4. **建议的下一步命令**: `node scripts/midscene-run.js <path> --dry-run`
5. 如果 dry-run 验证失败，自动分析错误并修复 YAML，重新验证
