# Midscene YAML Generator — Reference Tables

> 按需加载参考。Generator SKILL.md 中通过 `Read` 指令引用本文件。

## Native 动作完整映射

| 自然语言模式 | YAML 映射 | 说明 |
|-------------|-----------|------|
| "打开/访问/进入 XXX 网站" | `web: { url: "XXX" }` | 平台配置 |
| "自动规划并执行 XXX" | `ai: "XXX"` | AI 自动拆解为多步骤执行；`aiAct` 为推荐名称（`ai`/`aiAction` 亦有效）；可选 `fileChooserAccept: "path"` 处理文件上传。⚠️ `deepLocate` 为实验性功能，Schema 未正式支持 |
| "点击/按/选择 XXX" | `aiTap: "XXX"` | 通用选项 `deepThink: true\|false`；`xpath`、`cacheable`（默认 true）；支持 `locate` 对象; 支持 `fileChooserAccept: "path"` |
| "悬停/移到 XXX 上" | `aiHover: "XXX"` | 触发下拉菜单或 tooltip（Web only）；支持 `locate` 对象 |
| "在 XXX 输入 YYY" | `aiInput: "XXX"` + `value: "YYY"` | 扁平兄弟格式；`mode: "replace"(默认)\|"clear"\|"typeOnly"`；支持 `locate` 对象；支持 `images` 图片辅助定位 |
| "按键盘 XXX 键" | `aiKeyboardPress: "XXX"` | 支持组合键如 "Control+A"；`keyName` 可作为替代参数；支持 `xpath`、`locate` 对象 |
| "向下/上/左/右滚动" | `aiScroll: "目标区域"` + `direction: "down"` | 可选 `distance`（整数或 null）、`scrollType`；支持 `xpath`、`locate` 对象 |
| "等待 XXX 出现" | `aiWaitFor: "XXX"` | 可选 `timeout`（默认 30000ms）、`checkIntervalMs`（轮询间隔，默认 3000ms）；可选 `domIncluded`/`screenshotIncluded` |
| "检查/验证/确认 XXX" | `aiAssert: "XXX"` | 可选 `errorMessage`、`name`（存储结果变量）；可选 `domIncluded`/`screenshotIncluded` |
| "获取/提取/读取 XXX" | `aiQuery: { query: "XXX", name: "result" }` | name 用于存储结果；可选 `domIncluded`/`screenshotIncluded` 控制 AI 分析范围 |
| "暂停/等待 N 秒" | `sleep: N*1000` | 参数为毫秒 |
| "执行 JS 代码" | `javascript: "代码内容"` | 直接执行 JavaScript；可选 `output`/`name` 存储返回值到变量 |
| "截图记录到报告" | `recordToReport: "标题"` + `content: "描述"` | 截图并记录描述到报告。如需同时验证页面状态，先用 `aiAssert` 再截图 |
| "截图/截屏/保存截图" | `recordToReport: "标题"` | 截图保存到报告；如需验证结果，先用 `aiAssert: "验证条件"` |
| "双击 XXX" | `aiDoubleClick: "XXX"` | 可选 `deepThink: true`；支持 `locate` 对象 |
| "右键点击 XXX" | `aiRightClick: "XXX"` | 右键操作（Web/Computer 平台）；可选 `deepThink: true`；支持 `locate` 对象 |
| "定位 XXX 元素" | `aiLocate: "XXX"` + `name: "elem"` | 定位元素，结果存入变量（Extended 模式可引用） |
| "XXX 是否为真？" | `aiBoolean: "XXX"` + `name: "flag"` | 返回布尔值；`domIncluded`(true/false/"visible-only")；`screenshotIncluded`(true/false)；嵌套对象格式支持 `prompt:` 字段 |
| "获取 XXX 数量" | `aiNumber: "XXX"` + `name: "count"` | 返回数字；同上 `domIncluded`/`screenshotIncluded` 选项；嵌套对象格式支持 `prompt:` 字段 |
| "获取 XXX 文本" | `aiString: "XXX"` + `name: "text"` | 返回字符串；同上选项 |
| "询问 AI XXX" | `aiAsk: "XXX"` + `name: "answer"` | 自由提问，返回文本答案；嵌套对象格式支持 `prompt:` 字段 |
| "拖拽 A 到 B" | `aiDragAndDrop: { from: "A", to: "B" }` | 也支持扁平简写 `aiDragAndDrop: "A"` + `to: "B"`；支持 `locate` 对象 |
| "滑动/划动 XXX" | `ai: "向右滑动 XXX"` | 触摸滑动手势；需先启用 `enableTouchEventsInActionSpace: true` |
| "清空 XXX 输入框" | `aiClearInput: "XXX"` | 清除输入框内容；支持对象格式含 `locate`、`xpath`、`deepThink` |
| "执行 ADB 命令" | `runAdbShell: "命令"` | Android 平台特有 |
| "执行 WDA 请求" | `runWdaRequest: { method: "GET", url: "/session/:id/...", body: {} }` | iOS 平台特有；`method` HTTP 方法、`url` WDA 端点路径、`body` 请求体（可选） |
| "启动应用" | `launch: "包名"` | 移动端启动应用 |
| "长按 XXX" | `aiLongPress: "XXX"` | 可选 `duration`（ms）指定长按时长 |
| "Android 返回" | `AndroidBackButton: true` | Android 系统返回按钮 |
| "Android 主页" | `AndroidHomeButton: true` | Android 系统主页按钮 |
| "Android 最近任务" | `AndroidRecentAppsButton: true` | Android 最近应用按钮 |
| "iOS 主页" | `IOSHomeButton: true` | iOS 系统主页按钮 |
| "iOS 切换应用" | `IOSAppSwitcher: true` | iOS 应用切换器 |
| "冻结页面上下文" | `freezePageContext: true` | 连续数据提取时冻结页面 |
| "解冻页面上下文" | `unfreezePageContext: true` | 恢复页面上下文 |

### 选项支持速查

- `deepThink` (boolean): aiTap, aiHover, aiDoubleClick, aiRightClick, aiScroll, aiDragAndDrop, aiClearInput, aiLongPress, aiLocate
- `deepThink` (boolean | `"unset"`): ai, aiAct, aiAction, aiInput, aiKeyboardPress — `"unset"` 使用默认策略
- `xpath`: aiTap, aiHover, aiDoubleClick, aiRightClick, aiInput, aiKeyboardPress, aiScroll, aiDragAndDrop, aiClearInput, aiLongPress, aiLocate（仅 Web 平台）
- `cacheable`: ai, aiAct, aiAction, aiTap, aiHover, aiDoubleClick, aiRightClick, aiInput, aiScroll, aiDragAndDrop, aiClearInput, aiLongPress, aiLocate, aiAssert, aiWaitFor, aiQuery, aiKeyboardPress
- `locate` 对象: aiTap, aiHover, aiDoubleClick, aiRightClick, aiDragAndDrop, aiLongPress, aiInput, aiKeyboardPress, aiScroll, aiLocate
- `fileChooserAccept`: ai, aiAct, aiAction, aiTap
- `planningStrategy`: ai, aiAct, aiAction — 自定义 AI 规划策略（字符串）

### aiInput mode 参数

- `replace`（默认）— 先清空输入框内容，再输入新值
- `clear` — 仅清空输入框，不输入新值。等效于 `aiClearInput`
- `typeOnly` — 直接在当前光标位置追加输入，不清空已有内容

### aiInput autoDismissKeyboard

`aiInput` 支持动作级 `autoDismissKeyboard: true/false` 覆盖平台配置。用于移动端输入后需保持键盘打开（如连续输入多个字段）或强制关闭键盘的场景。

### API 名称映射

| Midscene API (TypeScript) | YAML 关键字 | 说明 |
|--------------------------|------------|------|
| `evaluateJavaScript()` | `javascript:` | 执行 JavaScript 代码 |
| `cacheId` | `cache: { id: "..." }` | agent 配置中的缓存标识 |

## Extended 控制流映射

| 自然语言模式 | YAML 映射 |
|-------------|-----------|
| "定义变量 XXX 为 YYY" | `variables: { XXX: "YYY" }` |
| "使用环境变量 XXX" | `${ENV:XXX}` 或 `${ENV.XXX}` |
| "如果 XXX 则 YYY 否则 ZZZ" | `logic: { if: "XXX", then: [YYY], else: [ZZZ] }` |
| "重复 N 次" | `loop: { type: repeat, count: N, flow: [...] }` |
| "对每个 XXX 执行" | `loop: { type: for, items: "XXX", itemVar: "item", flow: [...] }` （`itemVar`/`as`/`item` 均可）。支持 `indexVar: "i"` |
| "当 XXX 时持续做 YYY" | `loop: { type: while, condition: "XXX", maxIterations: N, flow: [...] }` |
| "先做 A，失败了就做 B" | `try:` / `flow: [A]` / `catch:` / `flow: [B]`（try 和 catch 是步骤级别的兄弟键） |
| "同时做 A 和 B" | `parallel: { branches: [{flow: [A]}, {flow: [B]}], waitAll: true, merge_results: true }` |
| "调用 XXX 接口" | `external_call: { type: http, method: POST, url: "XXX", response_as: "varName" }` |
| "执行 Shell 命令" | `external_call: { type: shell, command: "XXX" }` |
| "导入/复用 XXX 流程" | `import: [{ flow: "XXX.yaml", as: name }]` |
| "过滤/排序/映射数据" | `data_transform: { source, operation, ... }` |

## 模板决策表（常用）

> 共 41 个模板（Native 25 + Extended 16）。以下为最常用模板，完整列表见 `templates/INDEX.md`。

| 需求特征 | 推荐模板 | 难度 |
|---------|---------|------|
| 简单页面操作 | `native/web-basic.yaml` | Beginner |
| 登录 / 表单填写 | `native/web-login.yaml` | Beginner |
| 数据采集 / 信息提取 | `native/web-data-extract.yaml` | Beginner |
| 搜索 + 结果验证 | `native/web-search.yaml` | Beginner |
| 文件上传 | `native/web-file-upload.yaml` | Intermediate |
| 条件判断 | `extended/web-conditional-flow.yaml` | Intermediate |
| 翻页 / 列表遍历 | `extended/web-pagination-loop.yaml` | Intermediate |
| 失败重试 | `extended/multi-step-with-retry.yaml` | Intermediate |
| 外部 API 调用 | `extended/api-integration-test.yaml` | Intermediate |
| 完整业务流程 | `extended/e2e-workflow.yaml` | Advanced |
| 子流程复用 | `extended/reusable-sub-flows.yaml` | Advanced |
| 复杂元素定位 | `native/web-deep-think-locator.yaml` | Intermediate |
| 免登录 Cookie | `native/web-cookie-session.yaml` | Beginner |
| 数据驱动测试 | `extended/data-driven-test.yaml` | Intermediate |
| 桌面应用自动化 | `native/computer-desktop.yaml` | Intermediate |
| Android 操作 | `native/android-system-buttons.yaml` | Beginner |
| iOS 操作 | `native/ios-system-buttons.yaml` | Beginner |
| 错误恢复模式 | `extended/error-recovery-pattern.yaml` | Advanced |
| 数据累积循环 | `extended/data-accumulation-loop.yaml` | Advanced |

> **不确定时从 `native/web-basic.yaml` 开始**。

## 平台配置详情

### Web 平台额外配置选项

- `headless: true/false` — 是否无头模式运行（默认 false）
- `viewportWidth` / `viewportHeight` — 视口大小（默认 1280×960）
- `userAgent` — 自定义 User-Agent
- `deviceScaleFactor` — 设备像素比（如 Retina 屏设 2；设 0 可自动匹配系统 DPI，修复 Puppeteer 闪烁）
- `waitForNetworkIdle` — 网络空闲等待配置，支持 `true` 或对象格式 `{ timeout: 2000, continueOnNetworkIdleError: true }`
- `waitForNavigationTimeout` — 导航完成等待时间（ms，默认 5000，设 0 禁用）
- `waitForNetworkIdleTimeout` — 网络空闲等待时间（ms，默认 2000，设 0 禁用）
- `cookie` — Cookie JSON 文件路径（实现免登录会话恢复）
- `bridgeMode` — `false`（默认）| `'newTabWithUrl'` | `'currentTab'`
- `chromeArgs` — 自定义 Chrome 启动参数数组
- `serve` — 本地静态文件目录
- `acceptInsecureCerts` — 忽略 HTTPS 证书错误（默认 false）
- `closeNewTabsAfterDisconnect` — 断开时关闭新标签页（默认 false）
- `outputFormat` — `'single-html'` | `'html-and-external-assets'`
- `output` — JSON 输出文件路径
- `forceSameTabNavigation` — 限制导航在当前标签页（默认 true）
- `enableTouchEventsInActionSpace` — 启用触摸事件（默认 false）。仅 Web 需要，移动端默认触摸
- `forceChromeSelectRendering` — 强制 Chrome 渲染 `<select>` 元素
- `unstableLogContent` — 日志持久化（实验性）

### Android 平台配置（仅 Android 需求时参考）

- `deviceId` — ADB 设备 ID（如 `emulator-5554`）
- `androidAdbPath` — 自定义 ADB 路径
- `remoteAdbHost` / `remoteAdbPort` — 远程 ADB
- `screenshotResizeScale` — 截图缩放比例
- `alwaysRefreshScreenInfo` — 每次操作前刷新屏幕信息
- `keyboardDismissStrategy` — `esc-first`（默认） | `back-first`
- `imeStrategy` — `always-yadb` | `yadb-for-non-ascii`（默认）
- `scrcpyConfig` — `{ enabled, maxSize, videoBitRate, idleTimeoutMs }`
- `displayId` — 多显示器选择
- `launch` — `true` | `"com.example.app"`（boolean|string）
- `output` — JSON 输出文件路径

### iOS 平台配置（仅 iOS 需求时参考）

- `wdaPort` — WebDriverAgent 端口（默认 8100）
- `wdaHost` — WebDriverAgent 主机（默认 localhost）
- `autoDismissKeyboard` — 自动关闭键盘（默认 true）
- `launch` — `true` | `"com.example.app"`（boolean|string）
- `output` — JSON 输出文件路径
- `unstableLogContent` — 日志持久化（实验性）

### Computer 平台配置（仅桌面自动化需求时参考）

- `launch` — 启动命令（仅 string 类型，与 Android/iOS 的 boolean|string 不同）
- `output` — JSON 输出文件路径
- `displayId` — 多显示器选择
- `headless` — Linux Xvfb 无头模式（true/false），CI 环境中自动启用虚拟显示器
- `xvfbResolution` — Xvfb 分辨率，格式 `"宽x高x色深"`（如 `"1920x1080x24"`）

### 跨平台差异速查

| 特性 | Web | Android | iOS | Computer |
|------|-----|---------|-----|----------|
| `xpath` | ✅ | ❌ | ❌ | ❌ |
| `aiHover` | ✅ | ❌ | ❌ | ❌ |
| `aiRightClick` | ✅ | ❌ | ❌ | ✅ |
| `enableTouchEventsInActionSpace` | 需显式启用 | 默认触摸 | 默认触摸 | ❌ |
| `forceSameTabNavigation` | ✅ | N/A | N/A | N/A |
| `closeNewTabsAfterDisconnect` | ✅ | N/A | N/A | N/A |
| `deepThink`/`cacheable` | ✅ 全支持 | ✅ 全支持 | ✅ 全支持 | ✅ 全支持 |
| `launch` 类型 | N/A | boolean\|string | boolean\|string | string only |

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

> 平面格式 `{source, operation, name}` 适合单步操作；嵌套格式 `{input, operations:[], output}` 支持链式多步操作。

## AI 指令编写详细指南

### 描述精确性

- **差**: `aiTap: "按钮"` — 页面可能有多个按钮
- **好**: `aiTap: "页面右上角的蓝色登录按钮"` — 位置 + 颜色 + 功能
- **更好**: `aiTap: "导航栏中文字为'立即登录'的按钮"` — 精确到文字内容

### 定位策略优先级

1. **自然语言描述**（首选）：可读性高，适应页面变化
2. **deepThink 模式**（`deepThink: true`）：复杂页面中多个相似元素时启用，AI 进行更深层分析，准确率更高但耗时约 2-3x
3. **图片辅助定位**（image prompting）：通过截图标注辅助 AI 理解（`locate.images`）
4. **xpath 选择器**（最后手段）：仅适用于 Web 平台

```yaml
# 优先使用自然语言
- aiTap: "商品列表中第三行的编辑按钮"

# 复杂场景启用 deepThink
- aiTap: "第三行数据中的编辑图标"
  deepThink: true

# 最后手段使用 xpath（仅 Web）
- aiTap: ""
  xpath: "//table/tbody/tr[3]//button[@class='edit']"
```

### 图片辅助定位（locate 对象）

```yaml
# 使用图片辅助 AI 识别目标元素
- aiTap:
    locate:
      prompt: "与参考图片相似的图标按钮"
      images:
        - name: "target-icon"
          url: "https://example.com/icon.png"
      convertHttpImage2Base64: true

# 简化形式
- aiTap: "与参考图片相似的图标按钮"
  images:
    - "./images/target-icon.png"
```

### aiQuery 结果格式化

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

### aiActContext 最佳实践

```yaml
# 多语言网站
agent:
  aiActContext: "这是一个日语电商网站。'カートに入れる' 表示'加入购物车'。"

# 专业术语
agent:
  aiActContext: "这是一个医疗信息系统。'HIS' 代表 Hospital Information System。"

# 非标准 UI
agent:
  aiActContext: "这个应用使用自定义日期选择器：左侧月份导航，右侧日期网格。"
```

## 安全详细指南

- **`javascript:` 步骤** — 代码在浏览器上下文执行，可访问 DOM/Cookie/localStorage。避免通过 `fetch()`/`XMLHttpRequest`/`sendBeacon` 将数据发送到第三方。避免 `WebSocket`/`postMessage`/`window.open` 等扩展风险
- **`external_call: shell`** — 命令直接在系统 shell 中执行，存在命令注入风险
- **`runAdbShell` / `runWdaRequest`** — 避免破坏性命令（`rm`、`reboot`、`pm uninstall`）
- **`external_call: http`** — 避免请求内网地址（127.0.0.1、10.x、172.16-31.x、192.168.x、[::1]、[::ffff:127.x]、metadata.google.internal）
- **SSRF 防御** — 静态正则无法防御所有绕过（DNS rebinding、短 URL、IP 编码变体）。生产环境需网络隔离
- **`data_transform` 表达式** — 避免在 condition/reducer/template 中使用 `require()`、`eval()`、`fetch()`
- **环境变量 `${ENV:XXX}`** — 值可能在报告截图或日志中暴露，避免引用 SECRET/PASSWORD/TOKEN 到 UI 位置
- **`cookie` 文件安全** — 路径限制在项目内、添加到 `.gitignore`、确保文件权限正确（不要 world-readable）
- **`chromeArgs` 高危参数** — 避免 `--disable-web-security`（禁用同源策略）、`--allow-file-access-from-files`（允许本地文件跨域）、`--remote-debugging-port`（暴露调试端口）
- **`acceptInsecureCerts: true`** — 仅用于本地开发/自签名证书的测试环境
- **CI/CD 密钥管理** — 使用 GitHub Secrets / GitLab CI Variables 注入 API Key

## 性能优化速查

- `freezePageContext`: 连续 3+ 次查询且页面不变时使用
- `cache`: 开发用 `read-write`, CI 用 `false` 或 `write-only`
- `cacheable`（动作级）vs `cache`（agent 级）: 动作级控制单个步骤缓存，agent 级控制全局策略
- `screenshotShrinkFactor`: 1=100%面积, 2=25%面积, 3=11%面积；移动端推荐 2
- `deepThink`: 默认不用 → 定位失败时单步启用 → 仍失败用 xpath；启用约 2-3x 耗时。**注意**: Qwen3.5/Doubao Seed/GLM-V 默认启用 deepThink，Qwen3-VL 默认禁用
- `domIncluded`: `true`=发送完整 DOM（高 token）, `visible-only`=仅可见（最优）, `false`=仅截图
- `waitAfterAction`: 慢速网站调大, 本地应用调小
- `waitForNetworkIdle`: SPA 设 `{ timeout: 0 }` 避免无意义等待
- 模型分离策略: Planning 用小模型降成本, Insight 用高精度 VL 模型（通过 `MIDSCENE_INSIGHT_MODEL_*` / `MIDSCENE_PLANNING_MODEL_*`）
- `--concurrent`: CI 推荐 2-4 并行，每 Chrome 约 300-500MB 内存
- 常见场景预估: 3 步简单测试约 15-30s，5 页循环约 2-5min
