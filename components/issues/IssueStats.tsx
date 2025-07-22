'use client'

import { IssueStats } from '../../types'
import { BarChart3, GithubIcon, GitPullRequest, CheckCircle } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card'

interface IssueStatsProps {
  stats: IssueStats | null
  loading?: boolean
}

export function IssueStatsComponent({ stats, loading }: IssueStatsProps) {
  if (loading || !stats) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-lg border p-6 animate-pulse">
            <div className="h-8 bg-gray-200 rounded mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        ))}
      </div>
    )
  }

  const statCards = [
    {
      title: 'Total Issues',
      value: stats.total,
      icon: BarChart3,
      color: 'text-blue-600',
    },
    {
      title: 'Open Issues',
      value: stats.open,
      icon: GithubIcon,
      color: 'text-green-600',
    },
    {
      title: 'Closed Issues',
      value: stats.closed,
      icon: CheckCircle,
      color: 'text-red-600',
    },
    {
      title: 'Pull Requests',
      value: stats.pull_requests,
      icon: GitPullRequest,
      color: 'text-purple-600',
    },
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon
          return (
            <Card key={card.title}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{card.title}</p>
                    <p className="text-2xl font-bold">{card.value}</p>
                  </div>
                  <Icon className={`w-8 h-8 ${card.color}`} />
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Top Labels</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(stats.by_label)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 10)
                .map(([label, count]) => (
                  <div key={label} className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground truncate">{label}</span>
                    <span className="text-sm font-medium">{count}</span>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Repositories</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(stats.by_repo)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 10)
                .map(([repo, count]) => (
                  <div key={repo} className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground truncate">{repo}</span>
                    <span className="text-sm font-medium">{count}</span>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}