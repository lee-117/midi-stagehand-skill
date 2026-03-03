# Midi Stagehand Skill

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node >= 22](https://img.shields.io/badge/Node-%3E%3D22-green.svg)](https://nodejs.org/)
[![CI](https://github.com/lee-117/midi-stagehand-skill/actions/workflows/ci.yml/badge.svg)](https://github.com/lee-117/midi-stagehand-skill/actions/workflows/ci.yml)
[![AI Agent Skills: 2](https://img.shields.io/badge/AI%20Agent%20Skills-2-purple.svg)](#安装-skills)

> 基于自然语言的 AI 低代码浏览器自动化框架 — 描述需求，生成 YAML，一键执行。

简体中文 | **[English](README.en.md)**

## 这是什么

Midi Stagehand Skill 是一个 **Midscene YAML 超集生态系统**，将自然语言转化为可执行的浏览器自动化脚本。它以 **两个 AI Agent Skills** 的形式提供 — 生成器将需求转换为 YAML，执行器负责验证、运行并输出报告。

支持 **Web**、**Android**、**iOS** 和 **Computer** 四大平台。

## 快速开始

### 前置条件

- **Node.js >= 22** 和 **npm**
- **Chrome** 浏览器（用于 Web 自动化）
- AI 编码工具（见[兼容性表格](#安装-skills)）

### 安装 Skills

```bash
# 安装两个 Skills 到当前项目（以 Qoder 为例）
npx skills add https://gitee.com/lee-zh/midi-stagehand-skill.git -a qoder -y
```

> **可选**：添加 `-g` 参数可将 Skills 安装到全局，所有项目共享。也可使用 GitHub 源：
> ```bash
> npx skills add https://github.com/lee-117/midi-stagehand-skill -a qoder -y
> ```

支持的 AI Agent：

| Agent | 安装参数 |
|-------|---------|
| **Claude Code** | `-a claude-code` |
| **Trae** | `-a trae` |
| **Trae CN** | `-a trae-cn` |
| **Qoder** | `-a qoder` |
| **Cursor** | `-a cursor` |
| **Cline** | `-a cline` |

仅安装单个 Skill：

```bash
npx skills add https://gitee.com/lee-zh/midi-stagehand-skill.git --skill midscene-yaml-generator -a qoder -y
npx skills add https://gitee.com/lee-zh/midi-stagehand-skill.git --skill midscene-runner -a qoder -y
```

验证安装：`npx skills list`

### 30 秒体验

**1. 用自然语言生成 YAML**

在 AI Agent 中直接描述你的自动化需求：

```
你: "帮我写个自动化脚本，打开百度搜索 Midscene，截图保存结果"
```

生成器会输出类似以下的 YAML 到 `./midscene-output/`：

```yaml
web:
  url: "https://www.baidu.com"

tasks:
  - name: "搜索 Midscene"
    flow:
      - aiInput: "搜索框"
        value: "Midscene"
      - aiTap: "百度一下"
      - aiWaitFor: "搜索结果已加载"
      - recordToReport: "搜索结果截图"
```

**2. 执行 YAML**

```
你: "运行 midscene-output/search-baidu.yaml"
```

执行器会验证、运行并解读报告。

**3. 或直接用 CLI**

```bash
node scripts/midscene-run.js templates/native/web-basic.yaml --dry-run   # 仅验证
node scripts/midscene-run.js templates/native/web-search.yaml            # 执行
```

### 更新 / 卸载

```bash
npx skills check          # 检查更新
npx skills update          # 更新所有 Skills
npx skills remove midscene-yaml-generator   # 卸载
npx skills remove midscene-runner
```

## 使用 Skills

### YAML 生成器

当你在 AI Agent 中描述浏览器自动化需求时，生成器会自动触发。

示例触发短语：
- "帮我写一个自动化脚本，测试登录功能"
- "生成一个 YAML，打开淘宝搜索手机并提取价格"
- "写一个自动化流程，循环翻页采集数据"

### YAML 执行器

当你需要运行或验证 YAML 文件时，执行器会自动触发。

示例触发短语：
- "运行 midscene-output/login-test.yaml"
- "用 dry-run 验证一下这个 YAML"
- "执行 templates/native/web-search.yaml 并分析报告"

### 工作流

```
描述需求 → [生成器] 输出 YAML → [执行器 --dry-run] 验证 → [执行器] 运行 → 查看报告
```

## 两种模式

| 维度 | **Native** | **Extended** |
|------|-----------|-------------|
| **适用场景** | 页面操作、数据提取、简单断言 | 条件逻辑、循环、API 调用、错误处理 |
| **执行方式** | `@midscene/web` 直接执行 YAML | 先转译为 TypeScript，再执行 |
| **声明方式** | 默认模式，无需声明 | 需声明 `engine: extended` |
| **学习成本** | 低 — 只需掌握 AI 动作关键字 | 中 — 需了解变量、逻辑、循环等概念 |
| **何时选择** | 大多数 UI 自动化和测试场景 | 需要编程逻辑的复杂工作流 |
| **示例** | 登录、搜索、截图、数据提取 | 分页采集、条件审批、API 集成测试 |

Extended 模式自动识别关键字：`variables`、`logic`、`loop`、`import`、`use`、`data_transform`、`try/catch`、`external_call`、`parallel`。

## 功能特性

- **自然语言驱动** — 描述需求即可生成可执行的 YAML
- **全平台统一** — Web、Android、iOS、Computer 使用同一套 YAML 语法
- **执行前验证** — 多层校验 + 安全检测，在运行前拦截错误
- **丰富模板** — 覆盖登录、搜索、数据采集、API 测试等常见场景
- **智能 AI 操作** — 用自然语言描述即可定位和操作页面元素
- **复杂逻辑支持** — 条件分支、循环、子流程复用、并行执行、错误处理
- **CLI 工具链** — 预验证、重试、批量执行、错误自动分类并给出修复建议

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
| `--template puppeteer\|playwright` | TS 模板引擎（默认 playwright） |
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

内置模板覆盖常见自动化场景：

- **Native**：Web 操作、登录、搜索、数据提取、文件上传/下载、多标签页、移动端（Android / iOS）、Computer 等
- **Extended**：条件流程、分页循环、重试逻辑、子流程复用、API 集成、数据管道、认证流程、端到端工作流等

浏览所有模板：[`templates/`](templates/)

## 常见问题

| 问题 | 解决方案 |
|------|---------|
| API Key 报错 `401 Unauthorized` | 检查 `.env` 中 `MIDSCENE_MODEL_API_KEY` 是否正确，确认模型服务可访问 |
| 找不到 Chrome 浏览器 | 安装 Chrome 或 Chromium，或设置 `MIDSCENE_CHROME_PATH` 环境变量指向浏览器路径 |
| 元素定位超时 `element_not_found` | 增大 `timeout`，使用更精确的自然语言描述，或启用 `deepThink: true` |
| Extended 模式不生效 | 确认 YAML 顶部声明了 `engine: extended` |
| 文件过大执行失败 | YAML 文件有大小限制，拆分为多个小文件或使用 `import` 引用子流程 |

更多问题请参阅 [Guide FAQ](guide/MIDSCENE_YAML_GUIDE.md#附录-d-常见问题-faq)。

## 已知限制

- **仅支持 Chromium 内核浏览器** — Web 自动化依赖 Puppeteer/Playwright，不支持 Firefox 或 Safari
- **需要视觉语言模型** — AI 操作（`aiTap`、`aiQuery` 等）需要配置可访问的视觉模型 API
- **Native 模式无编程逻辑** — 条件判断、循环、变量等需使用 Extended 模式
- **移动端需额外环境** — Android 需要 ADB 和设备/模拟器，iOS 需要 WebDriverAgent
- **跨 task 数据传递有限** — Native 模式下不同 task 之间无法共享变量，需使用 Extended 模式

## 文档

- **[渐进式指导手册 (L1-L5)](guide/MIDSCENE_YAML_GUIDE.md)** — 从入门到进阶的完整教程
- **[Skills CLI](https://github.com/vercel-labs/skills)** — Skills 的安装、更新和管理


## 贡献开发

```bash
npm install              # 安装依赖
npm test                 # 运行测试
npm run test:coverage    # 测试 + 覆盖率报告
```

详细的项目架构、代码约定和测试结构请参阅项目内部文档。

## 许可证

[MIT](LICENSE) - lee-117
