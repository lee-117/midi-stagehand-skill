# Changelog

版本规则详见 [VERSIONING.md](VERSIONING.md)。

## [0.0.1] — 2026-03-02

初始版本。将所有历史迭代合并为统一的 0.0.1 发布。

### 核心架构

- **双模式执行引擎**：Native（YAML 直接执行）和 Extended（YAML → TypeScript 转译后执行）
- **4 层 YAML 验证**：语法 → 结构 → 模式 → 语义
- **模式检测器**：自动判断 YAML 为 Native 或 Extended 模式
- **10 个代码生成器**：native / variable / logic / loop / import / use / data-transform / try-catch / external-call / parallel
- **报告解析器**：13 类错误分类（含严重性级别），递归子目录读取
- **共享常量模块**（`constants.js`）：集中管理 MAX_FILE_SIZE、DEFAULT_TIMEOUT 等 10 个常量

### 平台支持

- **Web**：完整浏览器自动化，Chrome/Chromium/Edge 自动检测
- **Android**：ADB 设备连接，系统按钮（Back/Home/RecentApps），`scrcpyConfig`、`keyboardDismissStrategy`、`imeStrategy` 高级配置
- **iOS**：WebDriverAgent 集成，系统按钮（Home/AppSwitcher）
- **Computer**：`xvfbResolution`、`headless` 模式支持

### Schema & API

- 完整 Native 关键字定义（`native-keywords.json`）和 Extended 关键字定义（`extended-keywords.json`）
- JSON Schema 验证（`yaml-superset-schema.json`）
- 官方 Midscene API 对齐：`aiAction`、`aiLongPress`、`aiDragAndDrop`、`freezePageContext`/`unfreezePageContext`、`fileChooserAccept`、Swipe 手势、`deepLocate` 等
- `domIncluded` 三值支持：`false` | `true` | `'visible-only'`
- Agent 配置：`modelConfig`、`outputFormat`、`replanningCycleLimit` 等 15 个字段
- Cache 对象格式、bridgeMode 验证
- `variables` schema 支持 `null` 类型

### CLI

- 完整选项：`--dry-run`、`--output-ts`、`--report-dir`、`--template`、`--timeout`、`--retry`、`--clean`、`--verbose`、`--version`、`--help`
- Glob 模式批量执行
- 9 个快速修复提示模式，错误截断（500 字符），错误分类 + 建议默认显示
- 输出路径遍历验证

### 验证器

- 平台配置验证：Web、Android、iOS、Computer 子字段
- Agent 配置验证：15 个已知字段
- 枚举验证：`keyboardDismissStrategy`、`imeStrategy`、`outputFormat`、`cache.strategy`、`bridgeMode`
- 安全检测：路径遍历、Shell 注入、循环导入、深度守卫、文件大小、JS 注入、危险 ADB 命令、SSRF 内网地址、`acceptInsecureCerts` 警告
- 变量收集：支持 AI 动作 name 字段 + javascript 步骤 name/output

### 模板

- 31 个内置模板（19 Native + 12 Extended），覆盖 Web/Android/iOS/Computer 常见场景

### Skills

- **Midscene YAML Generator**：自然语言 → YAML，自动选择模式和平台，基于模板生成
- **Midscene Runner**：环境检查 → 预验证 → 执行 → 结果分析 → 报告解读

### 测试

- 698 个单元测试，覆盖：detector、validator、transpiler、CLI、runner-utils、generator-utils、integration、report-parser、constants、integration-skills、health-check

### 安全

- 全面使用 `execFileSync` 替代 `execSync`，防止命令注入
- 临时文件使用 `crypto.randomUUID()`
- `resolveLocalBin()` 返回 `{ bin, args }` 用于安全执行
