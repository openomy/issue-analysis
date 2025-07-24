'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { GitHubIssue, IssueStats } from '../../../../types'
import { IssueTableView } from '../../../../components/issues/IssueTableView'
import { Card } from '../../../../components/ui/card'
import { Badge } from '../../../../components/ui/badge'
import { GitBranch, ExternalLink, Users, GitPullRequest, AlertCircle, CheckCircle2 } from 'lucide-react'

export default function RepoPage() {
  const params = useParams()
  const owner = params.owner as string
  const repo = params.repo as string
  
  const [issues, setIssues] = useState<(GitHubIssue & { github_repos?: { full_name: string; html_url: string } })[]>([])
  const [stats, setStats] = useState<IssueStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [repoInfo, setRepoInfo] = useState<any>(null)

  const fetchRepoData = async () => {
    setLoading(true)
    try {
      // Fetch issues for this specific repository
      const issuesResponse = await fetch(`/api/issues?repo=${owner}/${repo}`)
      const issuesResult = await issuesResponse.json()
      
      if (issuesResult.data) {
        setIssues(issuesResult.data)
      }

      // Fetch repository stats
      const statsResponse = await fetch(`/api/issues/stats?repo=${owner}/${repo}`)
      const statsData = await statsResponse.json()
      setStats(statsData)

      // Try to get repository information from the issues data
      if (issuesResult.data && issuesResult.data.length > 0) {
        setRepoInfo(issuesResult.data[0].github_repos)
      }
    } catch (error) {
      console.error('Error fetching repository data:', error)
    }
    setLoading(false)
  }

  useEffect(() => {
    if (owner && repo) {
      fetchRepoData()
    }
  }, [owner, repo])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading repository data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                <GitBranch className="w-8 h-8" />
                {owner}/{repo}
              </h1>
              <p className="text-gray-600 mt-1">
                Issues and pull requests for this repository
              </p>
              {repoInfo && (
                <a 
                  href={repoInfo.html_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 flex items-center gap-1 mt-2"
                >
                  View on GitHub
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>
          </div>

          {/* Statistics Cards */}
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <Card className="p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <AlertCircle className="w-6 h-6 text-blue-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Total Issues</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <AlertCircle className="w-6 h-6 text-green-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Open</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.open}</p>
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-gray-100 rounded-lg">
                    <CheckCircle2 className="w-6 h-6 text-gray-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Closed</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.closed}</p>
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <GitPullRequest className="w-6 h-6 text-purple-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Pull Requests</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.pull_requests}</p>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* Top Labels */}
          {stats && stats.by_label && Object.keys(stats.by_label).length > 0 && (
            <Card className="p-6 mb-8">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <span>Most Common Labels</span>
              </h3>
              <div className="flex flex-wrap gap-2">
                {Object.entries(stats.by_label)
                  .sort(([,a], [,b]) => b - a)
                  .slice(0, 10)
                  .map(([label, count]) => (
                    <Badge key={label} variant="outline" className="text-sm">
                      {label} ({count})
                    </Badge>
                  ))}
              </div>
            </Card>
          )}
        </div>

        {/* Issues Table */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Issues & Pull Requests</h2>
          <IssueTableView issues={issues} loading={loading} />
        </Card>
      </div>
    </div>
  )
}