# Midscene YAML 超集 — 渐进式指导手册

> **版本**: 1.0
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
- [附录 A: 关键字速查表](#附录-a-关键字速查表)
- [附录 B: engine 字段说明](#附录-b-engine-字段说明)
- [附录 C: 常见问题 (FAQ)](#附录-c-常见问题-faq)
- [附录 D: 从 TypeScript 迁移到 YAML](#附录-d-从-typescript-迁移到-yaml)

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
| **学习成本** | 低 — 只需了解 6 个核心动作 | 中 — 需额外掌握变量、逻辑、集成关键字 |

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
      - aiInput:
          locator: "搜索框"
          value: "Midscene 自动化测试"
      - aiTap: "百度一下"
      - aiWaitFor: "搜索结果已加载"
```

### 运行方式

在终端中执行：

```bash
node scripts/midscene-run.js example.yaml
```

执行完毕后，会自动生成一份 HTML 报告，展示每一步的截图和执行结果。

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
      - aiInput:
          locator: "搜索输入框"
          value: "Midscene AI 自动化"
      - aiTap: "百度一下 按钮"
      - aiWaitFor: "搜索结果页面已加载，能看到搜索结果列表"
      - aiAssert: "页面中包含搜索结果"
```

---

## L2: 精确操控 (Native)

**核心概念**: 6 个即时动作 (`aiTap`、`aiHover`、`aiInput`、`aiKeyboardPress`、`aiScroll`、`ai`) 让你精确控制每一步。

### 即时动作详解

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
- aiInput:
    locator: "用户名输入框"
    value: "testuser@example.com"
```

#### 4. `aiKeyboardPress` — 按下键盘按键

模拟键盘按键操作，支持特殊键（Enter、Tab、Escape 等）和组合键。

```yaml
# 按下 Enter 键
- aiKeyboardPress: "Enter"

# 按下 Escape 关闭弹窗
- aiKeyboardPress: "Escape"

# 组合键
- aiKeyboardPress: "Control+A"
```

#### 5. `aiScroll` — 滚动页面

控制页面或特定元素的滚动方向和距离。

```yaml
# 简写 — 向下滚动
- aiScroll:
    direction: "down"

# 完整形式 — 在指定区域内向右滚动
- aiScroll:
    locator: "商品列表区域"
    direction: "right"
    scrollCount: 3
```

支持的方向：`up`、`down`、`left`、`right`。

#### 6. `ai` — 自动规划执行

将一段自然语言描述交给 AI，让它自动规划并执行多个步骤。适合不需要精确控制每一步的场景。

```yaml
# AI 自动规划并执行
- ai: "在搜索框中输入 hello world，然后点击搜索按钮"
```

> **提示**: `ai` 动作是"高级自动驾驶"，而 `aiTap`、`aiInput` 等是"手动挡"。当你需要确保每一步都精准无误时，使用具体的动作；当步骤比较简单且容错空间大时，可以用 `ai` 简化编写。

### `deepThink` 选项

当页面 UI 复杂、元素难以定位时，开启 `deepThink` 让 AI 进行更深入的分析：

```yaml
- aiTap:
    locator: "第三行数据中的编辑图标"
    deepThink: true
```

`deepThink` 会让 AI 花更多时间分析页面结构，但定位准确率更高。适用于：

- 页面中有多个相似元素（如表格中的多个按钮）。
- 元素没有明显的文字标签（如纯图标按钮）。
- 动态加载的内容区域。

### `xpath` 选项

当自然语言定位不够精确时，可以退回到 XPath 选择器：

```yaml
- aiTap:
    xpath: "//button[@id='submit-btn']"
```

> **建议**: 优先使用自然语言描述，只在自然语言无法准确定位时才使用 `xpath`。自然语言描述的可读性和可维护性远优于 XPath。

### 完整示例: 多步表单填写

```yaml
# L2-demo.yaml — 填写注册表单
web:
  url: "https://example.com/register"

tasks:
  - name: 填写注册表单
    flow:
      # 第一步：填写基本信息
      - aiInput:
          locator: "姓名输入框"
          value: "张三"
      - aiInput:
          locator: "邮箱输入框"
          value: "zhangsan@example.com"
      - aiInput:
          locator: "密码输入框"
          value: "SecurePass123!"
      - aiInput:
          locator: "确认密码输入框"
          value: "SecurePass123!"

      # 第二步：选择偏好
      - aiTap: "我同意服务条款 复选框"
      - aiScroll:
          direction: "down"
          scrollCount: 2

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

### `aiAssert` — 断言验证

用自然语言描述期望的页面状态，如果实际状态不符则测试失败。

```yaml
# 简写形式
- aiAssert: "页面上显示了欢迎回来的问候语"

# 带自定义错误消息
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
| 环境变量 | `${ENV:NAME}` | `password: "${ENV:TEST_PASSWORD}"` |
| aiQuery 提取 | 通过 `name` 存储 | `aiQuery: { query: "...", name: "result" }` |

在流程中通过 `${}` 语法引用变量：

```yaml
flow:
  - aiInput:
      locator: "用户名输入框"
      value: "${username}"
  - aiInput:
      locator: "密码输入框"
      value: "${password}"
```

### `logic` — 条件分支

根据页面状态或变量值决定执行不同的流程分支。

```yaml
- logic:
    if: "页面上显示了登录按钮"
    then:
      - aiTap: "登录按钮"
      - aiInput:
          locator: "用户名"
          value: "${username}"
      - aiInput:
          locator: "密码"
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
    steps:
      - aiTap: "下一页"
      - aiWaitFor: "新的内容加载完成"
      - aiQuery:
          query: "当前页面的商品列表"
          name: "currentPageProducts"
```

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
            - aiInput:
                locator: "城市搜索框"
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
            - aiInput:
                locator: "用户名输入框"
                value: "${username}"
            - aiInput:
                locator: "密码输入框"
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
  - aiInput:
      locator: "用户名输入框"
      value: "${username}"
  - aiInput:
      locator: "密码输入框"
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
            - aiInput:
                locator: "搜索框"
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

支持的操作：

| 操作 | 说明 | 关键参数 |
|---|---|---|
| `filter` | 按条件过滤 | `condition` |
| `sort` | 排序 | `by`、`order`（asc/desc） |
| `map` | 映射/变换字段 | `template` |
| `reduce` | 聚合计算 | `reducer`、`initial` |
| `unique` | 去重 | `by`（去重依据的字段） |
| `slice` | 截取子集 | `start`、`end` |

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
2. **`catch`**: 如果 `try` 中任何步骤失败，执行 `catch` 中的步骤。
3. **`finally`**: 无论成功还是失败，最后都会执行（可选）。

### `parallel` — 并行执行

同时执行多个独立的任务分支，提高效率。

```yaml
tasks:
  - name: 并行采集多个页面数据
    flow:
      - parallel:
          branches:
            - name: "采集商品数据"
              web:
                url: "https://example.com/products"
              steps:
                - aiQuery:
                    query: "所有商品名称和价格"
                    name: "products"

            - name: "采集用户评价"
              web:
                url: "https://example.com/reviews"
              steps:
                - aiQuery:
                    query: "最新 10 条用户评价"
                    name: "reviews"

            - name: "采集库存信息"
              web:
                url: "https://example.com/inventory"
              steps:
                - aiQuery:
                    query: "各商品库存数量"
                    name: "inventory"

          waitAll: true
```

`waitAll: true` 表示等待所有分支都完成后再继续。每个分支在独立的浏览器标签中运行。

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

---

## 附录 A: 关键字速查表

### Native 模式关键字

| 关键字 | 类型 | 说明 |
|---|---|---|
| `web` | 配置 | 定义目标网页地址及浏览器设置 |
| `tasks` | 结构 | 任务列表，每个任务包含 `name` 和 `flow` |
| `flow` | 结构 | 步骤序列，按顺序执行 |
| `aiTap` | 动作 | 点击页面元素 |
| `aiHover` | 动作 | 悬停在页面元素上 |
| `aiInput` | 动作 | 在输入框中填写内容（`locator` + `value`） |
| `aiKeyboardPress` | 动作 | 模拟键盘按键 |
| `aiScroll` | 动作 | 滚动页面（`direction` + 可选 `scrollCount`） |
| `ai` | 动作 | AI 自动规划并执行自然语言描述的操作 |
| `aiWaitFor` | 等待 | 等待条件满足（可选 `timeout`） |
| `aiAssert` | 断言 | 验证页面状态（可选 `errorMessage`） |
| `aiQuery` | 提取 | 从页面提取数据（可选 `name` 存储结果） |
| `output` | 导出 | 将数据写入文件（`filePath` + `dataName`） |
| `deepThink` | 选项 | 启用深度分析，提高复杂元素定位准确率 |
| `xpath` | 选项 | 使用 XPath 选择器精确定位元素 |

### Extended 超集关键字

| 关键字 | 类型 | 说明 |
|---|---|---|
| `engine` | 声明 | 指定执行模式：`native` 或 `extended` |
| `variables` | 配置 | 定义变量，支持 `${}` 引用和 `${ENV:NAME}` 环境变量 |
| `logic` | 控制 | 条件分支（`if` / `then` / `else`） |
| `loop` | 控制 | 循环（`repeat` / `for` / `while`） |
| `import` | 集成 | 导入子流程（`flow`）或数据文件（`data`） |
| `use` | 集成 | 调用已导入的子流程（配合 `with` 传参） |
| `data_transform` | 数据 | 数据转换操作（`filter` / `sort` / `map` / `reduce` / `unique` / `slice`） |
| `external_call` | 集成 | 外部调用（`http` 请求或 `shell` 命令） |
| `try` | 异常 | 尝试执行步骤 |
| `catch` | 异常 | 捕获 `try` 中的错误并执行备选步骤 |
| `finally` | 异常 | 无论成功或失败都会执行的收尾步骤 |
| `parallel` | 并发 | 并行执行多个独立分支（`branches` + 可选 `waitAll`） |

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
  - aiInput:
      locator: "用户名输入框"
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
            - aiInput:
                locator: "用户名"
                value: "admin"
            - aiInput:
                locator: "密码"
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
            - aiInput:
                locator: "搜索框"
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

> **文档结束** — 如有疑问，请参考项目源码中的 `templates/` 目录获取更多示例。
