# Midi Stagehand Skill

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node >= 22](https://img.shields.io/badge/Node-%3E%3D22-green.svg)](https://nodejs.org/)
[![Tests: 698](https://img.shields.io/badge/Tests-698-brightgreen.svg)](#开发)
[![Skills: 2](https://img.shields.io/badge/Claude%20Code%20Skills-2-purple.svg)](#安装-skills)

> 基于自然语言的 AI 低代码浏览器自动化框架。
> 两个 Claude Code Skills：**YAML 生成器** + **执行器**。

简体中文 | **[English](README.en.md)**

## 这是什么

Midi Stagehand Skill 是一个 **Midscene YAML 超集生态系统**，将自然语言转化为可执行的浏览器自动化脚本。它以 **两个 Claude Code Skills** 的形式提供 — 生成器将需求转换为 YAML，执行器负责验证、运行并输出报告。

```
自然语言 → YAML (Native / Extended) → 检测 → 执行 → 报告
```

支持 **Web**、**Android**、**iOS** 和 **Computer** 四大平台。

## 安装 Skills

### 前置条件

- **Node.js >= 22** 和 **npm**
- **Chrome** 浏览器（用于 Web 自动化）
- AI 编码工具：**Claude Code**、Trae、Qoder、Cursor、Cline 等

### 从 GitHub 安装（推荐）

```bash
# 全局安装两个 Skills
npx skills add https://github.com/lee-117/midi-stagehand-skill -a claude-code -y -g

# 其他 Agent
npx skills add https://github.com/lee-117/midi-stagehand-skill -a trae -y -g
npx skills add https://github.com/lee-117/midi-stagehand-skill -a qoder -y -g
```

### 仅安装单个 Skill

```bash
npx skills add https://github.com/lee-117/midi-stagehand-skill --skill midscene-yaml-generator -a claude-code -y -g
npx skills add https://github.com/lee-117/midi-stagehand-skill --skill midscene-runner -a claude-code -y -g
```

### 从 Gitee 安装（需先 clone）

```bash
git clone https://gitee.com/lee-zh/midi-stagehand-skill.git
npx skills add ./midi-stagehand-skill -a claude-code -y -g
```

### 更新 / 卸载

```bash
# 检查更新
npx skills check

# 更新所有已安装的 Skills
npx skills update

# 卸载指定 Skill
npx skills remove midscene-yaml-generator
npx skills remove midscene-runner

# 查看已安装的 Skills
npx skills list
```

## 工作原理

### YAML 生成器 — 自然语言转 YAML

当你描述一个浏览器自动化需求时，生成器会：

- 分析需求复杂度，自动选择 **Native** 或 **Extended** 模式
- 确定目标平台（Web / Android / iOS / Computer）
- 基于 31 个内置模板，将自然语言映射为 YAML 动作
- 自动验证并输出到 `./midscene-output/`

### YAML 执行器 — 执行与报告

当你需要运行 YAML 文件时，执行器会：

- 检查运行环境（Node.js、依赖、浏览器）
- 定位并预验证 YAML 文件
- 执行并分析结果
- 解读 Midscene 报告，提供可操作的修复建议

### 端到端工作流

```
你: "帮我写个自动化脚本，打开百度搜索 Midscene"
  ↓ [生成器]
输出: midscene-output/search-baidu.yaml
  ↓ [执行器 --dry-run]
验证: 通过
  ↓ [执行器]
执行: 打开浏览器 → 输入关键词 → 点击搜索
  ↓
报告: midscene-report/ (HTML + JSON)
```

## 两种模式

| 模式 | 适用场景 | 执行方式 |
|------|---------|---------|
| **Native** | 基础操作（点击、输入、查询、断言、滚动） | `@midscene/web` 直接执行 YAML |
| **Extended** | 复杂逻辑（条件、循环、API 调用、错误处理） | 转译为 TypeScript 后执行 |

当 YAML 包含以下关键字时自动识别为 Extended 模式：`variables`、`logic`、`loop`、`import`、`use`、`data_transform`、`try/catch`、`external_call`、`parallel`。

## V3.0 新特性

- **长按操作**: `aiLongPress` 支持 `duration` 参数（毫秒）
- **系统按钮**: Android (`AndroidBackButton`, `AndroidHomeButton`, `AndroidRecentAppsButton`) 和 iOS (`IOSHomeButton`, `IOSAppSwitcher`)
- **Android 高级配置**: `keyboardDismissStrategy` (`esc-first`|`back-first`)、`imeStrategy` (`always-yadb`|`yadb-for-non-ascii`)、`scrcpyConfig` 对象
- **Computer 配置**: `xvfbResolution`（格式 `WIDTHxHEIGHTxDEPTH`）
- **Agent 配置**: `modelConfig` 对象、`outputFormat` (`single-html`|`html-and-external-assets`)
- **CLI 改进**: 失败任务详情和错误分类默认显示（不再需要 `--verbose`）
- **安全性增强**: 全面使用 `execFileSync` 替代 `execSync`，防止命令注入

### V4.0 新特性

- `aiAction` 别名支持（与 `ai`/`aiAct` 等价）
- `imeStrategy` 新增 `yadb-for-non-ascii` 枚举值（官方 API 默认值）
- `computer.headless` 无头模式支持
- `domIncluded: 'visible-only'` 三值选项
- 官方 CLI 完整选项文档（`--share-browser-context`、`--concurrent` 等）
- `MIDSCENE_RUN_DIR`、`DEBUG=midscene:*` 等环境变量文档
- `importDirective` JSON Schema 修复
- `sleep` 支持模板变量
- `--output-ts` 路径验证（需 `.ts` 扩展名）
- `setup.js` 消除代码重复，统一使用 `execFileSync`
- 报告解析器支持递归子目录
- `MAX_WALK_DEPTH` 常量集中管理
- Guide 全文 `steps:` → `flow:` 统一
- 678 个单元测试（+15）

### V5.0 新特性

- 官方 API 全面对齐、SKILL.md 多角色重构、6 个新模板、代码优化（YAML 单次解析、Chrome 缓存）、698 个测试

### V6.0 新特性

- **10 角色深度审查**: Prompt Engineer、Domain Expert、QA、Tech Writer、Security、DevOps/SRE、Schema Analyst、Systems Architect 等 10 个角色联合分析
- **事实性错误修正**: `aiWaitFor` timeout 默认值、`screenshotShrinkFactor` 值域、`runWdaRequest` key 修正
- **API 功能补全**: `fileChooserAccept`、Swipe 手势、`deepLocate`、`data:`/`file:` 导入支持
- **安全加固**: JavaScript 注入检测、危险 ADB 命令检测、SSRF 内网地址检测、`acceptInsecureCerts` 警告、输出路径遍历检查
- **文档结构优化**: 职责范围定义、帮助请求模板、工作流总览图、错误决策树
- **QA 鲁棒性增强**: AI 动作变量收集（`aiBoolean`/`aiNumber`/`aiString`/`aiAsk`/`aiLocate`）、`javascript` 步骤变量识别
- **错误分类扩展**: 新增 `rate_limit`、`browser_crash`、`browser_not_found`、`network_failure`、`disk_full` 5 个分类
- **变量 schema**: 支持 `null` 类型初始值

## 模型配置

Midscene 的 AI 操作需要视觉语言模型支持。执行前请设置以下环境变量：

| 变量 | 说明 | 示例 |
|------|------|------|
| `MIDSCENE_MODEL_BASE_URL` | 模型 API 地址 | `https://api.openai.com/v1` |
| `MIDSCENE_MODEL_API_KEY` | API 密钥 | `sk-xxxxxxxx` |
| `MIDSCENE_MODEL_NAME` | 模型名称 | `gpt-4o` |

在项目根目录创建 `.env` 文件：

```env
MIDSCENE_MODEL_BASE_URL=https://api.openai.com/v1
MIDSCENE_MODEL_API_KEY=sk-your-key
MIDSCENE_MODEL_NAME=gpt-4o
```

支持任何 OpenAI 兼容的视觉模型。更多模型配置（通义千问等）请参阅[渐进式指导手册](guide/MIDSCENE_YAML_GUIDE.md)。

## CLI 参考

```
node scripts/midscene-run.js <yaml文件|glob模式> [选项]
```

| 选项 | 说明 |
|------|------|
| `--dry-run` | 仅验证和转译，不执行 |
| `--output-ts <路径>` | 保存转译后的 TypeScript 文件 |
| `--report-dir <路径>` | 自定义报告输出目录 |
| `--template puppeteer\|playwright` | TS 模板引擎（默认 puppeteer） |
| `--timeout <毫秒>` | 执行超时时间（含浏览器启动，建议最低 60000） |
| `--retry <次数>` | 失败后自动重试（应对 flaky 场景，默认 0） |
| `--clean` | 清理 `.midscene-tmp/` 中超过 24 小时的临时文件 |
| `--verbose`, `-v` | 详细输出（含错误分类、执行耗时） |
| `--version`, `-V` | 显示版本号 |
| `--help`, `-h` | 显示帮助 |

支持 glob 模式批量执行：

```bash
node scripts/midscene-run.js "tests/**/*.yaml"
```

## 模板

内置 31 个模板（19 个 Native + 12 个 Extended），覆盖常见自动化场景：

- **Native**：Web 基础操作、登录、搜索、数据提取、文件上传、多标签页、深度定位、桥接模式、Cookie 会话、本地静态服务、长按操作、Android、Android 系统按钮、iOS、Computer
- **Extended**：条件流程、分页循环、重试逻辑、子流程复用、API 集成、数据管道、认证流程、响应式测试、端到端工作流、数据驱动测试

浏览所有模板：[`templates/`](templates/)

## 文档

- **[渐进式指导手册 (L1-L5)](guide/MIDSCENE_YAML_GUIDE.md)** — 从入门到进阶的完整教程
- **[Skills CLI](https://github.com/vercel-labs/skills)** — Skills 的安装、更新和管理

## 开发

```bash
npm install          # 安装依赖
npm test             # 运行 698 个测试
npm run test:coverage # 测试 + 覆盖率报告
npm run lint         # ESLint 检查
```

```
src/
  detector/       模式检测器（Native vs Extended）
  validator/      4 层 YAML 验证
  transpiler/     YAML → TypeScript 转译器 + 10 个代码生成器
  runner/         Native 执行器 + TS 执行器 + 报告解析器
scripts/          CLI 入口
schema/           关键字 Schema + JSON Schema
templates/        31 个 YAML 模板
skills/           Claude Code Skill 定义
```

## 许可证

[MIT](LICENSE) - lee-117
