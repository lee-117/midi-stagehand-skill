# Midscene YAML Generator

## 触发条件

当用户描述一个浏览器自动化需求（自然语言），需要生成 Midscene YAML 文件时使用。

常见触发短语：
- "生成一个 YAML 来..."
- "帮我写个自动化脚本..."
- "创建 Midscene 测试用例..."
- "我想自动化 XXX 操作..."

## 工作流程

### 第 1 步：分析需求复杂度

根据用户描述判断所需模式：

**选择 Native 模式** — 当需求仅涉及：
- 打开网页 / 启动应用
- 点击、输入、滚动等基础操作
- 数据提取（aiQuery）
- 验证断言（aiAssert）
- 等待条件（aiWaitFor）

**选择 Extended 模式** — 当需求涉及以下任一：
- 条件判断（"如果...则..."）
- 循环操作（"重复"、"遍历"、"翻页"）
- 变量和动态数据
- 外部 API 调用
- 错误处理重试
- 并行任务
- 数据转换处理

### 第 2 步：自然语言 → YAML 转换

使用以下映射规则表：

| 自然语言模式 | YAML 映射 |
|-------------|-----------|
| "打开/访问/进入 XXX 网站" | `web: { url: "XXX" }` |
| "点击/按/选择 XXX" | `aiTap: "XXX"` |
| "在 XXX 输入 YYY" | `aiInput: "XXX"` + `value: "YYY"` |
| "等待 XXX 出现" | `aiWaitFor: "XXX"` |
| "检查/验证/确认 XXX" | `aiAssert: "XXX"` |
| "获取/提取/读取 XXX" | `aiQuery: "XXX"` |
| "向下/上/左/右滚动" | `aiScroll` + 对应 direction |
| "鼠标悬停在 XXX" | `aiHover: "XXX"` |
| "按键盘 XXX" | `aiKeyboardPress: "XXX"` |
| "暂停/等待 N 秒" | `sleep: N*1000` |
| "执行 JS 代码" | `javascript: "code"` |
| "如果 XXX 则 YYY 否则 ZZZ" | `logic: { if: "XXX", then: [YYY], else: [ZZZ] }` |
| "重复 N 次" | `loop: { type: repeat, count: N }` |
| "对每个 XXX 执行" | `loop: { type: for, items: "XXX", as: item }` |
| "当 XXX 时持续做 YYY" | `loop: { type: while, condition: "XXX" }` |
| "先做 A，失败了就做 B" | `try: { flow: [A] }, catch: { flow: [B] }` |
| "同时做 A 和 B" | `parallel: { tasks: [{flow: [A]}, {flow: [B]}] }` |
| "调用 XXX 接口" | `external_call: { type: http, url: "XXX" }` |

### 第 3 步：选择模板起点

参考 `templates/` 目录下的模板文件：

**Native 模板**：
- `templates/native/web-basic.yaml` — 基础网页操作
- `templates/native/web-login.yaml` — 登录流程
- `templates/native/web-data-extract.yaml` — 数据提取
- `templates/native/android-app.yaml` — Android 测试
- `templates/native/ios-app.yaml` — iOS 测试

**Extended 模板**：
- `templates/extended/web-conditional-flow.yaml` — 条件分支
- `templates/extended/web-pagination-loop.yaml` — 分页循环
- `templates/extended/web-data-pipeline.yaml` — 数据流水线
- `templates/extended/multi-step-with-retry.yaml` — 带重试的多步骤
- `templates/extended/api-integration-test.yaml` — API 集成

### 第 4 步：生成并验证

1. 基于模板和转换规则生成 YAML 内容
2. 确保文件头包含正确的 `engine` 字段
3. Extended 模式下声明 `features` 列表
4. 输出文件到 `./midscene-output/` 目录
5. 提示用户可以使用 `node scripts/midscene-run.js <file>` 执行

### 第 5 步：输出格式

```yaml
# 自动生成 by Midscene YAML Generator
# 需求描述: [用户原始需求]
# 生成时间: [timestamp]

engine: native|extended
features: [...]  # 仅 extended

[platform_config]

tasks:
  - name: "[任务名称]"
    flow:
      [生成的步骤]
```

## 注意事项

- AI 指令（aiTap, aiAssert 等）的参数使用自然语言描述，不需要 CSS 选择器
- 中文和英文描述均可，Midscene 的 AI 引擎支持多语言
- `aiQuery` 的结果通过 `name` 字段存储，在后续步骤中用 `${name}` 引用
- `aiWaitFor` 建议设置合理的 `timeout`（毫秒），默认通常为 30 秒
- 循环中设置 `maxIterations` 作为安全上限，防止无限循环
- `${ENV.XXX}` 可引用环境变量，避免在 YAML 中硬编码敏感信息
