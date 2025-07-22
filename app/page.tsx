'use client'

import { useState, useEffect } from 'react'
import { GitHubIssue, IssueStats } from '../types'
import { IssueTable } from '../components/issues/IssueTable'
import { IssueStatsComponent } from '../components/issues/IssueStats'
import { FilterBar, FilterState } from '../components/issues/FilterBar'
import { RefreshCw, Plus, GitBranch, Play, Square, Trash2, Zap, Database } from 'lucide-react'
import { Button } from '../components/ui/button'

export default function Home() {
  const [issues, setIssues] = useState<(GitHubIssue & { github_repos?: { full_name: string; html_url: string } })[]>([])
  const [stats, setStats] = useState<IssueStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [statsLoading, setStatsLoading] = useState(true)
  const [filters, setFilters] = useState<FilterState>({
    state: 'all',
    label: '',
    repo: '',
    author: '',
    search: ''
  })
  const [activeTab, setActiveTab] = useState<'stats' | 'issues'>('stats')
  const [autoSyncInterval, setAutoSyncInterval] = useState<NodeJS.Timeout | null>(null)
  const [isAutoSyncing, setIsAutoSyncing] = useState(false)
  const [smartSyncInterval, setSmartSyncInterval] = useState<NodeJS.Timeout | null>(null)
  const [isSmartSyncing, setIsSmartSyncing] = useState(false)
  const [queueStatus, setQueueStatus] = useState<{ totalCount: number; repoStats: { [key: string]: number } } | null>(null)

  const fetchIssues = async (filterParams: FilterState) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterParams.state !== 'all') params.set('state', filterParams.state)
      if (filterParams.label) params.set('label', filterParams.label)
      if (filterParams.repo) params.set('repo', filterParams.repo)
      if (filterParams.author) params.set('author', filterParams.author)

      const response = await fetch(`/api/issues?${params}`)
      const result = await response.json()
      
      if (result.data) {
        let filteredIssues = result.data
        
        if (filterParams.search) {
          const searchLower = filterParams.search.toLowerCase()
          filteredIssues = filteredIssues.filter((issue: GitHubIssue) =>
            issue.title.toLowerCase().includes(searchLower) ||
            issue.body?.toLowerCase().includes(searchLower) ||
            issue.author.toLowerCase().includes(searchLower)
          )
        }
        
        setIssues(filteredIssues)
      }
    } catch (error) {
      console.error('Error fetching issues:', error)
    }
    setLoading(false)
  }

  const fetchStats = async () => {
    setStatsLoading(true)
    try {
      const response = await fetch('/api/issues/stats')
      const data = await response.json()
      setStats(data)
    } catch (error) {
      console.error('Error fetching stats:', error)
    }
    setStatsLoading(false)
  }

  const fetchQueueStatus = async () => {
    try {
      const response = await fetch('/api/queue/clean-synced')
      const data = await response.json()
      if (data.success) {
        setQueueStatus(data)
      }
    } catch (error) {
      console.error('Error fetching queue status:', error)
    }
  }

  const triggerSync = async () => {
    try {
      const response = await fetch('/api/sync/issue', { method: 'POST' })
      const result = await response.json()
      
      if (result.success) {
        fetchIssues(filters)
        fetchStats()
      }
    } catch (error) {
      console.error('Error triggering sync:', error)
    }
  }

  const addRepo = async () => {
    const repoInput = prompt('Enter repository in format "owner/repo" (e.g., "facebook/react"):')
    if (!repoInput) return

    const [owner, repo] = repoInput.split('/')
    if (!owner || !repo) {
      alert('Invalid repository format. Please use "owner/repo"')
      return
    }

    try {
      const response = await fetch('/api/sync/repo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner, repo })
      })
      
      const result = await response.json()
      
      if (result.success) {
        alert(`Successfully added ${owner}/${repo} to sync queue`)
      } else {
        alert(`Error: ${result.error}`)
      }
    } catch (error) {
      console.error('Error adding repo:', error)
      alert('Failed to add repository')
    }
  }

  const startAutoSync = () => {
    if (autoSyncInterval) return
    
    setIsAutoSyncing(true)
    const interval = setInterval(async () => {
      await triggerSync()
    }, 1000) // 10 seconds
    
    setAutoSyncInterval(interval)
  }

  const stopAutoSync = () => {
    if (autoSyncInterval) {
      clearInterval(autoSyncInterval)
      setAutoSyncInterval(null)
    }
    setIsAutoSyncing(false)
  }

  const deduplicateQueue = async () => {
    try {
      const response = await fetch('/api/queue/deduplicate', { method: 'POST' })
      const result = await response.json()
      
      if (result.success) {
        alert(result.message)
      } else {
        alert(`Error: ${result.error}`)
      }
    } catch (error) {
      console.error('Error deduplicating queue:', error)
      alert('Failed to deduplicate queue')
    }
  }

  const smartSync = async () => {
    try {
      const response = await fetch('/api/sync/smart', { method: 'POST' })
      const result = await response.json()
      
      if (result.success && result.synced) {
        fetchIssues(filters)
        fetchStats()
      }
    } catch (error) {
      console.error('Error in smart sync:', error)
    }
  }

  const startSmartSync = () => {
    if (smartSyncInterval) return
    
    setIsSmartSyncing(true)
    const interval = setInterval(async () => {
      await smartSync()
    }, 1000) // 1 second
    
    setSmartSyncInterval(interval)
  }

  const stopSmartSync = () => {
    if (smartSyncInterval) {
      clearInterval(smartSyncInterval)
      setSmartSyncInterval(null)
    }
    setIsSmartSyncing(false)
  }

  const cleanSyncedFromQueue = async () => {
    try {
      const response = await fetch('/api/queue/clean-synced', { method: 'POST' })
      const result = await response.json()
      
      if (result.success) {
        alert(result.message)
        fetchQueueStatus() // Refresh queue status
      } else {
        alert(`Error: ${result.error}`)
      }
    } catch (error) {
      console.error('Error cleaning synced items from queue:', error)
      alert('Failed to clean synced items from queue')
    }
  }

  useEffect(() => {
    fetchIssues(filters)
  }, [])

  useEffect(() => {
    fetchStats()
    fetchQueueStatus()
  }, [])

  useEffect(() => {
    return () => {
      if (autoSyncInterval) {
        clearInterval(autoSyncInterval)
      }
      if (smartSyncInterval) {
        clearInterval(smartSyncInterval)
      }
    }
  }, [])

  const handleFilterChange = (newFilters: FilterState) => {
    setFilters(newFilters)
    fetchIssues(newFilters)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                <GitBranch className="w-8 h-8" />
                GitHub Issues Dashboard
              </h1>
              <p className="text-gray-600 mt-1">
                Track and analyze GitHub issues across multiple repositories
              </p>
            </div>
            
            <div className="flex gap-2 flex-wrap">
              <Button onClick={addRepo}>
                <Plus className="w-4 h-4 mr-2" />
                Add Repository
              </Button>
              
              <Button onClick={triggerSync} variant="secondary">
                <RefreshCw className="w-4 h-4 mr-2" />
                Sync Issues
              </Button>
              
              {!isAutoSyncing ? (
                <Button onClick={startAutoSync} variant="outline">
                  <Play className="w-4 h-4 mr-2" />
                  Auto Sync (1s)
                </Button>
              ) : (
                <Button onClick={stopAutoSync} variant="destructive">
                  <Square className="w-4 h-4 mr-2" />
                  Stop Auto Sync
                </Button>
              )}

              {!isSmartSyncing ? (
                <Button onClick={startSmartSync} variant="outline">
                  <Zap className="w-4 h-4 mr-2" />
                  Smart Sync (1s)
                </Button>
              ) : (
                <Button onClick={stopSmartSync} variant="destructive">
                  <Square className="w-4 h-4 mr-2" />
                  Stop Smart Sync
                </Button>
              )}

              <Button onClick={deduplicateQueue} variant="ghost">
                <Trash2 className="w-4 h-4 mr-2" />
                Remove Duplicates
              </Button>

              <Button onClick={cleanSyncedFromQueue} variant="ghost">
                <Database className="w-4 h-4 mr-2" />
                Clean Synced
              </Button>
            </div>
            
            {/* Queue Status Display */}
            {queueStatus && (
              <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                <h3 className="text-sm font-semibold text-blue-800 mb-2">
                  Queue Status: {queueStatus.totalCount} items remaining
                </h3>
                {Object.keys(queueStatus.repoStats).length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                    {Object.entries(queueStatus.repoStats).map(([repo, count]) => (
                      <div key={repo} className="text-xs bg-white px-2 py-1 rounded">
                        <span className="font-mono">{repo}</span>: 
                        <span className="font-bold ml-1">{count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex border-b">
            <Button
              variant="ghost"
              onClick={() => setActiveTab('stats')}
              className={`border-b-2 rounded-none ${
                activeTab === 'stats'
                  ? 'border-primary text-primary'
                  : 'border-transparent'
              }`}
            >
              Statistics
            </Button>
            <Button
              variant="ghost"
              onClick={() => setActiveTab('issues')}
              className={`border-b-2 rounded-none ${
                activeTab === 'issues'
                  ? 'border-primary text-primary'
                  : 'border-transparent'
              }`}
            >
              Issues List
            </Button>
          </div>
        </div>

        {activeTab === 'stats' ? (
          <IssueStatsComponent stats={stats} loading={statsLoading} />
        ) : (
          <div className="space-y-6">
            <FilterBar onFilterChange={handleFilterChange} loading={loading} />
            <IssueTable issues={issues} loading={loading} />
          </div>
        )}
      </div>
    </div>
  )
}