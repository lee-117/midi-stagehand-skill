# Midscene YAML Generator

## 触发条件

当用户描述一个浏览器自动化需求（自然语言），需要生成 Midscene YAML 文件时使用。

常见触发短语：
- "生成一个 YAML 来..."
- "帮我写个自动化脚本..."
- "创建 Midscene 测试用例..."
- "我想自动化 XXX 操作..."
- "把这个需求转成 YAML..."
- "写个 Midscene 配置文件..."

## 工作流程

### 第 1 步：分析需求复杂度

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
| "测试 Android 应用" | Android | `android: { device: "...", pkg: "..." }` |
| "测试 iOS 应用" | iOS | `ios: { device: "...", bundleId: "..." }` |
| "桌面自动化" | Computer | `computer: { ... }` |

**Web 平台额外配置选项**：
- `headless: true/false` — 是否无头模式运行（默认 false）
- `viewportWidth` / `viewportHeight` — 视口大小
- `userAgent` — 自定义 User-Agent
- `waitForNetworkIdle` — 是否等待网络空闲

### 第 3 步：自然语言 → YAML 转换

使用以下映射规则表将用户需求转换为 YAML：

#### Native 动作映射

| 自然语言模式 | YAML 映射 | 说明 |
|-------------|-----------|------|
| "打开/访问/进入 XXX 网站" | `web: { url: "XXX" }` | 平台配置 |
| "自动规划并执行 XXX" | `ai: "XXX"` | AI 自动拆解为多步骤执行 |
| "点击/按/选择 XXX" | `aiTap: "XXX"` | 简写形式 |
| "悬停/移到 XXX 上" | `aiHover: "XXX"` | 触发下拉菜单或 tooltip |
| "在 XXX 输入 YYY" | `aiInput: { locator: "XXX", value: "YYY" }` | locator + value 格式 |
| "按键盘 XXX 键" | `aiKeyboardPress: "XXX"` | 支持组合键如 "Control+A" |
| "向下/上/左/右滚动" | `aiScroll: { direction: "down" }` | 可选 locator 和 scrollCount |
| "等待 XXX 出现" | `aiWaitFor: "XXX"` | 可选 timeout（毫秒） |
| "检查/验证/确认 XXX" | `aiAssert: "XXX"` | 可选 errorMessage |
| "获取/提取/读取 XXX" | `aiQuery: { query: "XXX", name: "result" }` | name 用于存储结果 |
| "暂停/等待 N 秒" | `sleep: N*1000` | 参数为毫秒 |
| "执行 JS 代码" | `javascript: "代码内容"` | 直接执行 JavaScript |
| "截图记录到报告" | `recordToReport` | 记录当前状态到报告 |
| "执行 ADB 命令" | `runAdbShell: "命令"` | Android 平台特有 |
| "执行 WDA 请求" | `runWdaRequest: { ... }` | iOS 平台特有 |
| "启动应用" | `launch: "包名"` | 移动端启动应用 |

#### Extended 控制流映射

| 自然语言模式 | YAML 映射 |
|-------------|-----------|
| "定义变量 XXX 为 YYY" | `variables: { XXX: "YYY" }` |
| "使用环境变量 XXX" | `${ENV:XXX}` 或 `${ENV.XXX}` |
| "如果 XXX 则 YYY 否则 ZZZ" | `logic: { if: "XXX", then: [YYY], else: [ZZZ] }` |
| "重复 N 次" | `loop: { type: repeat, count: N, steps: [...] }` |
| "对每个 XXX 执行" | `loop: { type: for, items: "XXX", itemVar: "item", steps: [...] }` |
| "当 XXX 时持续做 YYY" | `loop: { type: while, condition: "XXX", maxIterations: N, steps: [...] }` |
| "先做 A，失败了就做 B" | `try: { steps: [A] }, catch: { steps: [B] }` |
| "同时做 A 和 B" | `parallel: { branches: [{steps: [A]}, {steps: [B]}], waitAll: true }` |
| "调用 XXX 接口" | `external_call: { type: http, method: POST, url: "XXX" }` |
| "执行 Shell 命令" | `external_call: { type: shell, command: "XXX" }` |
| "导入/复用 XXX 流程" | `import: [{ flow: "XXX.yaml", as: name }]` |
| "过滤/排序/映射数据" | `data_transform: { source, operation, ... }` |

### 第 4 步：选择模板起点

参考 `templates/` 目录下的模板文件，找到最接近用户需求的模板作为起点：

**Native 模板**：
- `templates/native/web-basic.yaml` — 基础网页操作
- `templates/native/web-login.yaml` — 登录流程
- `templates/native/web-data-extract.yaml` — 数据提取
- `templates/native/android-app.yaml` — Android 测试
- `templates/native/ios-app.yaml` — iOS 测试

**Extended 模板**：
- `templates/extended/web-conditional-flow.yaml` — 条件分支
- `templates/extended/web-pagination-loop.yaml` — 分页循环
- `templates/extended/web-data-pipeline.yaml` — 数据流水线
- `templates/extended/multi-step-with-retry.yaml` — 带重试的多步骤
- `templates/extended/api-integration-test.yaml` — API 集成

### 第 5 步：生成 YAML

基于模板和转换规则生成 YAML 内容，注意以下要点：

1. **文件头部**：添加注释说明需求来源和生成时间
2. **engine 字段**：Extended 模式必须显式声明 `engine: extended`
3. **features 列表**：Extended 模式下声明使用的特性（如 `features: [logic, variables, loop]`）
4. **agent 配置**（可选）：如需自定义测试标识，添加 `agent` 配置
5. **continueOnError**（可选）：如需某个任务失败后继续执行后续任务，设置 `continueOnError: true`

#### 输出格式

```yaml
# 自动生成 by Midscene YAML Generator
# 需求描述: [用户原始需求]
# 生成时间: [timestamp]

engine: native|extended
features: [...]  # 仅 extended 模式

# 可选: agent 配置
# agent:
#   testId: "test-001"
#   groupName: "自动化测试组"
#   groupDescription: "描述"
#   cache: true

[platform_config]

tasks:
  - name: "[任务名称]"
    # continueOnError: true  # 可选：失败后继续
    flow:
      [生成的步骤]
    # output:                # 可选：导出数据
    #   filePath: "./midscene-output/data.json"
    #   dataName: "variableName"
```

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
2. **deepThink 模式**：复杂页面中有多个相似元素时启用
3. **xpath 选择器**（最后手段）：当自然语言无法精确定位时

```yaml
# 优先使用自然语言
- aiTap: "商品列表中第三行的编辑按钮"

# 复杂场景启用 deepThink
- aiTap:
    locator: "第三行数据中的编辑图标"
    deepThink: true

# 最后手段使用 xpath
- aiTap:
    xpath: "//table/tbody/tr[3]//button[@class='edit']"
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
- aiWaitFor:
    condition: "提交成功提示出现，或页面跳转到结果页"
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
| `unique` | 去重 | `by`（去重依据的字段） |
| `slice` | 截取子集 | `start`、`end` |

## 平台特定注意事项

### Web 平台
- `url` 必须包含完整协议（`https://`）
- 使用 `aiWaitFor` 等待页面加载完成后再操作
- 表单操作前确保输入框处于可交互状态

### Android 平台
- 需要配置 `device`（设备 ID）和 `pkg`（包名）
- 可使用 `runAdbShell` 执行 ADB 命令
- 使用 `launch` 启动应用

### iOS 平台
- 需要配置 `device` 和 `bundleId`
- 可使用 `runWdaRequest` 发送 WebDriverAgent 请求
- 使用 `launch` 启动应用

### Computer 平台
- 用于通用桌面自动化场景

## 注意事项

- AI 指令（aiTap、aiAssert 等）的参数使用自然语言描述，不需要 CSS 选择器
- 中文和英文描述均可，Midscene 的 AI 引擎支持多语言
- `aiQuery` 的结果通过 `name` 字段存储，在后续步骤中用 `${name}` 引用（仅 Extended 模式）
- `aiWaitFor` 建议设置合理的 `timeout`（毫秒），默认通常为 15 秒
- 循环中务必设置 `maxIterations` 作为安全上限，防止无限循环
- `${ENV:XXX}` 或 `${ENV.XXX}` 可引用环境变量，避免在 YAML 中硬编码敏感信息
- 始终显式声明 `engine` 字段，避免自动检测带来的意外行为
- 生成后务必通过 `--dry-run` 验证，确保语法和结构正确
- 提示用户可以用 **Midscene Runner** skill 来执行生成的文件
