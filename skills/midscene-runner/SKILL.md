# Midscene Runner

## 触发条件

当用户需要执行 Midscene YAML 文件时使用。

常见触发短语：
- "运行这个 YAML"
- "执行 XXX.yaml"
- "测试这个自动化脚本"
- "跑一下这个用例"

## 工作流程

### 第 1 步：定位 YAML 文件

确定要执行的 YAML 文件路径。如果用户没有指定完整路径：
- 检查 `./midscene-output/` 目录下最近生成的文件
- 检查 `./templates/` 目录下的模板文件
- 提示用户提供文件路径

### 第 2 步：预验证

在执行前，调用验证器检查 YAML 文件：

```bash
node scripts/midscene-run.js <yaml-file> --dry-run
```

如果验证失败，分析错误原因并向用户建议修复方案：

| 常见错误 | 原因 | 修复建议 |
|---------|------|---------|
| YAML 语法错误 | 缩进不正确或格式问题 | 检查缩进，使用 2 空格 |
| 缺少平台配置 | 没有 web/android/ios | 添加 `web: { url: "..." }` |
| 缺少 tasks | 没有定义任务 | 添加 tasks 数组和 flow |
| 未声明 engine | 使用超集但未标记 | 添加 `engine: extended` |
| 变量未定义 | 引用了未声明的 ${var} | 在前面添加 variables 步骤 |

### 第 3 步：执行

运行 YAML 文件：

```bash
node scripts/midscene-run.js <yaml-file> [options]
```

**可用选项**：
- `--platform web|android|ios|computer` — 强制指定平台（默认自动检测）
- `--dry-run` — 仅验证和转换，不实际执行
- `--output-ts <path>` — 保存转换后的 TypeScript 文件
- `--report-dir <path>` — 报告输出目录（默认 `./midscene-report`）
- `--template puppeteer|playwright` — 选择 TS 模板（默认 puppeteer）

### 第 4 步：分析结果

执行完成后：

1. **成功**：
   - 汇报执行摘要（通过/失败的任务数）
   - 告知报告文件位置
   - 如果有 aiQuery 结果，展示提取的数据

2. **失败**：
   - 分析错误类型：
     - **超时错误** → 建议增加 timeout 值或检查页面加载
     - **元素未找到** → 建议修改 AI 描述更精确，或使用 deepThink
     - **断言失败** → 展示实际状态 vs 预期状态
     - **网络错误** → 检查 URL 是否可访问
     - **转换错误** → 检查超集语法是否正确
   - 提供修复后的 YAML 建议

### 第 5 步：报告解读

解读 Midscene 生成的报告：
- 报告默认在 `./midscene-report/` 目录
- JSON 报告包含每个步骤的执行状态和截图
- HTML 报告可在浏览器中查看

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
```

## 注意事项

- 执行 web 平台测试需要安装 Chrome/Chromium 浏览器
- 首次运行可能需要安装依赖：`npm install`
- Android 测试需要 ADB 连接设备，iOS 测试需要 WebDriverAgent
- Extended 模式的 YAML 会先转换为 TypeScript 再执行，需要 tsx 运行时
- 报告中的截图路径为相对路径，在报告目录内查找
