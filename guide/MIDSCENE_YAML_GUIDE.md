# Midscene YAML 超集 — 渐进式指导手册

> **版本**: 2.0.0
> **适用范围**: Midscene YAML Native 模式 & Extended 超集模式
> **阅读建议**: 按 L1 → L5 依次阅读，每一级都建立在前一级的基础上。

---

## 目录

- [快速概览](#快速概览)
- [自然语言 → YAML 转换规则表](#自然语言--yaml-转换规则表)
- [L1: 快速上手 (Native)](#l1-快速上手-native)
- [L2: 精确操控 (Native)](#l2-精确操控-native)
- [L3: 数据与断言 (Native)](#l3-数据与断言-native)
- [L4: 逻辑控制 — 超集入门 (Extended)](#l4-逻辑控制--超集入门-extended)
- [L5: 系统集成 — 超集进阶 (Extended)](#l5-系统集成--超集进阶-extended)
- [性能调优指南](#性能调优指南)
- [多平台支持](#多平台支持)
- [附录 A: 关键字速查表](#附录-a-关键字速查表)
- [附录 B: engine 字段说明](#附录-b-engine-字段说明)
- [附录 C: 常见问题 (FAQ)](#附录-c-常见问题-faq)
- [附录 D: 从 TypeScript 迁移到 YAML](#附录-d-从-typescript-迁移到-yaml)
- [附录 E: 安全检测与验证](#附录-e-安全检测与验证)

---

## 快速概览

Midscene YAML 生态包含两种运行模式，覆盖从简单页面操作到复杂系统集成的全部场景。

### 两种模式

| | **Native 模式** | **Extended 超集模式** |
|---|---|---|
| **定位** | 快速编写、直接执行 | 复杂流程、系统集成 |
| **执行方式** | Midscene 引擎直接解析并执行 | 先转译为 TypeScript，再由 Playwright 执行 |
| **适用场景** | 页面操作、数据提取、简单断言 | 条件分支、循环、API 调用、并行任务 |
| **声明方式** | `engine: native`（默认，可省略） | `engine: extended`（必须显式声明） |
| **学习成本** | 低 — 9 个交互动作 + 3 个工具动作 | 中 — 需额外掌握变量、逻辑、集成关键字 |

### 核心管道

```
自然语言描述
    ↓
YAML 文件（.yaml / .yml）
    ↓
┌─────────────────────────────────┐
│  Detector（检测 engine 字段）     │
├────────────┬────────────────────┤
│  native    │  extended          │
│  直接执行   │  转译 → TypeScript  │
├────────────┴────────────────────┤
│          执行引擎                │
│  Midscene AI + Playwright       │
├─────────────────────────────────┤
│        生成报告 (Report)         │
└─────────────────────────────────┘
```

### 何时选择哪种模式？

- **选 Native**: 你的需求是"打开页面 → 点几下 → 检查结果"，没有分支和循环。
- **选 Extended**: 你需要条件判断、循环遍历、调用外部 API、导入子流程、并行执行等能力。
- **经验法则**: 先用 Native 写，当你发现自己需要 `if` 或 `for` 时，切换到 Extended。

---

## 自然语言 → YAML 转换规则表

下表列出了常见的自然语言表达与其对应的 YAML 写法。在编写 YAML 之前，先用自然语言描述你想要做什么，然后对照此表进行转换。

| 自然语言模式 | YAML 映射 | 模式 |
|---|---|---|
| "打开/访问/进入 XXX 网站" | `web: { url: "XXX" }` | Native |
| "点击/按/选择 XXX" | `aiTap: "XXX"` | Native |
| "悬停/移到 XXX 上" | `aiHover: "XXX"` | Native |
| "在 XXX 输入 YYY" | `aiInput: "XXX"` + `value: "YYY"` | Native |
| "按下键盘 XXX 键" | `aiKeyboardPress: "XXX"` | Native |
| "等待 XXX 出现" | `aiWaitFor: "XXX"` | Native |
| "检查/验证/确认 XXX" | `aiAssert: "XXX"` | Native |
| "获取/提取/读取 XXX" | `aiQuery: "XXX"` | Native |
| "向下/上/左/右滚动" | `aiScroll` + `direction` | Native |
| "自动规划并执行 XXX" | `ai: "XXX"` | Native |
| "如果 XXX 则 YYY 否则 ZZZ" | `logic: { if, then, else }` | Extended |
| "重复 N 次" / "对每个 XXX" | `loop: { type, count/items }` | Extended |
| "先做 A，失败了就做 B" | `try` / `catch` | Extended |
| "同时做 A 和 B" | `parallel` | Extended |
| "调用 XXX 接口" | `external_call` | Extended |
| "导入/复用 XXX 流程" | `import` | Extended |
| "对数据进行过滤/排序" | `data_transform` | Extended |
| "定义变量 XXX 为 YYY" | `variables: { XXX: "YYY" }` | Extended |

---

## L1: 快速上手 (Native)

**核心概念**: 用 YAML 描述"打开哪个页面、做什么操作"，Midscene 直接执行。

### 最小模板

每个 Native YAML 文件的基本骨架如下：

```yaml
web:
  url: "https://example.com"

tasks:
  - name: 任务名称
    flow:
      - 动作1
      - 动作2
```

三个顶层字段的含义：

- **`web`**: 定义目标页面的地址和浏览器设置。
- **`tasks`**: 任务列表，每个任务有自己的名称和执行流程。
- **`flow`**: 一个任务内部的步骤序列，按顺序依次执行。

### 平台配置详解

`web` 块支持以下配置字段（均为可选，除 `url` 外）：

```yaml
web:
  url: "https://example.com"         # 目标网址（必填）
  headless: false                     # 无头模式（默认 false）
  viewportWidth: 1280                 # 视口宽度（默认 1280）
  viewportHeight: 720                 # 视口高度（默认 720）
  userAgent: "Mozilla/5.0 Custom"     # 自定义 User-Agent
  deviceScaleFactor: 2                # 设备像素比（如 Retina 屏设为 2）
  cookie: "./cookies.json"            # Cookie JSON 文件路径（自动加载）
  acceptInsecureCerts: true           # 接受不安全的 HTTPS 证书
  waitForNetworkIdle: true            # 页面加载后等待网络空闲
  serve: "./dist"                     # 本地静态文件目录，自动启动本地服务器
  bridgeMode: "newTabWithUrl"          # 桥接模式: false | "newTabWithUrl" | "currentTab"
  forceSameTabNavigation: true        # 强制在同一标签页内导航
  chromeArgs:                         # Chrome 启动参数
    - "--disable-gpu"
    - "--no-sandbox"
```

> **Cookie 文件格式**: 标准的 Chromium cookie JSON 数组，每个元素包含 `name`、`value`、`domain`、`path` 等字段。设置 `cookie` 会自动引入 `fs` 模块。

> **`waitForNetworkIdle` 对象格式**: 除了简单的 `true`，还支持对象格式精确控制：
>
> ```yaml
> waitForNetworkIdle:
>   timeout: 30000                    # 等待超时（毫秒，默认引擎默认值）
>   continueOnNetworkIdleError: true  # 超时后是否继续执行（不抛错）
> ```

> **`serve` 用法**: 指定本地目录后，Midscene 会自动启动一个本地 HTTP 服务器，`url` 中可使用相对路径。适合测试本地构建产物。

> **`bridgeMode` 用法**: 桥接模式不会启动新浏览器，而是连接到已有的浏览器实例。值为 `"newTabWithUrl"` 时在新标签页打开 URL，`"currentTab"` 使用当前标签页，`false` 禁用（默认）。适用于需要保留浏览器状态或与其他工具共享浏览器的场景。

> **snake_case 兼容**: 所有字段同时支持 camelCase 和 snake_case 写法，例如 `viewportWidth` 等同于 `viewport_width`，`acceptInsecureCerts` 等同于 `accept_insecure_certs`。

### 示例 1: 打开页面

最简单的 YAML — 只是打开一个网页：

```yaml
web:
  url: "https://www.baidu.com"

tasks:
  - name: 打开百度首页
    flow:
      - aiWaitFor: "页面加载完成，能看到搜索框"
```

### 示例 2: 点击按钮

打开页面后，点击某个元素：

```yaml
web:
  url: "https://www.example.com"

tasks:
  - name: 点击导航链接
    flow:
      - aiTap: "关于我们"
      - aiWaitFor: "关于我们页面内容已显示"
```

### 示例 3: 输入文本

在搜索框中输入关键词并搜索：

```yaml
web:
  url: "https://www.baidu.com"

tasks:
  - name: 搜索关键词
    flow:
      - aiInput: "搜索框"
        value: "Midscene 自动化测试"
      - aiTap: "百度一下"
      - aiWaitFor: "搜索结果已加载"
```

### 运行方式

在终端中执行：

```bash
# 执行 YAML 文件
node scripts/midscene-run.js example.yaml

# 仅验证 + 转译，不执行（Extended 模式下会显示生成的 TypeScript）
node scripts/midscene-run.js example.yaml --dry-run

# 保存转译结果到文件
node scripts/midscene-run.js example.yaml --output-ts output.ts

# 使用 Playwright 模板（默认 Puppeteer）
node scripts/midscene-run.js example.yaml --template playwright

# 批量执行多个文件
node scripts/midscene-run.js "tests/**/*.yaml"
```

执行完毕后，会自动生成一份 HTML 报告，展示每一步的截图和执行结果。

**Dry-run 输出说明**: `--dry-run` 模式下会依次显示验证结果（warnings/errors）、检测到的模式和特性、生成的 TypeScript 代码（Extended 模式），以及转译器 warnings（如存在未知步骤类型）。

### 常见错误与修复

| 错误现象 | 原因 | 修复方式 |
|---|---|---|
| `url is required` | `web` 下缺少 `url` 字段 | 补上 `url: "https://..."` |
| YAML 解析失败 | 缩进不一致（混用 Tab 和空格） | 统一使用 2 个空格缩进 |
| 动作超时 | 描述太模糊，AI 找不到元素 | 使用更具体的自然语言描述 |
| `flow` 下没有步骤 | `flow` 为空数组 | 至少添加一个动作步骤 |

### 完整可运行示例

```yaml
# L1-demo.yaml — 百度搜索并验证结果
web:
  url: "https://www.baidu.com"

tasks:
  - name: 搜索 Midscene
    flow:
      - aiInput: "搜索输入框"
        value: "Midscene AI 自动化"
      - aiTap: "百度一下 按钮"
      - aiWaitFor: "搜索结果页面已加载，能看到搜索结果列表"
      - aiAssert: "页面中包含搜索结果"
```

---

## L2: 精确操控 (Native)

**核心概念**: 9 个交互动作 + 3 个工具动作，让你精确控制每一步。

交互动作：`aiTap`、`aiHover`、`aiInput`、`aiKeyboardPress`、`aiScroll`、`aiDoubleClick`、`aiRightClick`、`ai`（别名 `aiAct`）。
工具动作：`sleep`、`javascript`、`recordToReport`。

### 交互动作详解

#### 1. `aiTap` — 点击元素

用自然语言描述你要点击的目标，AI 会定位并点击它。

```yaml
# 简写形式
- aiTap: "登录按钮"

# 完整形式（含深度思考）
- aiTap:
    locator: "页面右上角的蓝色登录按钮"
    deepThink: true
```

#### 2. `aiHover` — 悬停在元素上

鼠标移动到目标元素上方但不点击，常用于触发下拉菜单或 tooltip。

```yaml
- aiHover: "用户头像"
- aiWaitFor: "下拉菜单出现"
- aiTap: "个人设置"
```

#### 3. `aiInput` — 输入文本

先定位输入框，再填入指定的值。如果输入框中已有内容，会先清除再输入。

```yaml
- aiInput: "用户名输入框"
  value: "testuser@example.com"
```

#### 4. `aiKeyboardPress` — 按下键盘按键

模拟键盘按键操作，支持特殊键（Enter、Tab、Escape 等）和组合键。也可用 `keyName` 作为替代参数指定按键名称。

```yaml
# 按下 Enter 键
- aiKeyboardPress: "Enter"

# 按下 Escape 关闭弹窗
- aiKeyboardPress: "Escape"

# 组合键
- aiKeyboardPress: "Control+A"
```

#### 5. `aiScroll` — 滚动页面

控制页面或特定元素的滚动方向和距离。使用扁平/兄弟格式：

```yaml
# 简写 — 向下滚动
- aiScroll: "页面内容区域"
  direction: "down"

# 完整形式 — 在指定区域内向右滚动
- aiScroll: "商品列表区域"
  direction: "right"
  distance: 900

# 使用 scrollType 控制滚动行为
- aiScroll: "长列表"
  scrollType: "scrollToBottom"

# 使用 distance 精确控制滚动距离（像素）
- aiScroll: "商品详情页"
  direction: "down"
  distance: 500
```

支持的方向：`up`、`down`、`left`、`right`。

支持的 `scrollType`：`singleAction`、`scrollToBottom`、`scrollToTop`、`scrollToRight`、`scrollToLeft`。

`distance`：可选，以像素为单位指定滚动距离。未指定时由引擎自动决定滚动量。

#### 6. `ai` — 自动规划执行

将一段自然语言描述交给 AI，让它自动规划并执行多个步骤。适合不需要精确控制每一步的场景。

```yaml
# AI 自动规划并执行
- ai: "在搜索框中输入 hello world，然后点击搜索按钮"
```

> **提示**: `ai` 动作是"高级自动驾驶"，而 `aiTap`、`aiInput` 等是"手动挡"。当你需要确保每一步都精准无误时，使用具体的动作；当步骤比较简单且容错空间大时，可以用 `ai` 简化编写。

> **别名**: `aiAct` 是 `ai` 的完全等价别名，两者可互换使用。

#### 7. `aiDoubleClick` — 双击元素

双击页面上的目标元素，常用于打开文件、进入编辑模式等场景。

```yaml
# 双击打开文件
- aiDoubleClick: "文件列表中名为 report.xlsx 的文件"

# 双击进入编辑模式
- aiDoubleClick: "表格中第一行的名称单元格"
  deepThink: true
```

#### 8. `aiRightClick` — 右键点击

在目标元素上点击鼠标右键，通常用于触发上下文菜单。

```yaml
# 右键打开菜单
- aiRightClick: "文件列表中的第一个文件"
- aiWaitFor: "右键菜单出现"
- aiTap: "菜单中的删除选项"
```

#### 9. `aiDragAndDrop` — 拖拽操作

将一个元素拖拽到另一个位置。

```yaml
# 扁平格式（推荐）
- aiDragAndDrop: "待办事项列表中的第一个任务"
  to: "已完成列表区域"

# 嵌套格式
- aiDragAndDrop:
    from: "文件 A"
    to: "目标文件夹"
```

#### 10. `aiClearInput` — 清空输入框

清除输入框中的全部内容。

```yaml
- aiClearInput: "搜索框"
```

#### 11. `aiAsk` — AI 自由问答

向 AI 提出关于当前页面的问题，返回文本答案。

```yaml
- aiAsk: "当前页面的主题是什么？"
  name: "pageTheme"
```

### `deepThink` 选项

当页面 UI 复杂、元素难以定位时，开启 `deepThink` 让 AI 进行更深入的分析：

```yaml
- aiTap: "第三行数据中的编辑图标"
  deepThink: true
```

`deepThink` 会让 AI 花更多时间分析页面结构，但定位准确率更高。适用于：

- 页面中有多个相似元素（如表格中的多个按钮）。
- 元素没有明显的文字标签（如纯图标按钮）。
- 动态加载的内容区域。

### `xpath` 选项

当自然语言定位不够精确时，可以退回到 XPath 选择器：

```yaml
- aiTap: ""
  xpath: "//button[@id='submit-btn']"
```

> **建议**: 优先使用自然语言描述，只在自然语言无法准确定位时才使用 `xpath`。自然语言描述的可读性和可维护性远优于 XPath。

### 工具动作

除了交互动作外，还有 3 个工具动作用于流程控制和调试。

#### `sleep` — 等待固定时间

暂停执行指定的毫秒数。适用于需要等待动画、延迟加载等场景。

```yaml
# 等待 2 秒
- sleep: 2000

# 等待动画完成后再操作
- aiTap: "展开详情"
- sleep: 500
- aiAssert: "详情面板已完全展开"
```

> **提示**: 优先使用 `aiWaitFor` 进行条件等待，`sleep` 仅在无法用条件描述时使用。

#### `javascript` — 执行自定义 JavaScript

在浏览器页面上下文中执行任意 JavaScript 代码。可通过 `name` 或 `output` 捕获返回值。

```yaml
# 获取页面标题
- javascript: "return document.title"
  name: "pageTitle"

# 修改页面样式
- javascript: "document.body.style.zoom = '150%'"

# 获取 localStorage 数据
- javascript: "return JSON.parse(localStorage.getItem('userSettings'))"
  name: "settings"

# 使用 page API（Extended 模式）
- javascript: "await page.setViewport({ width: 375, height: 667 })"
```

> **注意**: `javascript` 步骤中的代码在浏览器页面上下文执行。如需捕获返回值，指定 `name`（或 `output`）字段。

#### `recordToReport` — 记录信息到报告

将自定义信息添加到执行报告中，便于追踪流程进度和调试。

```yaml
# 记录里程碑
- recordToReport: "登录流程完成"
  content: "用户 admin 登录成功，耗时约 3 秒"

# 记录数据采集进度
- recordToReport: "第 ${i} 页数据采集"
  content: "本页提取了 ${pageData.length} 条记录"
```

### `cacheable` 选项

在动作级别控制是否缓存 AI 结果（需配合 `agent.cache: true`）。默认所有动作均可缓存，设为 `false` 可对特定步骤禁用缓存。

```yaml
# 此步骤的 AI 结果不缓存（每次都重新调用 AI）
- aiQuery:
    query: "当前实时价格"
    name: "currentPrice"
  cacheable: false
```

### `mode` 选项（aiInput 专用）

控制 `aiInput` 的输入行为。默认会先清除输入框再输入。

```yaml
# 追加输入（不清除已有内容）
- aiInput: "搜索框"
  value: " 追加文本"
  mode: "typeOnly"

# 仅清除输入框
- aiInput: "搜索框"
  value: ""
  mode: "clear"
```

支持的 `mode` 值：

| 值 | 行为 |
|---|---|
| `replace` | 先清除再输入（默认） |
| `clear` | 仅清除输入框内容 |
| `typeOnly` | 直接输入，不清除已有内容 |
| `append` | 在已有内容后追加输入 |

### `images` 选项 — 图片辅助定位

当自然语言描述不足以精确定位元素时，可以提供参考图片辅助 AI 识别。

```yaml
- aiTap: "与参考图片相似的图标按钮"
  images:
    - "./images/target-icon.png"
```

### 完整示例: 多步表单填写

```yaml
# L2-demo.yaml — 填写注册表单
web:
  url: "https://example.com/register"

tasks:
  - name: 填写注册表单
    flow:
      # 第一步：填写基本信息
      - aiInput: "姓名输入框"
        value: "张三"
      - aiInput: "邮箱输入框"
        value: "zhangsan@example.com"
      - aiInput: "密码输入框"
        value: "SecurePass123!"
      - aiInput: "确认密码输入框"
        value: "SecurePass123!"

      # 第二步：选择偏好
      - aiTap: "我同意服务条款 复选框"
      - aiScroll: "注册表单区域"
        direction: "down"
        distance: 600

      # 第三步：提交
      - aiTap: "注册按钮"
      - aiWaitFor: "注册成功提示出现，或跳转到欢迎页面"
      - aiAssert: "页面显示注册成功或欢迎信息"
```

---

## L3: 数据与断言 (Native)

**核心概念**: 用 `aiQuery` 提取数据、`aiAssert` 验证结果、`aiWaitFor` 等待状态。

### `aiQuery` — 提取页面数据

`aiQuery` 让 AI 从页面中提取结构化数据，并可以通过 `name` 存储结果以便后续使用。

```yaml
# 提取单个值
- aiQuery:
    query: "当前页面的标题文字是什么？"
    name: "pageTitle"

# 提取列表数据
- aiQuery:
    query: >
      页面上商品列表中每个商品的名称和价格，
      以数组形式返回，每个元素包含 name 和 price 字段。
    name: "productList"
```

`name` 的作用是将提取的结果保存为一个命名变量，在报告中可以看到该变量的值，在 Extended 模式下还可以在后续步骤中引用。

### 类型化数据提取

除了通用的 `aiQuery`，还有 3 个类型化提取动作，返回指定类型的值：

#### `aiBoolean` — 提取布尔值

判断页面状态，返回 `true` 或 `false`。

```yaml
- aiBoolean: "用户是否已登录（页面显示了用户头像或退出按钮）"
  name: "isLoggedIn"
```

#### `aiNumber` — 提取数值

从页面中提取一个数值。

```yaml
- aiNumber: "购物车中的商品总数量"
  name: "cartCount"

- aiNumber: "商品价格（不含货币符号的数字）"
  name: "productPrice"
```

#### `aiString` — 提取文本

从页面中提取一段文本字符串。

```yaml
- aiString: "页面顶部显示的用户名"
  name: "username"

- aiString: "订单状态文字（如'已发货'、'待支付'等）"
  name: "orderStatus"
```

### `aiLocate` — 定位元素

获取页面元素的位置信息（坐标、尺寸），不执行任何操作。适用于需要根据元素位置做后续计算的场景。

```yaml
- aiLocate: "页面右下角的浮动操作按钮"
  name: "fabPosition"
```

### `aiAssert` — 断言验证

用自然语言描述期望的页面状态，如果实际状态不符则测试失败。

```yaml
# 简写形式
- aiAssert: "页面上显示了欢迎回来的问候语"

# 带自定义错误消息（扁平格式 — 推荐）
- aiAssert: "购物车中的商品数量为 3"
  errorMessage: "购物车数量不正确，期望 3 件商品"

# 嵌套格式（也支持）
- aiAssert:
    assertion: "购物车中的商品数量为 3"
    errorMessage: "购物车数量不正确，期望 3 件商品"
```

断言是测试的核心，它回答一个问题：**当前页面的状态是否符合我的预期？**

### `aiWaitFor` — 等待条件满足

在执行下一步之前，等待某个条件成立。避免因页面加载延迟导致的操作失败。

```yaml
# 简写形式
- aiWaitFor: "页面中出现了搜索结果列表"

# 带超时时间（毫秒）
- aiWaitFor:
    condition: "加载动画消失，数据表格完全显示"
    timeout: 10000
```

默认超时时间为 15000 毫秒（15 秒）。如果页面加载较慢，可以适当增大 `timeout`。

### 组合使用: 提取 + 断言

先提取数据，再基于提取的数据进行验证：

```yaml
tasks:
  - name: 验证商品价格
    flow:
      - aiQuery:
          query: "页面上显示的商品总价是多少？"
          name: "totalPrice"
      - aiAssert: "商品总价大于 0 且格式正确（包含人民币符号）"
```

### `output` 指令 — 导出数据

将提取的数据写入文件，方便后续处理或集成到其他系统：

```yaml
tasks:
  - name: 导出商品数据
    flow:
      - aiQuery:
          query: >
            提取页面上所有商品信息，每个商品包含：
            名称(name)、价格(price)、库存状态(inStock)。
          name: "products"
    output:
      filePath: "./output/products.json"
      dataName: "products"
```

> **变量作用域**: `aiQuery` 的 `name` 变量仅在**当前 task** 内有效。如需跨 task 传递数据，使用 `output` 将数据导出到文件，在后续 task 中读取。

### 完整示例: 提取商品列表并验证

```yaml
# L3-demo.yaml — 提取电商商品数据并验证
web:
  url: "https://example-shop.com/products"

tasks:
  - name: 等待页面就绪
    flow:
      - aiWaitFor:
          condition: "商品列表完全加载，至少显示 1 个商品卡片"
          timeout: 15000

  - name: 提取商品列表
    flow:
      - aiQuery:
          query: >
            提取页面上所有商品的信息，返回数组格式。
            每个商品包含以下字段：
            - name: 商品名称
            - price: 价格（数字）
            - currency: 货币符号
            - rating: 评分（数字，如果有的话）
          name: "productList"

      - aiAssert: "页面上至少显示了 3 个商品"
      - aiAssert: "每个商品都有价格显示"

  - name: 验证排序功能
    flow:
      - aiTap: "价格从低到高 排序选项"
      - aiWaitFor: "商品列表已重新排序"
      - aiQuery:
          query: "排序后第一个商品的价格是多少？"
          name: "lowestPrice"
      - aiQuery:
          query: "排序后最后一个商品的价格是多少？"
          name: "highestPrice"
      - aiAssert: "商品列表确实按价格从低到高排列"

    output:
      filePath: "./output/products.json"
      dataName: "productList"
```

### `continueOnError` — 任务级容错

当一个 task 设置了 `continueOnError: true`，即使该 task 的 flow 中出现异常，后续 task 仍会继续执行。错误信息会通过 `console.warn` 输出。

```yaml
tasks:
  - name: 可能失败的步骤
    continueOnError: true
    flow:
      - aiTap: "可能不存在的按钮"

  - name: 无论上面是否失败都执行
    flow:
      - aiAssert: "页面仍然正常"
```

> 注意：`continueOnError` 是任务级别的选项，不适用于单个步骤。如果需要步骤级容错，请使用 `try` / `catch`。

### `agent` — Agent 配置

`agent` 块配置 Midscene Agent 的行为，包括缓存、报告和分组。所有字段均为可选。

```yaml
agent:
  testId: "regression-001"         # 测试标识符，用于区分不同测试场景
  groupName: "回归测试"              # 测试分组名称
  groupDescription: "每日回归测试套件"  # 分组描述
  cache: true                       # 启用 AI 结果缓存（也支持对象格式）
  generateReport: true              # 自动生成报告
  autoPrintReportMsg: true          # 自动打印报告消息
  reportFileName: "my-report"       # 自定义报告文件名
  replanningCycleLimit: 20          # 重规划循环上限（默认 20，UI-TARS 为 40）
  aiActContext: "电商结算流程"         # AI 操作背景知识，提高理解准确度
  screenshotShrinkFactor: 0.75      # 截图缩放因子（0~1，节省 token）
  waitAfterAction: 500              # 每次操作后等待时间（毫秒，默认 300）
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `testId` | string | 测试标识符，区分不同测试场景的缓存 |
| `groupName` | string | 测试分组名称，报告中用于归类 |
| `groupDescription` | string | 分组的详细描述 |
| `cache` | boolean \| object | 启用 AI 结果缓存，支持 `true` 或对象格式（见下方） |
| `generateReport` | boolean | 是否自动生成执行报告 |
| `autoPrintReportMsg` | boolean | 执行后自动输出报告路径 |
| `reportFileName` | string | 自定义报告文件名（不含扩展名） |
| `replanningCycleLimit` | number | 重规划循环上限，防止无限重试（默认 20） |
| `aiActContext` | string | 提供 AI 操作的业务背景，提高理解准确度 |
| `screenshotShrinkFactor` | number | 截图缩放因子（0~1），缩小截图可节省 token 消耗 |
| `waitAfterAction` | number | 每次操作后等待时间（毫秒），默认 300 |

在转译为 TypeScript 时，`agent` 配置会作为第二个参数传递给 Agent 构造函数：

```typescript
// 有 agent 配置时
const agent = new PuppeteerAgent(page, {"testId":"regression-001","cache":true});

// 无 agent 配置时
const agent = new PuppeteerAgent(page);
```

#### 缓存功能详解

通过 `cache: true` 启用 AI 结果缓存。当相同的 AI 指令在相同的页面上下文中再次执行时，直接复用缓存结果，跳过 AI 调用，显著加速重复运行。

**简写格式**（读写模式）：
```yaml
agent:
  cache: true
  testId: "regression-001"
```

**对象格式**（精确控制）：
```yaml
agent:
  cache:
    strategy: "read-write"    # read-write | read-only | write-only
    id: "my-cache-id"         # 自定义缓存标识符
  testId: "regression-001"
```

| `cache` 字段 | 说明 |
|-------------|------|
| `strategy` | `read-write`（默认）：读取和写入缓存；`read-only`：仅读取已有缓存，不写入新结果；`write-only`：仅写入缓存，不读取 |
| `id` | 自定义缓存 ID，用于区分不同缓存实例 |

**适用场景：**
- 回归测试：同一用例反复执行，第二次起直接走缓存
- 调试开发：反复微调 YAML 步骤，无需每次都等 AI 响应
- CI/CD：缓存可降低 AI API 调用量和运行时间
- `read-only`：生产环境仅使用预热好的缓存，不产生新缓存

**注意事项：**
- 缓存键基于 AI 指令文本和页面上下文，页面内容变化会自动失效
- 首次运行无缓存，需完整调用 AI
- 建议搭配 `testId` 使用，便于区分不同测试场景的缓存

---

## L4: 逻辑控制 — 超集入门 (Extended)

**核心概念**: 当流程需要"判断"和"重复"时，使用 `variables` + `logic` + `loop` 三件套。

> 从本级开始，你需要在文件顶部声明 `engine: extended`。

### `engine: extended` 声明

```yaml
engine: extended

web:
  url: "https://example.com"

# ... 后续内容
```

声明 `engine: extended` 后，YAML 文件会先被转译为 TypeScript 代码，再交由 Playwright 执行。所有 Native 模式的动作（`aiTap`、`aiInput` 等）在 Extended 模式中依然可用。

### `variables` — 变量定义与使用

变量让你的流程更灵活，避免硬编码。

```yaml
engine: extended

variables:
  baseUrl: "https://example.com"
  username: "testuser"
  password: "${ENV:TEST_PASSWORD}"
  maxRetries: 3
  searchKeyword: "Midscene"

web:
  url: "${baseUrl}/login"
```

变量的三种来源：

| 来源 | 语法 | 示例 |
|---|---|---|
| 直接赋值 | `key: "value"` | `username: "admin"` |
| 环境变量 | `${ENV:NAME}` 或 `${ENV.NAME}` | `password: "${ENV:TEST_PASSWORD}"` |
| aiQuery 提取 | 通过 `name` 存储 | `aiQuery: { query: "...", name: "result" }` |

在流程中通过 `${}` 语法引用变量：

```yaml
flow:
  - aiInput: "用户名输入框"
    value: "${username}"
  - aiInput: "密码输入框"
    value: "${password}"
```

#### 变量的两种声明方式

**顶层声明**（推荐）— 在 `variables` 块中统一定义：

```yaml
variables:
  username: "admin"
  retryCount: 3
```

**流程内赋值** — 通过 `aiQuery`/`aiBoolean`/`aiNumber`/`aiString` 的 `name` 字段在执行过程中动态创建变量：

```yaml
flow:
  - aiQuery:
      query: "当前页面上的用户名"
      name: "currentUser"       # 执行后 ${currentUser} 可用

  - aiBoolean: "用户是否已登录"
    name: "isLoggedIn"          # 执行后 ${isLoggedIn} 可用
```

> **差异**: 顶层 `variables` 在转译时静态替换，流程内 `name` 在运行时动态赋值。环境变量 `${ENV:NAME}` 在运行时从系统环境读取。

### `logic` — 条件分支

根据页面状态或变量值决定执行不同的流程分支。

```yaml
- logic:
    if: "页面上显示了登录按钮"
    then:
      - aiTap: "登录按钮"
      - aiInput: "用户名"
        value: "${username}"
      - aiInput: "密码"
        value: "${password}"
      - aiTap: "提交"
    else:
      - aiAssert: "用户已处于登录状态"
```

`if` 条件说明：

- 条件使用**自然语言描述**，由 AI 判断当前页面是否满足。
- AI 会分析页面截图来判断条件是否为真。
- 条件应当清晰、具体，避免歧义。

嵌套条件：

```yaml
- logic:
    if: "页面显示了验证码输入框"
    then:
      - logic:
          if: "验证码是纯数字类型"
          then:
            - ai: "输入验证码"
          else:
            - ai: "提示用户手动输入验证码"
    else:
      - aiTap: "直接进入 按钮"
```

### `loop` — 循环执行

三种循环类型，满足不同的重复执行需求。

#### `repeat` — 固定次数循环

```yaml
- loop:
    type: repeat
    count: 5
    indexVar: "pageIdx"    # 可选，自定义索引变量名（默认 "i"）
    steps:
      - aiTap: "下一页"
      - aiWaitFor: "新的内容加载完成"
      - aiQuery:
          query: "当前页面的商品列表"
          name: "currentPageProducts"
```

`indexVar` 可选，指定循环索引变量名（默认为 `i`），在生成的代码中可用于引用当前迭代次数。

#### `for` — 遍历列表

```yaml
variables:
  cities:
    - "北京"
    - "上海"
    - "广州"
    - "深圳"

tasks:
  - name: 查询各城市天气
    flow:
      - loop:
          type: for
          items: "${cities}"
          itemVar: "city"
          steps:
            - aiInput: "城市搜索框"
              value: "${city}"
            - aiTap: "搜索"
            - aiWaitFor: "天气信息加载完成"
            - aiQuery:
                query: "当前城市的温度是多少？"
                name: "temperature_${city}"
```

#### `while` — 条件循环

```yaml
- loop:
    type: while
    condition: "页面底部显示了'加载更多'按钮"
    maxIterations: 20
    steps:
      - aiTap: "加载更多"
      - aiWaitFor: "新内容加载完成"
```

> **注意**: `while` 循环必须设置 `maxIterations` 防止无限循环。

### 完整示例: 条件登录 + 分页数据采集

```yaml
# L4-demo.yaml — 条件登录后采集分页数据
engine: extended

variables:
  targetUrl: "https://example-dashboard.com"
  username: "${ENV:DASH_USERNAME}"
  password: "${ENV:DASH_PASSWORD}"
  collectedData: []

web:
  url: "${targetUrl}"

tasks:
  - name: 条件登录
    flow:
      - aiWaitFor: "页面加载完成"

      - logic:
          if: "页面显示了登录表单（有用户名和密码输入框）"
          then:
            - aiInput: "用户名输入框"
              value: "${username}"
            - aiInput: "密码输入框"
              value: "${password}"
            - aiTap: "登录按钮"
            - aiWaitFor: "登录成功，进入仪表盘页面"
          else:
            - aiAssert: "已经处于登录状态，能看到仪表盘"

  - name: 进入数据列表
    flow:
      - aiTap: "数据管理 菜单项"
      - aiWaitFor: "数据列表页面加载完成"

  - name: 分页采集数据
    flow:
      - loop:
          type: while
          condition: "页面上有数据表格且显示了数据行"
          maxIterations: 10
          steps:
            - aiQuery:
                query: >
                  提取当前页面数据表格中的所有行，
                  每行包含：编号(id)、名称(name)、状态(status)、
                  创建时间(createdAt)。
                name: "currentPageData"

            - logic:
                if: "页面底部有下一页按钮且未被禁用"
                then:
                  - aiTap: "下一页"
                  - aiWaitFor: "新的数据页面加载完成"
                else:
                  - ai: "所有页面的数据已采集完毕"

  - name: 验证结果
    flow:
      - aiAssert: "数据采集流程已完成，没有遗漏页面"

    output:
      filePath: "./output/dashboard-data.json"
      dataName: "currentPageData"
```

---

## L5: 系统集成 — 超集进阶 (Extended)

**核心概念**: 连接外部世界 — 导入子流程、转换数据、调用 API、处理异常、并行执行。

### `import` — 导入与复用

将常用流程抽取为独立 YAML 文件，在多个场景中复用。

#### 导入子流程

```yaml
engine: extended

import:
  # 导入可复用的登录流程
  - flow: "./common/login-flow.yaml"
    as: loginFlow

  # 导入 JSON 数据作为变量
  - data: "./fixtures/test-users.json"
    as: testUsers

web:
  url: "https://example.com"

tasks:
  - name: 使用导入的登录流程
    flow:
      - use: "${loginFlow}"
        with:
          username: "${testUsers[0].username}"
          password: "${testUsers[0].password}"
```

被导入的子流程文件（`login-flow.yaml`）的结构：

```yaml
# common/login-flow.yaml
params:
  - username
  - password

flow:
  - aiInput: "用户名输入框"
    value: "${username}"
  - aiInput: "密码输入框"
    value: "${password}"
  - aiTap: "登录"
  - aiWaitFor: "登录成功"
```

#### 导入 JSON 数据

```yaml
import:
  - data: "./data/products.json"
    as: products

tasks:
  - name: 遍历商品数据
    flow:
      - loop:
          type: for
          items: "${products}"
          itemVar: "product"
          steps:
            - aiInput: "搜索框"
              value: "${product.name}"
            - aiTap: "搜索"
            - aiWaitFor: "搜索结果加载完成"
```

### `data_transform` — 数据转换

对提取的数据进行过滤、排序、映射等操作，无需编写代码。

```yaml
tasks:
  - name: 提取并处理数据
    flow:
      - aiQuery:
          query: "提取所有商品的名称、价格和评分"
          name: "rawProducts"

      # 过滤：只保留评分 >= 4 的商品
      - data_transform:
          source: "${rawProducts}"
          operation: filter
          condition: "item.rating >= 4"
          name: "highRatedProducts"

      # 排序：按价格从低到高
      - data_transform:
          source: "${highRatedProducts}"
          operation: sort
          by: "price"
          order: "asc"
          name: "sortedProducts"

      # 映射：只保留需要的字段
      - data_transform:
          source: "${sortedProducts}"
          operation: map
          template:
            title: "${item.name}"
            cost: "${item.price}"
          name: "finalProducts"
```

支持的操作（两种格式均可使用）：

| 操作 | 说明 | 关键参数 |
|---|---|---|
| `filter` | 按条件过滤 | `condition` |
| `sort` | 排序 | `by`、`order`（asc/desc） |
| `map` | 映射/变换字段 | `template` |
| `reduce` | 聚合计算 | `reducer`、`initial` |
| `unique` / `distinct` | 去重 | `by`（去重依据的字段） |
| `slice` | 截取子集 | `start`、`end` |
| `flatten` | 展平嵌套数组 | `depth`（展平深度，默认 1） |
| `groupBy` | 按字段分组为对象 | `by` 或 `field`（字段名） |

#### 嵌套格式（链式操作）

当需要对同一数据依次执行多个操作时，可使用嵌套格式：

```yaml
- data_transform:
    input: "${rawData}"
    operations:
      - filter: "price > 10"
      - sort: "price desc"
      - flatten: 1
      - groupBy: "category"
    output: "processedData"
```

### `external_call` — 外部调用

#### HTTP 请求

```yaml
- external_call:
    type: http
    method: POST
    url: "https://api.example.com/reports"
    headers:
      Authorization: "Bearer ${ENV:API_TOKEN}"
      Content-Type: "application/json"
    body:
      title: "自动化测试报告"
      data: "${collectedData}"
      timestamp: "${ENV:CURRENT_TIME}"
    name: "apiResponse"

- logic:
    if: "apiResponse.status == 200"
    then:
      - aiAssert: "API 调用成功"
    else:
      - ai: "记录 API 调用失败信息"
```

#### Shell 命令

```yaml
- external_call:
    type: shell
    command: "node scripts/process-data.js --input ./output/raw.json --output ./output/final.json"
    name: "shellResult"
```

> **安全提示**: 避免在 shell 命令中直接使用 `${...}` 模板变量（如 `command: "rm ${path}"`），这可能导致命令注入。验证器会对此发出警告。详见[附录 E: 安全检测与验证](#附录-e-安全检测与验证)。

### `try` / `catch` / `finally` — 异常处理

确保流程在遇到错误时不会中断，而是优雅地处理异常。

```yaml
tasks:
  - name: 带异常处理的数据采集
    flow:
      - try:
          steps:
            - aiTap: "导出数据 按钮"
            - aiWaitFor:
                condition: "下载提示出现或导出成功消息"
                timeout: 30000

        catch:
          steps:
            - aiKeyboardPress: "Escape"
            - aiTap: "手动导出 备选按钮"
            - aiWaitFor: "导出完成"

        finally:
          steps:
            - aiQuery:
                query: "页面是否显示了任何错误信息？"
                name: "errorCheck"
            - external_call:
                type: http
                method: POST
                url: "https://hooks.example.com/log"
                body:
                  action: "data_export"
                  status: "completed"
                  errors: "${errorCheck}"
```

执行逻辑：

1. **`try`**: 先尝试执行这些步骤。
2. **`catch`**: 如果 `try` 中任何步骤失败，执行 `catch` 中的步骤。可以用 `error:` 或 `as:` 指定错误变量名（默认 `e`）。
3. **`finally`**: 无论成功还是失败，最后都会执行（可选）。

```yaml
# 自定义 catch 错误变量名
catch:
  error: err   # 或 as: err ；默认为 e
  steps:
    - aiTap: "关闭对话框"
```

### `parallel` — 并行执行

同时执行多个独立的任务分支，提高效率。`tasks` 和 `branches` 均可作为数组键名。

```yaml
tasks:
  - name: 并行采集多个页面数据
    flow:
      - parallel:
          tasks:
            - flow:
                - aiQuery:
                    query: "所有商品名称和价格"
                    name: "products"

            - flow:
                - aiQuery:
                    query: "最新 10 条用户评价"
                    name: "reviews"

            - flow:
                - aiQuery:
                    query: "各商品库存数量"
                    name: "inventory"

          waitAll: true
```

`waitAll: true`（或 `merge_results: true`）表示等待所有分支完成后，将各分支返回值作为数组解构赋值。各分支内通过 `name` 声明的变量会被自动提升到外层作用域，后续步骤可直接访问。

### 完整示例: 数据管道与 API 集成

```yaml
# L5-demo.yaml — 完整数据采集、处理与上报管道
engine: extended

variables:
  apiBaseUrl: "${ENV:API_BASE_URL}"
  apiToken: "${ENV:API_TOKEN}"
  targetSite: "https://news.example.com"
  maxPages: 5

import:
  - flow: "./common/login-flow.yaml"
    as: loginFlow
  - data: "./config/categories.json"
    as: categories

web:
  url: "${targetSite}"

tasks:
  # ========== 阶段 1: 登录 ==========
  - name: 登录系统
    flow:
      - try:
          steps:
            - use: "${loginFlow}"
              with:
                username: "${ENV:SITE_USER}"
                password: "${ENV:SITE_PASS}"
        catch:
          steps:
            - aiAssert: "登录失败，流程终止"

  # ========== 阶段 2: 按分类并行采集 ==========
  - name: 并行采集各分类数据
    flow:
      - parallel:
          branches:
            - name: "科技分类"
              steps:
                - aiTap: "科技 分类标签"
                - aiWaitFor: "科技分类文章列表加载完成"
                - loop:
                    type: repeat
                    count: "${maxPages}"
                    steps:
                      - aiQuery:
                          query: >
                            提取当前页面所有文章的标题(title)、
                            摘要(summary)、发布时间(publishedAt)、
                            作者(author)。
                          name: "techArticles"
                      - logic:
                          if: "有下一页按钮可以点击"
                          then:
                            - aiTap: "下一页"
                            - aiWaitFor: "新页面加载完成"

            - name: "财经分类"
              steps:
                - aiTap: "财经 分类标签"
                - aiWaitFor: "财经分类文章列表加载完成"
                - loop:
                    type: repeat
                    count: "${maxPages}"
                    steps:
                      - aiQuery:
                          query: >
                            提取当前页面所有文章的标题(title)、
                            摘要(summary)、发布时间(publishedAt)、
                            作者(author)。
                          name: "financeArticles"
                      - logic:
                          if: "有下一页按钮可以点击"
                          then:
                            - aiTap: "下一页"
                            - aiWaitFor: "新页面加载完成"

          waitAll: true

  # ========== 阶段 3: 数据处理 ==========
  - name: 处理采集数据
    flow:
      # 过滤：只保留最近 7 天的文章
      - data_transform:
          source: "${techArticles}"
          operation: filter
          condition: "item.publishedAt >= '7 days ago'"
          name: "recentTechArticles"

      - data_transform:
          source: "${financeArticles}"
          operation: filter
          condition: "item.publishedAt >= '7 days ago'"
          name: "recentFinanceArticles"

      # 排序：按发布时间倒序
      - data_transform:
          source: "${recentTechArticles}"
          operation: sort
          by: "publishedAt"
          order: "desc"
          name: "sortedTechArticles"

  # ========== 阶段 4: 上报 API ==========
  - name: 上报数据到后端
    flow:
      - try:
          steps:
            - external_call:
                type: http
                method: POST
                url: "${apiBaseUrl}/articles/batch"
                headers:
                  Authorization: "Bearer ${apiToken}"
                  Content-Type: "application/json"
                body:
                  tech: "${sortedTechArticles}"
                  finance: "${recentFinanceArticles}"
                  collectedAt: "${ENV:CURRENT_TIME}"
                name: "uploadResult"

            - logic:
                if: "uploadResult.status == 200"
                then:
                  - aiAssert: "数据上报成功"
                else:
                  - external_call:
                      type: http
                      method: POST
                      url: "${apiBaseUrl}/alerts"
                      headers:
                        Authorization: "Bearer ${apiToken}"
                      body:
                        message: "数据上报失败"
                        error: "${uploadResult}"

        catch:
          steps:
            - external_call:
                type: shell
                command: "echo '数据上报异常，请检查 API 服务' >> ./logs/error.log"

        finally:
          steps:
            - external_call:
                type: shell
                command: "echo '流程执行完毕' >> ./logs/pipeline.log"

    output:
      filePath: "./output/final-report.json"
      dataName: "sortedTechArticles"
```

### Extended 模式常见错误与修复

| 错误现象 | 原因 | 修复方式 |
|---|---|---|
| `Missing engine: extended` | 使用了 `variables`/`logic`/`loop` 但未声明 engine | 文件顶部添加 `engine: extended` |
| `loop must have a "type"` | 循环缺少 `type` 字段 | 添加 `type: for`、`type: repeat` 或 `type: while` |
| `features 数组缺失` | 使用了扩展特性但未在 `features` 中声明 | 添加 `features: [variables, logic, loop]`（按实际使用添加） |
| 变量 `${xxx}` 为 undefined | 变量未在 `variables` 中定义，或 `aiQuery` 的 `name` 拼写不一致 | 检查变量名拼写，确保在引用前已定义 |
| `while` 循环无限执行 | 缺少 `maxIterations` | 添加 `maxIterations: 20`（或合适的上限值） |
| `Circular import detected` | 两个 YAML 文件互相 import | 重构为单向依赖，或将共享逻辑提取到第三个文件 |
| `import path resolves outside project` | import 路径使用了 `../` 穿越项目目录 | 使用项目内的相对路径 |
| Shell 命令注入警告 | `external_call` shell 命令包含 `${...}` 变量 | 改用 `http` 类型调用后端 API，或确保变量来源可控 |
| `catch` / `finally` 不生效 | 错误地将 `catch` 嵌套在 `try.flow` 内部 | `catch` 和 `finally` 是 `try` 的**兄弟键**，与 `try` 同级 |
| `parallel` 分支变量不可见 | 未设置 `waitAll: true` | 添加 `waitAll: true` 等待所有分支完成后变量才可用 |

---

## 性能调优指南

### 无头模式

`headless: true` 不启动浏览器 GUI，运行速度更快，适合 CI/CD 环境。

```yaml
web:
  url: "https://example.com"
  headless: true                  # CI 环境推荐开启
```

### AI 缓存

启用缓存可大幅减少重复执行时的 AI API 调用：

```yaml
agent:
  cache: true
  testId: "regression-001"        # 不同测试场景使用不同 testId
```

高级缓存策略（对象格式）：

```yaml
agent:
  cache:
    strategy: "read-write"        # read-write（默认）| read-only | write-only
    id: "custom-cache-id"         # 自定义缓存 ID
```

| 策略 | 说明 |
|------|------|
| `read-write` | 读取已有缓存，同时写入新结果（默认） |
| `read-only` | 只读取缓存，不写入新结果（验证缓存一致性） |
| `write-only` | 忽略已有缓存，强制重新执行并写入新结果 |

### 超时优化

合理设置 `timeout` 避免不必要的等待：

```yaml
# 快速页面：缩短超时
- aiWaitFor: "按钮出现"
  timeout: 5000

# 慢速页面：适当放宽
- aiWaitFor: "大量数据加载完成"
  timeout: 30000
```

### 网络等待

对于 SPA 应用，`waitForNetworkIdle` 可确保数据加载完成后再操作：

```yaml
web:
  url: "https://spa-app.example.com"
  waitForNetworkIdle: true         # 简单开启

# 或精确控制
web:
  url: "https://spa-app.example.com"
  waitForNetworkIdle:
    timeout: 10000                 # 最多等 10 秒
    continueOnNetworkIdleError: true  # 超时不报错，继续执行
```

### 性能最佳实践

1. **CI 环境**: `headless: true` + `cache: true` + 合理 `timeout`
2. **开发调试**: `headless: false` + `cache: true`（快速迭代）
3. **首次运行**: 不使用缓存，确保 AI 结果正确后再开启
4. **数据提取**: 用具体的 `aiQuery` 描述替代模糊的 `ai` 指令，减少 AI 推理时间
5. **步骤粒度**: 拆分复杂的 `ai` 指令为多个具体动作，提高可靠性和速度

---

## 多平台支持

Midscene 支持 Web、Android、iOS 和 Computer（桌面应用）四种平台。通过不同的顶层配置键切换平台。

### Android 平台

```yaml
android:
  deviceId: "emulator-5554"    # ADB 设备 ID

tasks:
  - name: Android 应用测试
    flow:
      - launch: "com.example.myapp"
      - aiWaitFor: "应用主界面加载完成"
      - aiTap: "设置按钮"
```

#### `runAdbShell` — 执行 ADB Shell 命令

在 Android 设备上执行 ADB shell 命令。可通过 `name` 捕获命令输出。

```yaml
# 获取当前 Activity
- runAdbShell: "dumpsys activity activities | grep mResumedActivity"
  name: "currentActivity"

# 清除应用数据
- runAdbShell: "pm clear com.example.myapp"

# 截取屏幕截图到设备
- runAdbShell: "screencap -p /sdcard/screenshot.png"
```

### iOS 平台

```yaml
ios:
  deviceId: "00001234-ABCDEFGH"  # 设备 UDID
  wdaPort: 8100                   # WebDriverAgent 端口（默认 8100）
  wdaHost: "localhost"            # WebDriverAgent 主机（默认 localhost）

tasks:
  - name: iOS 应用测试
    flow:
      - launch: "com.example.myapp"
      - aiWaitFor: "应用主界面加载完成"
      - aiTap: "登录按钮"
```

#### `runWdaRequest` — 执行 WebDriverAgent 请求

向 iOS 设备的 WebDriverAgent 发送自定义请求，用于执行 WDA 支持的底层操作。

```yaml
# 获取设备信息
- runWdaRequest:
    method: GET
    endpoint: "/status"
  name: "deviceStatus"

# 回到主屏幕
- runWdaRequest:
    method: POST
    endpoint: "/wda/homescreen"
```

### Computer 平台（桌面应用）

```yaml
computer:
  # Computer 平台当前无额外配置项

tasks:
  - name: 桌面应用测试
    flow:
      - launch: "notepad.exe"
      - aiWaitFor: "记事本应用窗口打开"
      - aiInput: "文本编辑区域"
        value: "Hello from Midscene!"
```

### `launch` — 启动应用

`launch` 是一个**流程步骤**（不是平台配置），用于启动移动端或桌面端应用。值为应用的包名或路径。

```yaml
flow:
  - launch: "com.example.myapp"       # Android 包名
  - launch: "com.example.myapp"       # iOS Bundle ID
  - launch: "notepad.exe"             # 桌面应用路径
```

### 移动端快速入门

#### Android 快速入门

**前置条件**: 安装 ADB，设备已连接（`adb devices` 可看到设备）。

```yaml
# android-quickstart.yaml — Android 应用基本操作
android:
  deviceId: "emulator-5554"

tasks:
  - name: 启动并操作应用
    flow:
      - launch: "com.android.settings"
      - aiWaitFor: "设置页面加载完成"
      - aiTap: "显示"
      - aiWaitFor: "显示设置页面出现"
      - aiAssert: "能看到亮度调节或显示相关设置项"

  - name: 使用 ADB 命令
    flow:
      - runAdbShell: "getprop ro.build.version.release"
        name: "androidVersion"
      - recordToReport: "Android 版本"
        content: "设备 Android 版本: ${androidVersion}"
```

#### iOS 快速入门

**前置条件**: 安装 Xcode，WebDriverAgent 已配置并运行。

```yaml
# ios-quickstart.yaml — iOS 应用基本操作
ios:
  deviceId: "00001234-ABCDEFGH"
  wdaPort: 8100

tasks:
  - name: 启动并操作应用
    flow:
      - launch: "com.apple.Preferences"
      - aiWaitFor: "设置页面加载完成"
      - aiTap: "通用"
      - aiWaitFor: "通用设置页面出现"
      - aiAssert: "能看到关于本机或软件更新等选项"

  - name: 获取设备状态
    flow:
      - runWdaRequest:
          method: GET
          endpoint: "/status"
        name: "wdaStatus"
      - recordToReport: "设备状态"
        content: "WDA 状态查询完成"
```

> **提示**: 所有 Native 模式的 AI 动作（`aiTap`、`aiInput`、`aiAssert` 等）在移动端平台上的用法与 Web 完全一致，只是平台配置和启动方式不同。

---

## 附录 A: 关键字速查表

### Native 模式关键字

| 关键字 | 类型 | 说明 |
|---|---|---|
| `web` | 配置 | 定义目标网页地址及浏览器设置 |
| `android` / `ios` / `computer` | 配置 | 其他平台配置 |
| `tasks` | 结构 | 任务列表，每个任务包含 `name` 和 `flow` |
| `flow` | 结构 | 步骤序列，按顺序执行 |
| `agent` | 配置 | Agent 行为配置（`testId`/`groupName`/`cache`/`generateReport` 等） |
| `aiTap` | 动作 | 点击页面元素 |
| `aiHover` | 动作 | 悬停在页面元素上 |
| `aiInput` | 动作 | 在输入框中填写内容（`locator` + `value`） |
| `aiKeyboardPress` | 动作 | 模拟键盘按键（可用 `keyName` 指定按键名） |
| `aiScroll` | 动作 | 滚动页面（扁平格式：`direction`、`distance`、`scrollType`） |
| `ai` / `aiAct` | 动作 | AI 自动规划并执行自然语言描述的操作（`aiAct` 为别名） |
| `aiDoubleClick` | 动作 | 双击页面元素 |
| `aiRightClick` | 动作 | 右键点击页面元素 |
| `aiDragAndDrop` | 动作 | 拖拽元素到目标位置（扁平：`to`；嵌套：`from`/`to`） |
| `aiClearInput` | 动作 | 清空输入框内容 |
| `aiBoolean` | 提取 | 从页面提取布尔值（`name` 存储结果） |
| `aiNumber` | 提取 | 从页面提取数值（`name` 存储结果） |
| `aiString` | 提取 | 从页面提取文本（`name` 存储结果） |
| `aiLocate` | 提取 | 获取元素位置信息（`name` 存储结果） |
| `aiWaitFor` | 等待 | 等待条件满足（可选 `timeout`） |
| `aiAssert` | 断言 | 验证页面状态（可选 `errorMessage`） |
| `aiQuery` | 提取 | 从页面提取数据（可选 `name` 存储结果） |
| `aiAsk` | 提取 | AI 自由问答，返回文本答案（`name` 存储结果） |
| `output` | 导出 | 将数据写入文件（`filePath` + `dataName`） |
| `continueOnError` | 选项 | 任务级容错，失败后继续后续任务 |
| `sleep` | 工具 | 暂停执行指定毫秒数 |
| `javascript` | 工具 | 在页面上下文执行 JavaScript（可选 `name` 捕获返回值） |
| `recordToReport` | 工具 | 记录自定义信息到执行报告（配合 `content`） |
| `launch` | 工具 | 启动移动端或桌面端应用（包名或路径） |
| `runAdbShell` | 平台 | 执行 ADB shell 命令（Android 专用） |
| `runWdaRequest` | 平台 | 发送 WDA 请求（iOS 专用） |
| `deepThink` | 选项 | 启用深度分析，提高复杂元素定位准确率 |
| `cacheable` | 选项 | 控制单个步骤是否使用 AI 缓存 |
| `mode` | 选项 | aiInput 输入模式（`replace`/`clear`/`typeOnly`/`append`） |
| `images` | 选项 | 图片辅助定位，提供参考图片数组 |
| `xpath` | 选项 | 使用 XPath 选择器精确定位元素 |
| `userAgent` | web 配置 | 自定义浏览器 User-Agent |
| `deviceScaleFactor` | web 配置 | 设备像素比 |
| `cookie` | web 配置 | Cookie JSON 文件路径 |
| `acceptInsecureCerts` | web 配置 | 接受不安全的 HTTPS 证书 |
| `waitForNetworkIdle` | web 配置 | 等待网络空闲后继续（支持对象格式） |
| `serve` | web 配置 | 本地静态文件目录，自动启动服务器 |
| `bridgeMode` | web 配置 | 桥接模式，连接已有浏览器实例 |
| `forceSameTabNavigation` | web 配置 | 强制在同一标签页内导航 |
| `distance` | 动作选项 | aiScroll 滚动距离（像素） |

### Extended 超集关键字

| 关键字 | 类型 | 说明 |
|---|---|---|
| `engine` | 声明 | 指定执行模式：`native` 或 `extended` |
| `variables` | 配置 | 定义变量，支持 `${}` 引用和 `${ENV:NAME}` 环境变量 |
| `logic` | 控制 | 条件分支（`if` / `then` / `else`） |
| `loop` | 控制 | 循环（`repeat` / `for` / `while`） |
| `import` | 集成 | 导入子流程（`flow`）或数据文件（`data`） |
| `use` | 集成 | 调用已导入的子流程（配合 `with` 传参） |
| `data_transform` | 数据 | 数据转换操作（`filter`/`sort`/`map`/`reduce`/`unique`/`slice`/`flatten`/`groupBy`） |
| `external_call` | 集成 | 外部调用（`http` 请求或 `shell` 命令） |
| `try` | 异常 | 尝试执行步骤 |
| `catch` | 异常 | 捕获 `try` 中的错误并执行备选步骤（可选 `error:`/`as:` 指定错误变量名） |
| `finally` | 异常 | 无论成功或失败都会执行的收尾步骤 |
| `parallel` | 并发 | 并行执行多个独立分支（`tasks`/`branches` + 可选 `waitAll`/`merge_results`） |

---

## 附录 B: engine 字段说明

### `engine: native`（默认）

```yaml
# 以下两种写法等价：
engine: native
web:
  url: "https://example.com"

# 省略 engine 字段时，默认为 native
web:
  url: "https://example.com"
```

Native 模式下，YAML 文件由 Midscene 引擎直接解析执行。只能使用 Native 关键字（`aiTap`、`aiInput`、`aiQuery` 等），不支持变量、逻辑控制、外部调用等超集功能。

### `engine: extended`（超集）

```yaml
engine: extended

variables:
  key: "value"

web:
  url: "https://example.com"
```

Extended 模式下，YAML 先由转译器（Transpiler）转换为 TypeScript 代码，然后由 Playwright + Midscene SDK 执行。支持所有 Native 关键字，以及变量、逻辑、循环、导入、外部调用等超集功能。

### 自动检测

如果你忘记声明 `engine` 字段，系统会根据文件内容自动检测：

- 如果文件中包含 `variables`、`logic`、`loop`、`import`、`external_call`、`parallel`、`try` 等超集关键字，自动识别为 Extended 模式。
- 否则默认按 Native 模式执行。

> **最佳实践**: 始终显式声明 `engine` 字段，避免自动检测带来的意外行为。

---

## 附录 C: 常见问题 (FAQ)

### Q1: 自然语言描述写多详细才够？

**A**: 遵循"让一个不看屏幕的人也能理解"的原则。例如：

- 不好: `aiTap: "按钮"` — 页面上可能有多个按钮。
- 好: `aiTap: "页面右上角的蓝色登录按钮"` — 位置 + 颜色 + 功能都有描述。
- 更好: `aiTap: "导航栏中文字为'立即登录'的按钮"` — 精确到文字内容。

### Q2: `ai` 和 `aiTap`/`aiInput` 有什么区别？

**A**: `ai` 是"自动驾驶"模式，你给一段自然语言描述，AI 自动拆解为多个步骤并执行。`aiTap`、`aiInput` 等是"手动挡"，你精确控制每一步。

- 用 `ai`: 步骤简单，不需要中间验证时。
- 用具体动作: 需要精确控制、需要在步骤之间插入断言或等待时。

### Q3: Extended 模式比 Native 慢吗？

**A**: Extended 模式多了一步转译过程（YAML → TypeScript），但转译本身只需几百毫秒。实际执行速度取决于页面操作本身，两者差异可以忽略不计。如果你不需要超集功能，使用 Native 模式可以跳过转译步骤。

### Q4: 如何调试 YAML 文件？

**A**: 几种方法：

1. **查看报告**: 每次执行后会生成 HTML 报告，包含每一步的截图和执行结果。
2. **分段执行**: 先只写前几步，确认通过后再逐步添加。
3. **增加 `aiWaitFor`**: 在关键步骤后添加等待，确保页面状态就绪。
4. **使用 `aiAssert`**: 在中间步骤插入断言，验证当前状态是否符合预期。
5. **查看转译结果**: Extended 模式下可以查看生成的 TypeScript 代码来排查问题。

### Q5: 能否在 Native 模式中使用变量？

**A**: 不能。变量（`variables`）、条件（`logic`）、循环（`loop`）等都是 Extended 超集的功能。如果你需要参数化，请切换到 `engine: extended`。

### Q6: `aiQuery` 返回的数据格式是什么？

**A**: `aiQuery` 返回的数据格式由你在 `query` 中的描述决定。AI 会尽量按照你描述的结构返回数据。建议在 `query` 中明确指定字段名和期望的数据类型，例如：

```yaml
- aiQuery:
    query: "返回数组，每个元素包含 name(字符串) 和 price(数字) 两个字段"
    name: "result"
```

### Q7: 并行执行时，各分支能共享数据吗？

**A**: 各 `parallel` 分支在独立的浏览器上下文中运行，执行期间互不影响。所有分支完成后，各自通过 `name` 存储的数据可以在后续步骤中访问。

### Q8: 环境变量如何传入？

**A**: 通过系统环境变量传入，在 YAML 中使用 `${ENV:VARIABLE_NAME}` 引用。例如：

```bash
# 设置环境变量
export API_TOKEN="your-token-here"
export TEST_USER="admin"

# 运行 YAML
node scripts/midscene-run.js my-flow.yaml
```

```yaml
variables:
  token: "${ENV:API_TOKEN}"
  user: "${ENV:TEST_USER}"
```

### Q9: `steps` 和 `flow` 有什么区别？

**A**: 在 `loop`、`try`、`catch`、`finally` 内部，`steps` 和 `flow` 是完全等价的别名，可以互换使用。本手册中统一使用 `steps`，但写成 `flow` 也能正常验证和执行。

```yaml
# 以下两种写法等价：

# 写法 1: 使用 steps
- loop:
    type: repeat
    count: 3
    steps:
      - aiTap: "下一页"

# 写法 2: 使用 flow
- loop:
    type: repeat
    count: 3
    flow:
      - aiTap: "下一页"
```

### Q10: `cache: true` 有什么作用？

**A**: 在 `agent` 配置中设置 `cache: true` 后，Midscene 会缓存 AI 操作的结果。同一 AI 指令在相同页面上下文中再次执行时，直接复用缓存，跳过 AI 调用。适用于回归测试和调试场景，可大幅减少运行时间和 API 调用量。

```yaml
# 简写格式
agent:
  cache: true
  testId: "my-test"

# 对象格式（精确控制策略）
agent:
  cache:
    strategy: "read-only"   # read-write | read-only | write-only
    id: "my-cache-id"
  testId: "my-test"
```

---

## 附录 D: 从 TypeScript 迁移到 YAML

如果你已经在使用 Midscene 的 TypeScript API，以下对照表帮助你快速迁移到 YAML 格式。

### 基础操作对照

**TypeScript**:
```typescript
await ai("点击登录按钮");
await aiTap("搜索框");
await aiInput("用户名输入框", "admin");
await aiAssert("页面显示欢迎信息");
const data = await aiQuery("商品列表");
```

**YAML (Native)**:
```yaml
flow:
  - ai: "点击登录按钮"
  - aiTap: "搜索框"
  - aiInput: "用户名输入框"
    value: "admin"
  - aiAssert: "页面显示欢迎信息"
  - aiQuery:
      query: "商品列表"
      name: "data"
```

### 条件逻辑对照

**TypeScript**:
```typescript
const isLoggedIn = await aiQuery("用户是否已登录？");
if (isLoggedIn) {
  await aiTap("进入仪表盘");
} else {
  await aiInput("用户名", "admin");
  await aiInput("密码", "123456");
  await aiTap("登录");
}
```

**YAML (Extended)**:
```yaml
engine: extended

tasks:
  - name: 条件登录
    flow:
      - logic:
          if: "用户已经处于登录状态"
          then:
            - aiTap: "进入仪表盘"
          else:
            - aiInput: "用户名"
              value: "admin"
            - aiInput: "密码"
              value: "123456"
            - aiTap: "登录"
```

### 循环对照

**TypeScript**:
```typescript
const items = ["苹果", "香蕉", "橙子"];
for (const item of items) {
  await aiInput("搜索框", item);
  await aiTap("搜索");
  await aiWaitFor("搜索结果加载完成");
}
```

**YAML (Extended)**:
```yaml
engine: extended

variables:
  items:
    - "苹果"
    - "香蕉"
    - "橙子"

tasks:
  - name: 遍历搜索
    flow:
      - loop:
          type: for
          items: "${items}"
          itemVar: "item"
          steps:
            - aiInput: "搜索框"
              value: "${item}"
            - aiTap: "搜索"
            - aiWaitFor: "搜索结果加载完成"
```

### 迁移建议

1. **从简单开始**: 先把页面操作部分迁移到 Native YAML，验证通过后再考虑逻辑控制。
2. **一次一个文件**: 不要试图一次性迁移所有 TypeScript 脚本，逐个文件迁移并验证。
3. **利用 `ai` 简化**: TypeScript 中多步操作可以合并为一个 `ai` 指令，让 AI 自动规划。
4. **保留复杂逻辑**: 如果 TypeScript 中有非常复杂的数据处理逻辑，可以将其封装为外部脚本，通过 `external_call` 调用。
5. **逐步增加断言**: 迁移后增加 `aiAssert` 来验证每个关键步骤的结果，确保行为与原 TypeScript 一致。

---

## 附录 E: 安全检测与验证

验证器（`yaml-validator.js`）在验证 YAML 文件时会自动执行多项安全检查，以 warning 或 error 形式报告潜在风险。

### Import 路径穿越检测

当 `import` 路径解析后超出项目目录时，验证器会发出警告：

```yaml
# 触发警告的写法
- import: "../../../etc/passwd.yaml"
  as: dangerousFlow
```

```
[WARN] Import path "../../../etc/passwd.yaml" resolves outside the project directory.
       This may be a security risk.
```

### Shell 命令注入警告

当 `external_call` 的 `shell` 命令中包含 `${...}` 模板变量时，验证器会警告可能存在命令注入风险：

```yaml
# 触发警告的写法
- external_call:
    type: shell
    command: "rm -rf ${userInput}/data"
```

```
[WARN] Shell command contains template variables (rm -rf ${userInput}/data).
       User-controlled input in shell commands may lead to command injection.
```

**安全建议**: 避免在 shell 命令中直接拼接用户输入。如果必须使用变量，确保变量来源可控（如环境变量），或改用 `http` 类型调用后端 API 来处理。

### 循环 Import 检测

验证器会追踪 import 链，检测文件之间的循环依赖：

```yaml
# circular-a.yaml
tasks:
  - name: A
    flow:
      - import: "./circular-b.yaml"

# circular-b.yaml
tasks:
  - name: B
    flow:
      - import: "./circular-a.yaml"   # 形成循环！
```

```
[ERR] Circular import detected: "./circular-a.yaml" creates a cycle.
```

循环 import 会导致验证失败（`valid: false`）。Import 链深度上限为 10 层，超过时会发出警告并停止追踪。

### 深层嵌套保护

`walkFlow()` 递归深度上限为 50 层。超过此限制时会静默停止递归，防止栈溢出。正常的 YAML 文件嵌套深度通常不超过 10 层，触发此限制说明文件结构可能存在问题。

### 未知步骤类型警告

转译器在处理无法识别的步骤时会发出警告（通过 `--dry-run` 可见）：

```yaml
tasks:
  - name: test
    flow:
      - unknownAction: "something"   # 不是已知关键字
```

```
[WARN] Unknown step type with keys: [unknownAction].
       This step will be serialised as a comment.
```

### 改进的错误消息

验证器的错误消息现在包含修复建议：

```
# 缺少平台配置
[ERR] Document must contain at least one platform config key at root level:
      web, android, ios, or computer.
      Example: web:
        url: "https://example.com"

# 缺少 tasks 数组
[ERR] Document must contain a "tasks" array at root level.
      Example: tasks:
        - name: "my task"
          flow:
            - aiTap: "button"

# 循环缺少 type
[ERR] "loop" construct must have a "type".
      Valid types: for (iterate items), while (condition-based), repeat (fixed count).
      Add: type: for
```

---

> **文档结束** — 如有疑问，请参考项目源码中的 `templates/` 目录获取更多示例。
