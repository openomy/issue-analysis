export interface GitHubRepo {
  id: number
  name: string
  full_name: string
  owner: string
  html_url: string
  description?: string
  created_at: string
  updated_at: string
  language?: string
  topics: string[]
  stars: number
  forks: number
}

export interface GitHubIssue {
  id: number
  repo_id: number
  number: number
  url: string
  html_url: string
  title: string
  body?: string
  state: 'open' | 'closed'
  labels: Label[]
  assignee?: string
  assignees: string[]
  milestone?: string
  is_pull_request: boolean
  pr_url?: string
  author: string
  created_at: string
  updated_at: string
  closed_at?: string
  comments_count: number
}

export interface Label {
  id: number
  name: string
  color: string
  description?: string
}

export interface IssueStats {
  total: number
  open: number
  closed: number
  pull_requests: number
  by_label: { [key: string]: number }
  by_repo: { [key: string]: number }
}

export interface SyncStatus {
  last_sync: string
  is_syncing: boolean
  total_issues: number
  synced_issues: number
}