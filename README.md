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

### 环境初始化（推荐首次运行）

```bash
npm run setup
```

自动完成：智能镜像检测、依赖预热、Chrome 检测，避免首次执行 YAML 时长时间等待下载。

### 国内网络加速（可选）

如果 `npm install` 时 Puppeteer 下载 Chromium 极慢，可在项目 `.npmrc` 中添加镜像配置：

```ini
puppeteer_download_base_url=https://cdn.npmmirror.com/binaries/chrome-for-testing
```

> `npm run setup` 会自动检测国内网络并设置此镜像，无需手动配置。仅当你跳过 setup 直接 `npm install` 时需要手动添加。

### 模型配置

Midscene 执行 AI 操作（`aiTap`、`aiAssert`、`aiQuery` 等）时需要调用视觉语言模型。执行前必须配置模型参数，否则会因模型未配置而失败。

**核心环境变量**：

| 变量 | 说明 | 示例 |
|------|------|------|
| `MIDSCENE_MODEL_BASE_URL` | 模型 API 地址 | `https://dashscope.aliyuncs.com/compatible-mode/v1` |
| `MIDSCENE_MODEL_API_KEY` | 模型 API 密钥 | `sk-xxxxxxxx` |
| `MIDSCENE_MODEL_NAME` | 模型名称 | `qwen-vl-max-latest` |

**方式一：环境变量**

```bash
export MIDSCENE_MODEL_BASE_URL="https://dashscope.aliyuncs.com/compatible-mode/v1"
export MIDSCENE_MODEL_API_KEY="sk-your-key"
export MIDSCENE_MODEL_NAME="qwen-vl-max-latest"
```

**方式二：`.env` 文件**（推荐）

在项目根目录创建 `.env` 文件：

```env
MIDSCENE_MODEL_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
MIDSCENE_MODEL_API_KEY=sk-your-key
MIDSCENE_MODEL_NAME=qwen-vl-max-latest
```

**常见模型配置示例**：

```env
# 通义千问 (Qwen VL)
MIDSCENE_MODEL_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
MIDSCENE_MODEL_NAME=qwen-vl-max-latest

# OpenAI (GPT-4o)
MIDSCENE_MODEL_BASE_URL=https://api.openai.com/v1
MIDSCENE_MODEL_NAME=gpt-4o

# 其他兼容 OpenAI 格式的模型服务同理，修改 BASE_URL 和 MODEL_NAME 即可
```

**高级配置**（可选）：

- `MIDSCENE_MODEL_FAMILY` — 指定模型系列（如 `qwen-vl`），用于优化 prompt 策略
- 多模型分离配置：可分别为规划、操作、查询设置不同模型，详见 [Midscene 模型配置文档](https://midscenejs.com/zh/model-common-config.html)

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
├── skills/                   # AI Agent SKILL 定义
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

## 安装 Skills

通过 [Skills CLI](https://github.com/vercel-labs/skills) 一键安装到你的 AI 编码工具中：

```bash
# 从 GitHub 安装（Trae / Qoder / Cursor / Cline 等）
npx skills add https://github.com/lee-117/midi-stagehand-skill -a trae
npx skills add https://github.com/lee-117/midi-stagehand-skill -a qoder

# 仅安装指定技能
npx skills add https://github.com/lee-117/midi-stagehand-skill --skill midscene-yaml-generator -a trae
npx skills add https://github.com/lee-117/midi-stagehand-skill --skill midscene-runner -a trae
```

从 Gitee 安装（Skills CLI 不支持 Gitee URL，需先 clone 到本地）：

```bash
git clone https://gitee.com/lee-zh/midi-stagehand-skill.git
npx skills add ./midi-stagehand-skill -a trae
npx skills add ./midi-stagehand-skill -a qoder
```

### 更新 Skills

```bash
# 检查是否有可用更新
npx skills check

# 一键更新所有已安装的 Skills
npx skills update
```

### 卸载 Skills

```bash
# 交互式卸载（会提示选择要移除的技能）
npx skills remove

# 卸载指定技能
npx skills remove midscene-yaml-generator
npx skills remove midscene-runner

# 从指定 Agent 中卸载
npx skills remove --agent trae midscene-yaml-generator
npx skills remove --agent qoder midscene-runner

# 卸载所有技能（跳过确认）
npx skills remove --all
```

### 查看已安装的 Skills

```bash
# 列出所有已安装的技能
npx skills list

# 按 Agent 过滤
npx skills list -a trae
```

## AI Skills（辅助工作流）

项目内置两个 AI Skill，支持从自然语言到自动化执行的完整链路（兼容 Trae / Qoder / Cursor / Cline 等 Agent）：

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

当前共 **279** 个测试，覆盖模式检测、验证器、转译器、CLI 和报告解析。

## 文档

- [渐进式指导手册](guide/MIDSCENE_YAML_GUIDE.md) — 从入门到进阶的完整教程（L1-L5）
- [CLAUDE.md](CLAUDE.md) — Claude Code 项目上下文指引
