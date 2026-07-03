# ADR-0001: 使用 GitHub-native 工作流

## 状态

Accepted

## 背景

这个仓库用于验证单人开发者如何用免费 GitHub 能力搭建轻量研发闭环。当前不引入 Jira、Confluence、Jenkins 或独立 Gateway 服务。

## 决策

使用以下映射：

| 企业工具 | Demo 替代 |
|---|---|
| Jira | GitHub Issues + GitHub Projects |
| Confluence | repo 内 `docs/` |
| Jenkins | GitHub Actions |
| CR | Pull Request Review + Actions |
| Gateway | Issue / PR 评论、label、环境审批 |

## 后果

优点：

- 配置少。
- 上手快。
- 所有上下文都在 GitHub。
- 适合单人和小团队验证。

限制：

- GitHub Wiki 不作为核心方案文档入口。
- 自动化审批依赖 GitHub 事件模型。
- 复杂权限和跨系统审计需要后续独立 Gateway。
