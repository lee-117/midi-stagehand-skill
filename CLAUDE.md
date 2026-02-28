# Midi Stagehand Skill — Claude Code 项目指引

## 项目概述

这是一个低代码浏览器自动化框架（Midscene YAML 超集生态系统），核心链路：**自然语言 → YAML → 执行 → 报告**。

支持两种执行模式：
- **Native**：基础操作（点击、输入、断言等），YAML 直接执行
- **Extended**：复杂逻辑（条件、循环、API 调用），先转译为 TypeScript 再执行

## 项目结构

```
src/detector/       → 模式检测器 (mode-detector.js)，判断 YAML 是 native 还是 extended
src/validator/      → 4 层 YAML 验证（语法→结构→模式→语义）
src/transpiler/     → Extended YAML → TypeScript 转译器
  generators/       → 10 个代码生成器 + 共享工具模块
                      (native/variable/logic/loop/import/use/data-transform/try-catch/external-call/parallel + utils)
src/runner/         → 执行器（native-runner + ts-runner + report-parser）
scripts/            → CLI 入口 (midscene-run.js)
schema/             → 关键字 Schema 定义（native-keywords.json + extended-keywords.json）
templates/          → 12 个 YAML 模板（native 6 个 + extended 6 个）
skills/             → Claude Code Skill 定义（见下方）
guide/              → 渐进式指导手册（L1-L5）
test/               → 172 个单元测试（detector + validator + transpiler + CLI + report-parser）
```

## Skills（技能）

项目包含两个互补的 Claude Code Skill：

### 1. Midscene YAML Generator (`skills/midscene-yaml-generator/`)
- **触发**: 用户描述浏览器自动化需求时
- **功能**: 将自然语言需求转换为 Midscene YAML 文件
- **流程**: 分析需求复杂度 → 确定平台 → 转换为 YAML → 选择模板 → 生成并验证

### 2. Midscene Runner (`skills/midscene-runner/`)
- **触发**: 用户需要执行 YAML 文件时
- **功能**: 验证、执行 YAML 文件并解读报告
- **流程**: 环境检查 → 定位文件 → 预验证 → 执行 → 分析结果 → 报告解读

### 典型工作流

```
用户需求 → [Generator] 生成 YAML → [Runner] --dry-run 验证 → [Runner] 执行 → 查看报告
```

## 常用命令

```bash
# 安装依赖
npm install

# 运行 YAML
node scripts/midscene-run.js <yaml-file>

# 仅验证不执行
node scripts/midscene-run.js <yaml-file> --dry-run

# 保存转译的 TS
node scripts/midscene-run.js <yaml-file> --output-ts output.ts

# 运行测试
npm test
```

## 关键技术约定

- YAML 缩进统一使用 **2 个空格**
- Extended 模式必须显式声明 `engine: extended`
- 变量引用语法: `${varName}`，环境变量: `${ENV:NAME}` 或 `${ENV.NAME}`
- `use` 步骤调用导入的子流程: `use: "${flowRef}"` + `with: { params }`
- `parallel` 支持 `tasks` 和 `branches` 两种别名
- `data_transform` 支持平面格式 (source/operation/name) 和嵌套格式 (input/operations/output)
- 顶层 `variables` 和 `import` 块在 tasks 之前声明
- 循环支持 `itemVar`/`as`/`item` 别名和 `indexVar` 自定义索引变量
- 生成的 YAML 输出到 `./midscene-output/` 目录
- 执行报告输出到 `./midscene-report/` 目录
- AI 指令使用自然语言描述，优先于 CSS 选择器或 XPath

## 关键文件

| 文件 | 用途 |
|------|------|
| `scripts/midscene-run.js` | CLI 主入口 |
| `src/detector/mode-detector.js` | 模式检测 |
| `src/validator/yaml-validator.js` | 验证逻辑 |
| `src/transpiler/transpiler.js` | 转译核心 |
| `src/transpiler/generators/utils.js` | 生成器共享工具（resolveTemplate, toCodeString 等） |
| `schema/native-keywords.json` | Native 关键字定义 |
| `schema/extended-keywords.json` | Extended 关键字定义 |
| `schema/yaml-superset-schema.json` | 完整 JSON Schema |
| `guide/MIDSCENE_YAML_GUIDE.md` | 用户指导手册 |
