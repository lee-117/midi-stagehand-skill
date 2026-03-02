# 版本规则 (Versioning)

本项目遵循 [语义化版本 (Semantic Versioning 2.0.0)](https://semver.org/lang/zh-CN/) 规范。

当前处于 **pre-1.0 阶段**（API 未稳定），采用 `0.MINOR.PATCH` 模式。

## PATCH（0.0.x → 0.0.x+1）— 默认递增位

每次有变更即递增，包括：

- Bug 修复、事实性错误修正
- 文档更新（SKILL.md / README / guide / CHANGELOG）
- 安全补丁（不影响 schema）
- 测试增加 / 修复
- 模板修复（不含新增模板）
- 小型代码优化 / 重构
- SKILL.md prompt 调优

## MINOR（0.x.0）— 功能性变更

当以下任一条件满足时递增（PATCH 归零）：

- schema 新增关键字 / 动作（如新增 `aiLongPress`）
- 新增模板（如新增 `web-long-press.yaml`）
- 新增 CLI 选项（如新增 `--retry`）
- 新增平台支持 / 平台配置字段
- 新增验证规则 / 错误分类类别
- 重大架构变更（如新增 `constants.js` 模块）

## MAJOR（x.0.0）— 破坏性变更

当以下任一条件满足时递增（MINOR 和 PATCH 归零）：

- YAML 格式不向后兼容（如关键字改名 / 删除）
- CLI 选项删除或语义变更
- 最低 Node.js 版本要求提升
- 删除已有模板或 schema 关键字

## 1.0.0 达成条件

同时满足以下全部条件时升级到 1.0.0：

- 官方 Midscene API 全面覆盖
- Schema 稳定（3 个 MINOR 版本无 schema 变更）
- 两个 Skill 生产就绪
- 测试覆盖率 > 90%
- 通过社区使用反馈验证
