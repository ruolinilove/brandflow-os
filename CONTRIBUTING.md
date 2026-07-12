# 贡献指南

感谢参与 BrandFlow OS。

## 开始开发

1. Fork 仓库并创建功能分支。
2. 使用 Node.js 20+ 和 pnpm 安装依赖。
3. 从 `.env.example` 创建本地 `.env.local`。
4. 修改代码并运行 `pnpm build`。
5. 提交 Pull Request，说明问题、方案和验证结果。

## 分支与提交

- 功能分支：`feat/short-description`
- 修复分支：`fix/short-description`
- 文档分支：`docs/short-description`
- 提交信息建议使用 `feat:`、`fix:`、`docs:`、`refactor:` 等前缀。

## 代码要求

- 保持 TypeScript 构建通过。
- 遵循现有 React、Tailwind CSS 和 Framer Motion 写法。
- 数据库变更必须新增 Supabase migration，不直接修改已发布迁移。
- 新表必须启用 RLS，并提供最小权限策略。
- 不提交 `.env.local`、secret key、service-role key、个人邮箱或真实客户数据。
- UI 改动需要检查桌面端和 390px 手机端。

## Pull Request

Pull Request 应包含：

- 变更目的
- 用户可见行为
- 数据库或环境变量变化
- 验证命令和结果
- 界面改动截图
