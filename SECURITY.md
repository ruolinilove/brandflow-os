# 安全策略

## 支持范围

当前安全更新面向最新主分支和最新发布版本。

## 报告漏洞

请通过仓库维护者提供的私密安全联系方式报告漏洞，不要在公开 Issue、讨论区或 Pull Request 中披露可利用细节。

报告应包含：

- 受影响版本或提交
- 复现步骤
- 可能影响
- 建议修复方式

## 密钥处理

- 前端只能使用 Supabase publishable 或 legacy anon key。
- Supabase secret/service-role key 只能存放在可信服务端环境。
- 泄露 secret key 后应立即轮换，并检查 Supabase 审计日志。
- 提交代码前应确认 `.env.local` 未进入版本控制。

## 数据隔离

所有业务表必须启用 Row Level Security，并使用当前认证用户限制查询和修改范围。新增表或存储桶时，需要同时提交对应策略。
