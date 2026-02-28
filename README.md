# Midi Stagehand Skill

> Midscene YAML 超集生态系统

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
│   ├── native/               # 原生模板 (6个)
│   └── extended/             # 扩展模板 (6个)
└── test/                     # 测试
```

## 超集关键字

| 关键字 | 功能 | 示例 |
|--------|------|------|
| `variables` | 变量声明 | `variables: { url: "..." }` |
| `logic` | 条件分支 | `logic: { if: "...", then: [...] }` |
| `loop` | 循环控制 | `loop: { type: repeat, count: 5 }` |
| `import` | 外部导入 | `import: [{ flow: "./login.yaml", as: loginFlow }]` |
| `use` | 调用子流程 | `use: "${loginFlow}"` + `with: { params }` |
| `data_transform` | 数据处理 | 平面: `{ source, operation, name }` 或嵌套: `{ input, operations, output }` |
| `try/catch/finally` | 异常处理 | `try: { flow: [...] }` |
| `external_call` | 外部调用 | `external_call: { type: http, url: "..." }` |
| `parallel` | 并行执行 | `parallel: { tasks: [...] }` 或 `{ branches: [...] }` |

## Claude Code Skills（AI 辅助工作流）

项目内置两个 Claude Code Skill，支持从自然语言到自动化执行的完整链路：

### YAML Generator — 自然语言 → YAML

当你描述一个浏览器自动化需求时，Generator 会：
1. 分析需求复杂度，选择 Native 或 Extended 模式
2. 确定目标平台（Web/Android/iOS/Computer）
3. 将自然语言映射为 YAML 动作
4. 基于模板生成完整 YAML 文件
5. 自动验证并输出到 `./midscene-output/`

> Skill 定义: `skills/midscene-yaml-generator/SKILL.md`

### YAML Runner — 执行 → 报告

当你需要执行 YAML 文件时，Runner 会：
1. 检查运行环境（Node.js、依赖、浏览器）
2. 定位并预验证 YAML 文件
3. 执行并分析结果
4. 解读 Midscene 报告，提供修复建议

> Skill 定义: `skills/midscene-runner/SKILL.md`

### 端到端工作流

```
用户: "帮我写个自动化脚本，打开百度搜索 Midscene"
  ↓ [Generator]
生成: midscene-output/search-baidu.yaml
  ↓ [Runner --dry-run]
验证: 通过
  ↓ [Runner]
执行: 打开浏览器 → 输入关键词 → 点击搜索
  ↓
报告: midscene-report/ (HTML + JSON)
```

## 运行测试

```bash
npm test
```

当前共 **172** 个测试，覆盖模式检测、验证器、转译器、CLI 和报告解析。

## 文档

- [渐进式指导手册](guide/MIDSCENE_YAML_GUIDE.md) — 从入门到进阶的完整教程（L1-L5）
- [CLAUDE.md](CLAUDE.md) — Claude Code 项目上下文指引
