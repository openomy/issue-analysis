'use client'

import { GitHubIssue } from '../../types'
import { LabelBadge } from './LabelBadge'
import { ExternalLink, GitPullRequest, MessageCircle } from 'lucide-react'
import { Card } from '../ui/card'
import { Badge } from '../ui/badge'

interface IssueTableProps {
  issues: (GitHubIssue & { github_repos?: { full_name: string; html_url: string } })[]
  loading?: boolean
}

export function IssueTable({ issues, loading }: IssueTableProps) {
  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="border rounded-lg p-4 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
            <div className="h-3 bg-gray-200 rounded w-1/2"></div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {issues.map((issue) => (
        <Card key={issue.id} className="p-4 hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                {issue.is_pull_request && (
                  <GitPullRequest className="w-4 h-4 text-blue-600" />
                )}
                <Badge variant={issue.state === 'open' ? 'default' : 'secondary'}>
                  {issue.state}
                </Badge>
                <span className="text-sm text-gray-500">
                  #{issue.number}
                </span>
              </div>
              
              <h3 className="text-lg font-semibold mb-2">
                <a 
                  href={issue.html_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="hover:text-blue-600 flex items-center gap-1"
                >
                  {issue.title}
                  <ExternalLink className="w-3 h-3" />
                </a>
              </h3>
              
              <div className="flex items-center gap-4 text-sm text-gray-500 mb-3">
                <span>by {issue.author}</span>
                <span>
                  {new Date(issue.created_at).toLocaleDateString()}
                </span>
                {issue.github_repos && (
                  <a 
                    href={issue.github_repos.html_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-blue-600"
                  >
                    {issue.github_repos.full_name}
                  </a>
                )}
                {issue.comments_count > 0 && (
                  <span className="flex items-center gap-1">
                    <MessageCircle className="w-3 h-3" />
                    {issue.comments_count}
                  </span>
                )}
              </div>
              
              {issue.labels && Array.isArray(issue.labels) && issue.labels.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {issue.labels.map((label: {id: string, name: string, color: string}) => (
                    <LabelBadge key={label.id || label.name} label={label} />
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}