# Midscene YAML 超集生态系统

**低代码降级架构**：让非技术用户和 AI 在 YAML 层面工作，通过超集定义支持复杂逻辑，在编译阶段自动生成 TypeScript 脚本执行。

## 核心链路

```
自然语言 → YAML(Native/Extended) → [Detector] → [YAML直接执行 | YAML→TS转换→TS执行] → Midscene 报告
```

## 两种模式

| 模式 | 适用场景 | 执行方式 |
|------|---------|---------|
| **Native** | 基础操作（点击、输入、查询、断言） | `npx @midscene/web@1 run` 直接执行 |
| **Extended** | 复杂逻辑（条件、循环、API调用、错误处理） | 转换为 TypeScript → `npx tsx` 执行 |

## 快速开始

### 安装依赖

```bash
npm install
```

### 运行 YAML

```bash
# 运行原生 YAML
node scripts/midscene-run.js templates/native/web-basic.yaml

# 运行扩展 YAML
node scripts/midscene-run.js templates/extended/web-conditional-flow.yaml

# 仅转换不执行（查看生成的 TS）
node scripts/midscene-run.js test.yaml --dry-run --output-ts output.ts
```

### CLI 选项

```
node scripts/midscene-run.js <yaml-file> [options]

Options:
  --platform web|android|ios|computer  强制指定平台（默认自动检测）
  --dry-run                            仅验证和转换，不执行
  --output-ts <path>                   保存转换后的 TS 文件
  --report-dir <path>                  报告输出目录
  --template puppeteer|playwright      TS 模板（默认 puppeteer）
  --help                               显示帮助
```

## 项目结构

```
├── guide/                    # 渐进式指导手册
├── schema/                   # 关键字和验证 Schema
├── src/
│   ├── detector/             # 模式检测器
│   ├── validator/            # YAML 验证器
│   ├── transpiler/           # YAML→TS 转换引擎
│   │   ├── generators/       # 各指令的代码生成器
│   │   └── templates/        # Handlebars 模板
│   └── runner/               # 执行器
├── scripts/                  # CLI 入口
├── skills/                   # Claude Code SKILL 定义
├── templates/                # YAML 模板库
│   ├── native/               # 原生模板 (5个)
│   └── extended/             # 扩展模板 (5个)
└── test/                     # 测试
```

## 超集关键字

| 关键字 | 功能 | 示例 |
|--------|------|------|
| `variables` | 变量声明 | `variables: { url: "..." }` |
| `logic` | 条件分支 | `logic: { if: "...", then: [...] }` |
| `loop` | 循环控制 | `loop: { type: repeat, count: 5 }` |
| `import` | 外部导入 | `import: "./sub-flow.yaml"` |
| `data_transform` | 数据处理 | `data_transform: { input, operations, output }` |
| `try/catch/finally` | 异常处理 | `try: { flow: [...] }` |
| `external_call` | 外部调用 | `external_call: { type: http, url: "..." }` |
| `parallel` | 并行执行 | `parallel: { tasks: [...] }` |

## 运行测试

```bash
npm test
```

## 文档

详细使用指南请参考 [渐进式指导手册](guide/MIDSCENE_YAML_GUIDE.md)。
