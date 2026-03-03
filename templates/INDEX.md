# Midscene YAML 模板索引 / Template Index

本文档按使用场景对全部 **41 个** Midscene YAML 模板进行分类索引。

- **Native** (25 个): 基础操作模板，YAML 直接执行
- **Extended** (16 个): 复杂逻辑模板（条件、循环、API 调用），先转译为 TypeScript 再执行

---

## 1. 认证场景 / Authentication Scenarios

登录、会话恢复、OAuth 认证、Bridge 模式复用已登录浏览器等。

| Template | Engine | Platform | 说明 |
|----------|--------|----------|------|
| `native/web-login.yaml` | Native | Web | 用户名密码登录流程，断言登录成功 |
| `native/web-cookie-session.yaml` | Native | Web | 从 Cookie JSON 文件恢复登录会话，跳过登录流程 |
| `native/web-bridge-mode.yaml` | Native | Web | Bridge 模式连接已运行的浏览器，复用已登录会话 |
| `extended/web-auth-flow.yaml` | Extended | Web | OAuth 第三方登录流程，使用环境变量传递凭证 |
| `extended/web-conditional-flow.yaml` | Extended | Web | 条件分支判断（已登录/未登录），if/else 流程控制 |
| `extended/reusable-sub-flows.yaml` | Extended | Web | import/use 复用登录子流程，多账号切换测试 |

---

## 2. 数据采集场景 / Data Collection Scenarios

数据提取、分页采集、数据流水线处理、数据驱动测试等。

| Template | Engine | Platform | 说明 |
|----------|--------|----------|------|
| `native/web-data-extract.yaml` | Native | Web | aiQuery 提取结构化数据（商品名称、价格） |
| `native/web-search.yaml` | Native | Web | 搜索引擎关键词搜索，提取搜索结果 |
| `extended/web-pagination-loop.yaml` | Extended | Web | while 循环分页采集，自动翻页提取数据 |
| `extended/web-data-pipeline.yaml` | Extended | Web | data_transform 数据过滤、排序、映射处理 |
| `extended/data-driven-test.yaml` | Extended | Web | 变量数组驱动的参数化批量测试 |
| `extended/e2e-workflow.yaml` | Extended | Web | 端到端工作流：登录 -> 采集 -> 数据处理 -> API 上报 |
| `extended/data-accumulation-loop.yaml` | Extended | Web | 循环累积采集数据，跨页合并结果集 |

---

## 3. 测试验证场景 / Test & Verification Scenarios

断言验证、视觉回归、国际化测试、响应式布局、API 测试等。

| Template | Engine | Platform | 说明 |
|----------|--------|----------|------|
| `native/web-basic.yaml` | Native | Web | 基础网页操作：打开页面、滚动、断言内容 |
| `extended/responsive-test.yaml` | Extended | Web | 多视口响应式布局测试（iPhone SE / iPad / Desktop） |
| `extended/web-i18n-test.yaml` | Extended | Web | 国际化多语言切换验证（中/英/日），CJK 文字输入 |
| `extended/api-crud-test.yaml` | Extended | Web | API CRUD 完整流程：POST/GET/PUT/DELETE |
| `extended/api-integration-test.yaml` | Extended | Web | API 集成测试：HTTP 调用、并行请求、数据验证 |
| `extended/multi-step-with-retry.yaml` | Extended | Web | try/catch 错误处理，失败重试，finally 清理 |
| `extended/web-visual-regression.yaml` | Extended | Web | 视觉回归测试，截图对比检测 UI 变化 |
| `extended/error-recovery-pattern.yaml` | Extended | Web | 错误恢复模式，多层 try/catch 降级策略 |

---

## 4. 移动端场景 / Mobile Scenarios

Android 和 iOS 设备的应用测试、系统按钮操作、高级配置等。

| Template | Engine | Platform | 说明 |
|----------|--------|----------|------|
| `native/android-app.yaml` | Native | Android | Android 应用启动、交互、数据提取 |
| `native/android-system-buttons.yaml` | Native | Android | Android 系统按钮（Back/Home/Recent）+ ADB Shell |
| `native/android-advanced-config.yaml` | Native | Android | scrcpy 配置、输入法策略、CJK 文字输入 |
| `native/ios-app.yaml` | Native | iOS | iOS 应用启动、交互、数据提取 |
| `native/ios-system-buttons.yaml` | Native | iOS | iOS 系统按钮（Home/AppSwitcher）+ WDA 请求 |
| `native/web-long-press.yaml` | Native | Web | 长按操作：自定义时长、上下文菜单触发 |
| `native/mobile-gesture.yaml` | Native | Mobile | 移动端手势操作：滑动、缩放、拖拽 |
| `extended/cross-platform-workflow.yaml` | Extended | Multi | 跨平台工作流：Web + Android + iOS 联合测试 |

---

## 5. CI/CD 场景 / CI/CD Scenarios

无头模式、批量执行、文件上传下载、本地静态服务等。

| Template | Engine | Platform | 说明 |
|----------|--------|----------|------|
| `native/computer-headless.yaml` | Native | Computer | Xvfb 无头模式桌面自动化，适用于 CI 环境 |
| `native/computer-desktop.yaml` | Native | Computer | 桌面应用自动化（计算器操作示例） |
| `native/web-local-serve.yaml` | Native | Web | 内置静态服务器测试本地构建产物（dist/build） |
| `native/web-file-download.yaml` | Native | Web | 文件下载触发、等待完成、验证下载结果 |
| `native/web-file-upload.yaml` | Native | Web | fileChooserAccept 处理文件选择对话框上传 |
| `native/web-multi-tab.yaml` | Native | Web | 多标签页操作：打开、切换、关闭 |
| `native/web-file-chooser.yaml` | Native | Web | 高级文件选择器：多文件、拖拽上传 |

---

## 6. 高级定位场景 / Advanced Locator Scenarios

深度思考定位、图片提示、页面冻结、缓存策略、iframe/Shadow DOM 等。

| Template | Engine | Platform | 说明 |
|----------|--------|----------|------|
| `native/web-deep-think-locator.yaml` | Native | Web | deepThink 复杂元素定位 + xpath 辅助 + aiLocate |
| `native/web-iframe-shadow-dom.yaml` | Native | Web | iframe 嵌套页面和 Shadow DOM 元素操作 |
| `native/web-image-prompt.yaml` | Native | Web | 图片提示辅助定位，视觉参考定位元素 |
| `native/web-freeze-context.yaml` | Native | Web | freezePageContext/unfreezePageContext 冻结恢复页面上下文 |
| `native/web-cache-strategy.yaml` | Native | Web | Agent 缓存策略配置，优化重复执行性能 |

---

## 模板统计 / Template Statistics

| 分类 | Native | Extended | 合计 |
|------|--------|----------|------|
| 认证场景 | 3 | 3 | 6 |
| 数据采集场景 | 2 | 5 | 7 |
| 测试验证场景 | 1 | 7 | 8 |
| 移动端场景 | 7 | 1 | 8 |
| CI/CD 场景 | 7 | 0 | 7 |
| 高级定位场景 | 5 | 0 | 5 |
| **合计** | **25** | **16** | **41** |

> 注：每个模板按主要用途归入一个分类，实际使用中可能跨多个场景。例如 `e2e-workflow.yaml` 同时涉及认证、数据采集和 API 调用，`web-long-press.yaml` 也适用于移动端 Web 触屏场景。
