# BrandFlow OS

BrandFlow OS 是面向装修品牌内容运营者的开源个人数据中心，把品牌指标、工作计划、项目、内容、素材、灵感与个人休闲空间集中到一个后台中。

![BrandFlow OS Dashboard](docs/images/dashboard.png)

## 功能

- 双品牌周、月、年播放趋势与累计数据看板
- 播放量和转发量录入、更新、删除确认及云端持久化
- 月度计划、周计划和视频主题管理
- 品牌项目、内容生产、素材文件和灵感管理
- Supabase 邮箱认证、Row Level Security 和私有 Storage
- 可交互农场、牧场和海洋馆，支持种植、养殖、产物收取与生物图鉴
- 高德地图附近美食搜索，支持评分、距离、品类筛选和导航
- 响应式浅色 SaaS 界面与 Framer Motion 动效

## 技术栈

- React 19 + TypeScript
- Vite 8
- Tailwind CSS 4
- Framer Motion
- Recharts
- Supabase Auth、Postgres 和 Storage

## 本地运行

### 环境要求

- Node.js 22.13 或更高版本（推荐 Node.js 24）
- pnpm 10 或更高版本
- 一个 Supabase 项目

### 安装

```bash
git clone <your-repository-url>
cd BrandFlow-OS
pnpm install
```

复制环境变量示例：

```bash
cp .env.example .env.local
```

填写 Supabase 项目配置：

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-publishable-or-anon-key
VITE_AMAP_JS_KEY=your-amap-web-js-api-key
VITE_AMAP_SECURITY_CODE=your-amap-security-code
```

`VITE_SUPABASE_ANON_KEY` 只能使用 Supabase 的 publishable 或 legacy anon key。不要把 secret/service-role key 放进前端环境变量。

高德地图配置为可选项。未填写时“附近美食”会显示明确标注的界面预览数据，也可以直接在该页面填写 Web 端 JS API Key 和安全密钥并保存在当前浏览器。

### 初始化数据库

在 Supabase SQL Editor 中按文件名顺序执行：

1. `supabase/migrations/202607120001_brandflow_schema.sql`
2. `supabase/migrations/202607120002_seed_modules.sql`
3. `supabase/migrations/202607120003_invite_access.sql`
4. `supabase/migrations/202607120004_first_owner_bootstrap.sql`
5. `supabase/migrations/202607130001_super_admin_role.sql`
6. `supabase/migrations/202607130002_admin_management.sql`
7. `supabase/migrations/202607280001_metric_content_name.sql`
8. `supabase/migrations/202607280002_metric_content_identity.sql`
9. `supabase/migrations/202607280003_stop_reseeding_metrics.sql`
10. `supabase/migrations/202607280004_farm_game.sql`
11. `supabase/migrations/202607280005_aquarium.sql`
12. `supabase/migrations/202607280006_expand_farm_plots.sql`
13. `supabase/migrations/202607280007_ranch.sql`

这些迁移会创建业务表、模块初始化函数、私有素材桶和邀请制访问策略。

### 邀请制注册

- 已存在的 Auth 用户会自动保留访问权限。
- 全新项目的第一个注册账号可不填邀请码，并会成为超级管理员。
- 后续账号必须使用有效的六位邀请码注册。
- 只有超级管理员可在“设置 > 注册邀请码”生成、查看状态和撤销邀请码。
- 邀请码仅以 SHA-256 哈希保存，可设置有效期和使用次数。

公开部署前请保持邮箱确认开启，并建议在 Supabase Auth 中启用 CAPTCHA。

### 启动

```bash
pnpm dev
```

打开 `http://127.0.0.1:5173/`。全新项目先注册初始管理员；后续用户使用管理员生成的邀请码注册。首次登录时会自动初始化双品牌示例数据。

未配置 Supabase 环境变量时，应用会退回浏览器 `localStorage` 模式，方便预览界面。

## 数据模型

| 表 | 用途 |
| --- | --- |
| `profiles` | 用户资料 |
| `brands` | 创艺装饰、喜客喜装饰等品牌 |
| `metric_entries` | 品牌每日播放、转发和涨粉数据 |
| `projects` | 品牌视频、案例和内容栏目 |
| `plans` | 月度与周计划 |
| `contents` | 脚本、拍摄、剪辑和发布记录 |
| `assets` | Supabase Storage 文件元数据 |
| `ideas` | 灵感和选题 |
| `garden_state` | 农场等级、金币、种子与库存 |
| `garden_plots` | 十八块农田的作物成长状态 |
| `ranch_state` | 牧场等级、金币、饲料与产物库存 |
| `ranch_animals` | 牧场动物、健康、饥饿与生产状态 |
| `aquarium_state` | 海洋馆等级、贝壳与饲料 |
| `aquarium_creatures` | 海洋生物、健康、饥饿与场景位置 |

完整关系见 [Supabase 数据库设计](docs/18-Supabase数据库设计.md)。

## 可用命令

```bash
pnpm dev       # 启动开发服务器
pnpm build     # TypeScript 检查并构建生产版本
pnpm preview   # 预览生产构建
```

## 安全

- 所有用户业务表默认启用 RLS。
- 每条记录通过 `owner_id = auth.uid()` 隔离。
- 素材存储路径以用户 UUID 开头。
- `.env.local` 和其他本地环境文件不会进入版本库。

发现安全问题时请阅读 [SECURITY.md](SECURITY.md)，不要在公开 Issue 中披露密钥或漏洞细节。

## 贡献

欢迎提交 Issue 和 Pull Request。开始前请阅读 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 许可证

[MIT](LICENSE)
