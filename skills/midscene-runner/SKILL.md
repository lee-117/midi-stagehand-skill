# Midscene Runner

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

## 工作流程

### 第 0 步：环境检查

首次执行前，确认运行环境就绪：

```bash
# 检查 Node.js 版本（需要 >= 16）
node --version

# 检查依赖是否已安装
test -d node_modules && echo "Dependencies OK" || echo "Run: npm install"

# 检查 CLI 脚本是否存在
test -f scripts/midscene-run.js && echo "CLI OK" || echo "CLI not found"
```

**平台特定前提条件**：

| 平台 | 依赖 |
|------|------|
| Web | Chrome/Chromium 浏览器 |
| Android | ADB 已连接设备（`adb devices` 验证） |
| iOS | WebDriverAgent 已配置 |
| Extended 模式 | `tsx` 运行时（`npx tsx --version`） |

如果缺少依赖，提示用户安装：
```bash
npm install
```

### 第 1 步：定位 YAML 文件

确定要执行的 YAML 文件路径。如果用户没有指定完整路径：
- 检查 `./midscene-output/` 目录下最近生成的文件
- 检查 `./templates/` 目录下的模板文件
- 检查当前目录下的 `.yaml` / `.yml` 文件
- 提示用户提供文件路径

多文件场景：如果用户要求执行多个文件，可逐个执行并汇总结果。

### 第 2 步：预验证

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

**自动修复流程**：如果错误可以自动修复（如缺少 engine 声明），直接修复后重新验证，避免往返确认。

### 第 3 步：执行

运行 YAML 文件：

```bash
node scripts/midscene-run.js <yaml-file> [options]
```

**可用选项**：
- `--platform web|android|ios|computer` — 强制指定平台（默认自动检测）
- `--dry-run` — 仅验证和转换，不实际执行
- `--output-ts <path>` — 保存转换后的 TypeScript 文件（仅 Extended 模式）
- `--report-dir <path>` — 报告输出目录（默认 `./midscene-report`）
- `--template puppeteer|playwright` — 选择 TS 模板（默认 puppeteer）
- `--help` / `-h` — 显示帮助信息

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

#### 失败
分析错误类型并提供修复建议：

| 错误类型 | 典型表现 | 修复建议 |
|---------|---------|---------|
| 超时错误 | `Timeout exceeded` | 增加 `timeout` 值，或检查页面加载速度 |
| 元素未找到 | `Element not found` | 修改 AI 描述更精确，或使用 `deepThink: true` |
| 断言失败 | `Assertion failed` | 检查实际页面状态 vs 预期描述 |
| 网络错误 | `Navigation failed` | 检查 URL 是否可访问 |
| 转换错误 | `Transpiler error` | 检查超集语法是否正确 |
| 权限错误 | `Permission denied` | 检查页面是否需要登录或特殊权限 |
| 脚本错误 | `javascript` 步骤报错 | 检查 JS 代码语法和运行环境 |

**迭代修复流程**：
1. 分析错误原因
2. 修改 YAML 文件
3. 重新执行 `--dry-run` 验证
4. 验证通过后重新执行

### 第 5 步：报告解读

解读 Midscene 生成的报告：

- 报告默认在 `./midscene-report/` 目录
- JSON 报告包含每个步骤的执行状态和截图
- HTML 报告可在浏览器中查看，直观展示每步结果
- `recordToReport` 步骤产生的截图也包含在报告中

报告摘要格式：
```
Total : N
Passed: N
Failed: N
Status: passed|failed
```

## 快速执行命令参考

```bash
# 基本执行
node scripts/midscene-run.js test.yaml

# 仅验证，不执行
node scripts/midscene-run.js test.yaml --dry-run

# 保存生成的 TS（仅 extended 模式）
node scripts/midscene-run.js test.yaml --output-ts ./output.ts

# 使用 Playwright 模板
node scripts/midscene-run.js test.yaml --template playwright

# 指定报告目录
node scripts/midscene-run.js test.yaml --report-dir ./reports

# 强制指定平台
node scripts/midscene-run.js test.yaml --platform web

# 查看帮助
node scripts/midscene-run.js --help
```

## YAML 配置速查

### agent 配置（可选）

```yaml
agent:
  testId: "test-001"
  groupName: "回归测试"
  groupDescription: "每日回归测试套件"
  cache: true
```

### continueOnError（可选）

当一个任务失败后继续执行后续任务：

```yaml
tasks:
  - name: 任务 A
    continueOnError: true
    flow: [...]
  - name: 任务 B（即使 A 失败也会执行）
    flow: [...]
```

### 平台配置选项

```yaml
# Web 平台完整配置
web:
  url: "https://example.com"
  headless: false
  viewportWidth: 1920
  viewportHeight: 1080
  userAgent: "Custom User Agent"
  waitForNetworkIdle: true

# Android 平台
android:
  device: "emulator-5554"
  pkg: "com.example.app"

# iOS 平台
ios:
  device: "iPhone 15"
  bundleId: "com.example.app"
```

## 调试技巧

1. **查看报告截图**: 执行后查看 HTML 报告，每一步都有截图
2. **分段执行**: 先只写前几步验证通过，再逐步添加
3. **增加等待**: 在关键步骤后添加 `aiWaitFor` 确保页面就绪
4. **插入断言**: 在中间步骤插入 `aiAssert` 验证当前状态
5. **查看 TS 代码**: Extended 模式使用 `--output-ts` 查看生成的代码排查问题
6. **使用 deepThink**: 元素定位不准时开启 `deepThink: true`
7. **降级到 xpath**: 自然语言无法定位时使用 `xpath` 精确选择
8. **使用 javascript**: 通过 `javascript` 步骤直接执行 JS 代码调试页面状态
9. **使用 recordToReport**: 在关键节点插入 `recordToReport` 截图记录

## 注意事项

- 执行 Web 平台测试需要安装 Chrome/Chromium 浏览器
- 首次运行可能需要安装依赖：`npm install`
- Android 测试需要 ADB 连接设备，iOS 测试需要 WebDriverAgent
- Extended 模式的 YAML 会先转换为 TypeScript 再执行，需要 tsx 运行时
- 报告中的截图路径为相对路径，在报告目录内查找
- 如果需要生成新的 YAML 文件，可以使用 **Midscene YAML Generator** skill
- 环境变量通过系统环境传入，在 YAML 中用 `${ENV:NAME}` 引用
- `parallel` 分支在独立浏览器上下文中运行，执行期间互不影响
