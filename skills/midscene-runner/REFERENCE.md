# Midscene Runner — Reference

> 按需加载参考。Runner SKILL.md 中通过 `Read` 指令引用本文件。

## 外部项目快速开始

> 当前目录无 `scripts/midscene-run.js` 时，使用外部项目模式。

**零配置执行**（仅需 `.env`）：
```bash
# 1. 创建 .env（见下方环境变量详情）
# 2. 直接执行（npx 自动下载，无需 package.json）
npx @midscene/web <file> --headed
```

**常见错误避免**：
- ❌ `npx midscene` → ✅ `npx @midscene/web`（包名不同）
- ❌ `npm install @midscene/cli` → ✅ 直接用 `npx @midscene/web`（无需安装）
- ❌ 创建 `package.json` → ✅ `npx` 自动处理依赖
- ❌ `$env:PUPPETEER_EXECUTABLE_PATH=...`（临时变量） → ✅ 写入 `.env` 文件

## 环境变量详情

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `MIDSCENE_MODEL_API_KEY` | AI 模型 API Key（必须） | — |
| `MIDSCENE_MODEL_BASE_URL` | 模型 API 地址 | — |
| `MIDSCENE_MODEL_NAME` | 模型名称 | — |
| `MIDSCENE_MODEL_FAMILY` | 模型族（`doubao-seed`/`qwen3.5`/`qwen3-vl`/`gemini`/`glm-v`/`custom` 等） | — |
| `MIDSCENE_RUN_DIR` | 产物目录 | `./midscene_run` |
| `DEBUG` | 日志级别: `midscene:*`(全部) / `midscene:ai:call`(API) / `midscene:ai:profile:stats`(性能) / `midscene:cache:*`(缓存) | — |
| `MIDSCENE_INSIGHT_MODEL_*` / `MIDSCENE_PLANNING_MODEL_*` | 分阶段模型配置 | — |
| `MIDSCENE_MODEL_HTTP_PROXY` | AI API 代理 | — |
| `MIDSCENE_PREFERRED_LANGUAGE` | 响应语言 | — |
| `MIDSCENE_MODEL_REASONING_ENABLED` | 启用推理 | — |
| `MIDSCENE_MODEL_REASONING_BUDGET` | 推理 token 预算 | — |
| `MIDSCENE_MODEL_REASONING_EFFORT` | 推理强度: `low` / `medium` / `high` | — |
| `PUPPETEER_EXECUTABLE_PATH` | Chrome 路径覆盖（**必须写入 `.env`**，不要临时设置） | 自动检测 |
| `CHROME_BIN` / `CHROMIUM_BIN` | Chrome/Chromium 路径覆盖（标准） | 自动检测 |

> GPT-4o 规划能力已废弃。推荐 Doubao Seed 2.0 / Qwen3.5 / Gemini-3-Pro。

### .env 完整模板

```env
# === AI 模型（必须）===
MIDSCENE_MODEL_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
MIDSCENE_MODEL_API_KEY=sk-your-key
MIDSCENE_MODEL_NAME=doubao-seed-2.0

# === Chrome 路径（自动检测失败时取消注释）===
# Windows:
# PUPPETEER_EXECUTABLE_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe
# Mac:
# PUPPETEER_EXECUTABLE_PATH=/Applications/Google Chrome.app/Contents/MacOS/Google Chrome
# Linux:
# PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome
```

## 平台配置最小示例

```yaml
web: { url: "https://example.com" }      # headless: true 用于 CI
android: { deviceId: "emulator-5554" }    # flow 中 launch: "包名"
ios: { wdaPort: 8100 }                    # flow 中 launch: "bundleId"
computer: { launch: "/path/to/app" }      # headless + xvfbResolution 用于 CI
```

动作详情参见 Generator `REFERENCE.md`「Native 动作完整映射」。

## 执行常见陷阱

- **首次慢**: `npx` 首次需下载依赖，先运行 `npm run setup` 预热
- **timeout 包含启动时间**: 浏览器冷启动 10-20s，timeout 最少 60000ms
- **headless 渲染差异**: 调试先用 `headless: false`
- **反爬/验证码**: 用 `userAgent` + `headless: false` + `bridgeMode`
- **移动端键盘遮挡**: iOS `autoDismissKeyboard: true`；Android `keyboardDismissStrategy: "back-first"`

## CI/CD 集成

- **批量**: 串行 `node scripts/midscene-run.js "tests/**/*.yaml"`；并行 `npx @midscene/web "..." --concurrent 4 --continue-on-error`
- **汇总**: `--summary report.json`（JSON 格式，适合 CI 解析）
- **Docker**: `node:22-slim` + `chromium` + `fonts-noto-cjk`；容器内需 `chromeArgs: ['--no-sandbox']` + `headless: true`
- **GitHub Actions**: Ubuntu + Windows, Node 22 + 23, npm cache

## 调试技巧

1. **查看报告截图**: HTML 报告每步有截图，绿 ✓ 通过、红 ✗ 失败
2. **分段执行**: 先写前几步验证通过，再逐步添加
3. **增加等待**: 关键步骤后 `aiWaitFor` 确保页面就绪
4. **deepThink → xpath**: 定位不准时 `deepThink: true`，仍失败用 `xpath`
5. **查看 TS 代码**: Extended 用 `--output-ts` 排查转译问题
6. **DEBUG 环境变量**: `midscene:*`(全部) / `midscene:ai:call`(API) / `midscene:ai:profile:stats`(性能) / `midscene:cache:*`(缓存)
7. **freezePageContext**: 连续 3+ 次 aiQuery 时冻结页面提升性能
8. **缓存策略**: 开发 `read-write`，CI `write-only`

## 安全要点

- 框架使用 `execFileSync`（无 shell）防止命令注入
- 4 层 YAML 验证检测：JS 注入、SSRF、ADB 危险命令、路径遍历、chromeArgs 高危参数
- 临时文件使用 `crypto.randomUUID()` 命名 + `finally` 清理
- `maxAliases: 25` 防 YAML alias 炸弹
- `resolveTemplate` 表达式验证拒绝 `eval`/`require`/`import`/`__proto__`
- 报告截图可能含敏感数据，CI/CD 中标记为私有 artifact
