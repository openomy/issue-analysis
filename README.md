# GitHub Issues Analysis Dashboard

一个全面的 GitHub Issues 分析仪表板，用于跟踪和分析多个仓库的 GitHub issues，使用 Next.js、Supabase 和 Upstash Redis 构建。

*A comprehensive dashboard for tracking and analyzing GitHub issues across multiple repositories using Next.js, Supabase, and Upstash Redis.*

## ✨ 功能特性 / Features

- 📊 **统计仪表板 / Statistics Dashboard**: 查看全面的统计数据，包括总 issues、开放/关闭数量、PR 数量以及按标签和仓库的分类统计
- 🔍 **高级筛选 / Advanced Filtering**: 按状态、标签、仓库、作者和搜索词筛选 issues
- 🔄 **实时同步 / Real-time Sync**: 使用后台任务自动同步 GitHub issues
- 🎯 **多仓库支持 / Multi-repository Support**: 跟踪多个 GitHub 仓库的 issues
- 📱 **响应式设计 / Responsive Design**: 在桌面端和移动端都能完美工作
- ⚡ **高性能 / High Performance**: 使用 Redis 缓存和队列系统优化性能

## 🛠 技术栈 / Tech Stack

- **前端 / Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS
- **后端 / Backend**: Next.js API Routes
- **数据库 / Database**: Supabase (PostgreSQL)
- **缓存/队列 / Cache/Queue**: Upstash Redis
- **GitHub 集成**: Octokit
- **图标 / Icons**: Lucide React
- **部署 / Deployment**: Vercel

## 📂 项目结构 / Project Structure

```
issue-analysis/
├── app/                     # Next.js App Router
│   ├── api/                 # API routes
│   │   ├── issues/         # Issues 数据端点 / Issues data endpoints
│   │   │   ├── route.ts    # 获取 issues 列表 / Get issues list
│   │   │   └── stats/      # 统计数据端点 / Statistics endpoint
│   │   └── sync/           # 同步端点 / Synchronization endpoints
│   │       ├── issue/      # 同步单个 issue / Sync single issue
│   │       └── repo/       # 同步整个仓库 / Sync entire repo
│   ├── layout.tsx          # 根布局 / Root layout
│   ├── page.tsx            # 主仪表板页面 / Main dashboard page
│   └── globals.css         # 全局样式 / Global styles
├── components/             # 可复用的 React 组件 / Reusable React components
│   └── issues/            # Issue 相关组件 / Issue-related components
│       ├── IssueTable.tsx  # Issues 列表显示 / Issues list display
│       ├── IssueStats.tsx  # 统计仪表板 / Statistics dashboard
│       ├── FilterBar.tsx   # 筛选界面 / Filtering interface
│       └── LabelBadge.tsx  # GitHub 标签显示 / GitHub label display
├── lib/                   # 工具库 / Utility libraries
│   ├── supabase.ts        # Supabase 客户端 / Supabase client
│   ├── upstash.ts         # Upstash Redis 客户端 / Upstash Redis client
│   ├── github.ts          # Octokit 客户端 / Octokit client
│   └── sync-issue.ts      # 同步服务逻辑 / Sync service logic
├── types/                 # TypeScript 类型定义 / TypeScript type definitions
│   └── index.ts
├── .env.local            # 环境变量 / Environment variables (不要提交到 Git / not in git)
├── vercel.json           # Vercel 部署配置 / Vercel deployment config
└── package.json          # 项目依赖 / Project dependencies
```

## 🚀 快速开始 / Quick Start

### 1. 环境变量配置 / Environment Variables Setup

在项目根目录创建 `.env.local` 文件 / Create `.env.local` file in project root:

```env
# Supabase 配置
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key

# Upstash Redis 配置
UPSTASH_REDIS_REST_URL=your_upstash_redis_url
UPSTASH_REDIS_REST_TOKEN=your_upstash_redis_token

# GitHub 配置
GITHUB_TOKEN=your_github_personal_access_token
```

### 2. 数据库结构设置 / Database Schema Setup

在 Supabase 数据库中执行以下 SQL 创建表结构 / Execute the following SQL in your Supabase database:

```sql
-- GitHub 仓库表 / GitHub repositories table
CREATE TABLE github_repos (
  id BIGINT PRIMARY KEY,
  name TEXT NOT NULL,
  full_name TEXT NOT NULL UNIQUE,
  owner TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  language TEXT,
  topics JSONB DEFAULT '[]'::jsonb,
  stars INTEGER DEFAULT 0,
  forks INTEGER DEFAULT 0
);

-- GitHub Issues 表 / GitHub Issues table
CREATE TABLE github_issues (
  id BIGINT PRIMARY KEY,
  repo_id BIGINT REFERENCES github_repos(id),
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  state TEXT NOT NULL CHECK (state IN ('open', 'closed')),
  labels JSONB DEFAULT '[]'::jsonb,
  assignee TEXT,
  assignees JSONB DEFAULT '[]'::jsonb,
  milestone TEXT,
  is_pull_request BOOLEAN DEFAULT false,
  pr_url TEXT,
  author TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  closed_at TIMESTAMPTZ,
  comments_count INTEGER DEFAULT 0
);

-- 创建索引以提高查询性能 / Create indexes for better query performance
CREATE INDEX idx_github_issues_state ON github_issues(state);
CREATE INDEX idx_github_issues_repo_id ON github_issues(repo_id);
CREATE INDEX idx_github_issues_created_at ON github_issues(created_at);
CREATE INDEX idx_github_issues_author ON github_issues(author);
```

### 3. 安装依赖 / Install Dependencies

```bash
npm install
```

### 4. 运行开发服务器 / Run Development Server

```bash
npm run dev
```

在浏览器中打开 [http://localhost:3000](http://localhost:3000) 查看应用 / Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📖 使用指南 / Usage Guide

### 添加仓库 / Adding Repositories

1. 点击仪表板中的"Add Repository"按钮 / Click the "Add Repository" button in the dashboard
2. 输入仓库格式 `owner/repo`（例如：`facebook/react`） / Enter repository format `owner/repo` (e.g., `facebook/react`)
3. 系统会自动将该仓库的所有 issues 加入同步队列 / The system will automatically queue all issues from that repository

### 手动同步 / Manual Sync

点击"Sync Issues"按钮手动触发队列中 issues 的同步 / Click "Sync Issues" button to manually trigger synchronization.

### 筛选 Issues / Filtering Issues

使用筛选栏按以下条件筛选 issues / Use the filter bar to narrow down issues by:
- **状态 / State**: 全部、开放或关闭 / All, Open, or Closed
- **搜索 / Search**: 在标题、内容或作者中搜索 / Search in title, body, or author
- **高级筛选 / Advanced filters**: 按标签、仓库或作者筛选 / Filter by label, repository, or author

## 🔌 API 端点 / API Endpoints

### Issues 相关 / Issues Related

- `GET /api/issues` - 获取 issues 列表（支持筛选参数） / Fetch issues with optional filtering
  - 查询参数 / Query params: `state`, `label`, `repo`, `author`, `page`, `limit`
- `GET /api/issues/stats` - 获取 issues 统计数据 / Get issue statistics

### 同步相关 / Synchronization Related

- `POST /api/sync/issue` - 从队列同步一个 issue / Sync a single issue from the queue
- `POST /api/sync/repo` - 将仓库的所有 issues 添加到同步队列 / Add all issues from a repository to the sync queue
  - 请求体 / Request body: `{ "owner": "facebook", "repo": "react" }`

## 🚢 部署指南 / Deployment Guide

### Vercel 部署 / Vercel Deployment

1. 将代码推送到 GitHub / Push your code to GitHub
2. 在 Vercel 中连接你的 GitHub 仓库 / Connect your repository to Vercel
3. 在 Vercel 控制台中设置环境变量 / Set environment variables in Vercel dashboard
4. 部署 / Deploy

`vercel.json` 文件配置了每小时自动执行 issues 同步 / The `vercel.json` file configures automatic issue synchronization every hour.

### 生产环境变量 / Production Environment Variables

确保在部署平台中设置以下环境变量 / Make sure to set these environment variables in your deployment platform:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY` 
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `GITHUB_TOKEN`

## ⚙️ 后台任务 / Background Jobs

系统使用 Upstash Redis 进行队列管理和自动同步 / The system uses Upstash Redis for queue management and automatic synchronization:

1. 添加仓库时，issues 被加入 Redis 队列 / Issues are queued in Redis when repositories are added
2. Cron 任务每小时运行一次，同步队列中的 issues / A cron job runs every hour to sync queued issues
3. 同步过程从 GitHub 获取 issue 数据并存储到 Supabase / The sync process fetches issue data from GitHub and stores it in Supabase

## 🔒 安全考虑 / Security Considerations

- 所有 API 令牌都安全地存储在环境变量中 / All API tokens are stored securely in environment variables
- GitHub token 仅在服务器端使用 / GitHub token is only used server-side
- 可以启用 Supabase RLS（行级安全）来增强数据保护 / Supabase RLS (Row Level Security) can be enabled for additional data protection
- 客户端不会暴露任何敏感数据 / No sensitive data is exposed to the client

## 🤝 贡献指南 / Contributing

1. Fork 这个仓库 / Fork the repository
2. 创建功能分支 / Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. 提交你的修改 / Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 / Push to the branch (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request / Create a Pull Request

## 📝 开发说明 / Development Notes

### 本地开发 / Local Development

```bash
# 启动开发服务器 / Start development server
npm run dev

# 构建项目 / Build project
npm run build

# 运行生产版本 / Run production build
npm run start

# 代码检查 / Lint code
npm run lint
```

### 数据流 / Data Flow

1. **用户添加仓库** → 系统通过 GitHub API 获取 issues → 存入 Redis 队列
   *User adds repository → System fetches issues via GitHub API → Store in Redis queue*

2. **定时任务/手动触发** → 从队列取出 issue → 获取详细信息 → 存入 Supabase
   *Scheduled task/manual trigger → Dequeue issue → Fetch details → Store in Supabase*

3. **前端展示** → 从 Supabase 查询数据 → 展示在仪表板
   *Frontend display → Query data from Supabase → Display in dashboard*

## 📄 许可证 / License

本项目采用 MIT 许可证 / This project is licensed under the MIT License - 查看 [LICENSE](LICENSE) 文件了解详情 / see the [LICENSE](LICENSE) file for details.

---

🌟 如果这个项目对你有帮助，请给个 Star！ / If this project helps you, please give it a Star!