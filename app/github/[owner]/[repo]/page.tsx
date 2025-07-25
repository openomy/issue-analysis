'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { GitHubIssue, IssueStats, PaginationInfo, IssuesResponse } from '../../../../types'
import { IssueTableView } from '../../../../components/issues/IssueTableView'
import { Card } from '../../../../components/ui/card'
import { Badge } from '../../../../components/ui/badge'
import { GitBranch, ExternalLink, Users, GitPullRequest, AlertCircle, CheckCircle2, Database, Loader2, Brain, X, Pause, Play } from 'lucide-react'

export default function RepoPage() {
  const params = useParams()
  const owner = params.owner as string
  const repo = params.repo as string
  
  const [issues, setIssues] = useState<(GitHubIssue & { github_repos?: { full_name: string; html_url: string } })[]>([])
  const [pagination, setPagination] = useState<PaginationInfo | null>(null)
  const [stats, setStats] = useState<IssueStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [repoInfo, setRepoInfo] = useState<any>(null)
  
  // 搜索和分页参数
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisMessage, setAnalysisMessage] = useState('')
  const [isBatchAnalyzing, setIsBatchAnalyzing] = useState(false)
  const [batchAnalysisStatus, setBatchAnalysisStatus] = useState<any>(null)
  const [batchMessage, setBatchMessage] = useState('')

  const fetchRepoData = useCallback(async () => {
    setLoading(true)
    try {
      // 构建查询参数
      const params = new URLSearchParams({
        repo: `${owner}/${repo}`,
        page: currentPage.toString(),
        limit: pageSize.toString(),
      })
      
      if (searchQuery) {
        params.set('search', searchQuery)
      }

      // Fetch issues for this specific repository
      const issuesResponse = await fetch(`/api/issues?${params}`)
      const issuesResult: IssuesResponse = await issuesResponse.json()
      
      if (issuesResult.data) {
        setIssues(issuesResult.data)
        setPagination(issuesResult.pagination)
      }

      // Try to get repository information from the issues data
      if (issuesResult.data && issuesResult.data.length > 0) {
        setRepoInfo(issuesResult.data[0].github_repos)
      }
    } catch (error) {
      console.error('Error fetching repository data:', error)
    }
    setLoading(false)
  }, [owner, repo, currentPage, pageSize, searchQuery])

  const fetchStats = useCallback(async () => {
    try {
      // Fetch repository stats
      const statsResponse = await fetch(`/api/issues/stats?repo=${owner}/${repo}`)
      const statsData = await statsResponse.json()
      setStats(statsData)
    } catch (error) {
      console.error('Error fetching stats:', error)
    }
  }, [owner, repo])

  // 处理搜索
  const handleSearch = useCallback((search: string) => {
    setSearchQuery(search)
    setCurrentPage(1) // 搜索时重置到第一页
  }, [])

  // 处理分页
  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page)
  }, [])

  // 处理每页数量变化
  const handleLimitChange = useCallback((limit: number) => {
    setPageSize(limit)
    setCurrentPage(1) // 改变每页数量时重置到第一页
  }, [])

  // 处理历史数据解析
  const handleAnalyzeHistoricalData = useCallback(async () => {
    setIsAnalyzing(true)
    setAnalysisMessage('开始解析历史数据...')
    
    try {
      const response = await fetch('/api/analyze-historical-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          repo: `${owner}/${repo}`
        })
      })
      
      const result = await response.json()
      
      if (response.ok) {
        setAnalysisMessage(`解析完成！处理了 ${result.processedCount} 条数据，创建了 ${result.weeksCreated} 个周期记录。`)
      } else {
        setAnalysisMessage(`解析失败：${result.error}`)
      }
    } catch (error) {
      console.error('Error analyzing historical data:', error)
      setAnalysisMessage('解析失败：网络错误或服务器错误')
    } finally {
      setIsAnalyzing(false)
      // 5秒后清除消息
      setTimeout(() => setAnalysisMessage(''), 5000)
    }
  }, [owner, repo])

  // 处理全量AI打标分析
  const handleBatchAnalysis = useCallback(async () => {
    setIsBatchAnalyzing(true)
    setBatchMessage('正在启动全量AI分析...')
    
    try {
      const response = await fetch('/api/batch-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          repo: `${owner}/${repo}`,
          action: 'start'
        })
      })
      
      const result = await response.json()
      
      if (response.ok) {
        setBatchMessage(`分析已启动！总共 ${result.totalCount} 个issues需要处理`)
        // 开始轮询状态
        startStatusPolling()
      } else {
        setBatchMessage(`启动失败：${result.error}`)
        setIsBatchAnalyzing(false)
      }
    } catch (error) {
      console.error('Error starting batch analysis:', error)
      setBatchMessage('启动失败：网络错误或服务器错误')
      setIsBatchAnalyzing(false)
    }
  }, [owner, repo])

  // 轮询批处理状态
  const startStatusPolling = useCallback(() => {
    const pollStatus = async () => {
      try {
        const response = await fetch('/api/batch-analysis', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            repo: `${owner}/${repo}`,
            action: 'status'
          })
        })
        
        const status = await response.json()
        setBatchAnalysisStatus(status)
        
        if (status.status === 'running') {
          setBatchMessage(`正在处理：${status.processedCount}/${status.totalCount} (成功：${status.successCount}, 错误：${status.errorCount})`)
          // 更频繁的轮询以获得更及时的进度更新
          setTimeout(pollStatus, 1000)
        } else if (status.status === 'paused') {
          setBatchMessage(`分析已暂停：${status.processedCount}/${status.totalCount} (成功：${status.successCount}, 错误：${status.errorCount})`)
          setIsBatchAnalyzing(false)
          // 暂停状态不需要继续轮询，但保持消息显示
        } else if (status.status === 'completed') {
          setBatchMessage(`分析完成！处理了 ${status.processedCount} 个issues，成功 ${status.successCount} 个，错误 ${status.errorCount} 个`)
          setIsBatchAnalyzing(false)
          // 5秒后清除消息
          setTimeout(() => setBatchMessage(''), 8000)
        } else if (status.status === 'cancelled') {
          setBatchMessage('分析已取消')
          setIsBatchAnalyzing(false)
          setTimeout(() => setBatchMessage(''), 5000)
        }
      } catch (error) {
        console.error('Error polling status:', error)
        setBatchMessage('状态检查失败，但分析可能仍在进行中')
        setIsBatchAnalyzing(false)
      }
    }
    
    // 立即开始第一次轮询，然后每秒轮询一次
    setTimeout(pollStatus, 500)
  }, [owner, repo])

  // 取消批处理
  const handleCancelBatchAnalysis = useCallback(async () => {
    try {
      const response = await fetch('/api/batch-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          repo: `${owner}/${repo}`,
          action: 'cancel'
        })
      })
      
      if (response.ok) {
        setBatchMessage('正在取消分析...')
      }
    } catch (error) {
      console.error('Error cancelling batch analysis:', error)
    }
  }, [owner, repo])

  // 暂停批处理
  const handlePauseBatchAnalysis = useCallback(async () => {
    try {
      const response = await fetch('/api/batch-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          repo: `${owner}/${repo}`,
          action: 'pause'
        })
      })
      
      const result = await response.json()
      
      if (response.ok) {
        setBatchMessage(`分析已暂停！已处理 ${result.processedCount}/${result.totalCount}，剩余 ${result.remainingCount} 个`)
        setIsBatchAnalyzing(false)
      } else {
        setBatchMessage(`暂停失败：${result.error}`)
      }
    } catch (error) {
      console.error('Error pausing batch analysis:', error)
      setBatchMessage('暂停失败：网络错误或服务器错误')
    }
  }, [owner, repo])

  // 继续批处理
  const handleResumeBatchAnalysis = useCallback(async () => {
    try {
      setBatchMessage('正在恢复分析...')
      
      const response = await fetch('/api/batch-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          repo: `${owner}/${repo}`,
          action: 'resume'
        })
      })
      
      const result = await response.json()
      
      if (response.ok) {
        setBatchMessage(`分析已恢复！将从 ${result.processedCount}/${result.totalCount} 继续，剩余 ${result.remainingCount} 个`)
        setIsBatchAnalyzing(true)
        // 开始轮询状态
        startStatusPolling()
      } else {
        setBatchMessage(`恢复失败：${result.error}`)
      }
    } catch (error) {
      console.error('Error resuming batch analysis:', error)
      setBatchMessage('恢复失败：网络错误或服务器错误')
    }
  }, [owner, repo, startStatusPolling])

  // 检查批量分析状态
  const checkBatchAnalysisStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/batch-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          repo: `${owner}/${repo}`,
          action: 'status'
        })
      })
      
      const status = await response.json()
      
      if (response.ok && status.status !== 'not_started') {
        setBatchAnalysisStatus(status)
        
        if (status.status === 'running') {
          console.log('🔄 检测到正在进行的批量分析，恢复状态和轮询')
          setBatchMessage(`正在处理：${status.processedCount}/${status.totalCount} (成功：${status.successCount}, 错误：${status.errorCount})`)
          setIsBatchAnalyzing(true)
          // 如果是运行状态，开始轮询
          startStatusPolling()
        } else if (status.status === 'paused') {
          console.log('🔄 检测到暂停的批量分析，恢复暂停状态')
          setBatchMessage(`分析已暂停：${status.processedCount}/${status.totalCount} (成功：${status.successCount}, 错误：${status.errorCount})`)
          setIsBatchAnalyzing(false)
        } else if (status.status === 'completed') {
          console.log('🔄 检测到已完成的批量分析')
          setBatchMessage(`分析完成！处理了 ${status.processedCount} 个issues，成功 ${status.successCount} 个，错误 ${status.errorCount} 个`)
          setIsBatchAnalyzing(false)
        }
      }
    } catch (error) {
      console.error('Error checking batch analysis status:', error)
    }
  }, [owner, repo, startStatusPolling])

  useEffect(() => {
    if (owner && repo) {
      fetchRepoData()
      // 检查是否有正在进行的批量分析
      checkBatchAnalysisStatus()
    }
  }, [fetchRepoData, checkBatchAnalysisStatus])

  useEffect(() => {
    if (owner && repo) {
      fetchStats()
    }
  }, [fetchStats])

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
            
            {/* 按钮组 */}
            <div className="flex flex-col items-end gap-2">
              <div className="flex gap-2">
                {/* 根据状态显示不同的按钮组合 */}
                {(() => {
                  const currentStatus = batchAnalysisStatus?.status
                  
                  if (currentStatus === 'running') {
                    // 运行中：显示暂停和取消按钮
                    return (
                      <>
                        <button
                          onClick={handlePauseBatchAnalysis}
                          disabled={isAnalyzing}
                          className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg flex items-center gap-2 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                        >
                          <Pause className="w-4 h-4" />
                          暂停分析
                        </button>
                        <button
                          onClick={handleCancelBatchAnalysis}
                          disabled={isAnalyzing}
                          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center gap-2 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                        >
                          <X className="w-4 h-4" />
                          取消分析
                        </button>
                      </>
                    )
                  } else if (currentStatus === 'paused') {
                    // 暂停中：显示继续和取消按钮
                    return (
                      <>
                        <button
                          onClick={handleResumeBatchAnalysis}
                          disabled={isAnalyzing}
                          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center gap-2 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                        >
                          <Play className="w-4 h-4" />
                          继续分析
                        </button>
                        <button
                          onClick={handleCancelBatchAnalysis}
                          disabled={isAnalyzing}
                          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center gap-2 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                        >
                          <X className="w-4 h-4" />
                          取消分析
                        </button>
                      </>
                    )
                  } else {
                    // 默认状态：显示开始按钮
                    return (
                      <button
                        onClick={handleBatchAnalysis}
                        disabled={isAnalyzing}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center gap-2 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                      >
                        <Brain className="w-4 h-4" />
                        全量AI打标分析
                      </button>
                    )
                  }
                })()}

                {/* 解析历史数据按钮 */}
                <button
                  onClick={handleAnalyzeHistoricalData}
                  disabled={isAnalyzing || isBatchAnalyzing}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
                >
                  {isAnalyzing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Database className="w-4 h-4" />
                  )}
                  {isAnalyzing ? '解析中...' : '解析历史数据'}
                </button>
              </div>
              
              {/* 状态消息 */}
              {(analysisMessage || batchMessage) && (
                <div className="flex flex-col gap-1">
                  {/* 历史数据解析消息 */}
                  {analysisMessage && (
                    <div className={`text-sm px-3 py-2 rounded-lg ${
                      analysisMessage.includes('失败') 
                        ? 'bg-red-100 text-red-700' 
                        : analysisMessage.includes('完成')
                        ? 'bg-green-100 text-green-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}>
                      {analysisMessage}
                    </div>
                  )}
                  
                  {/* 批量AI分析消息 */}
                  {batchMessage && (
                    <div className={`text-sm px-3 py-2 rounded-lg max-w-md ${
                      batchMessage.includes('失败') || batchMessage.includes('错误')
                        ? 'bg-red-100 text-red-700' 
                        : batchMessage.includes('完成')
                        ? 'bg-green-100 text-green-700'
                        : batchMessage.includes('取消')
                        ? 'bg-yellow-100 text-yellow-700'
                        : batchMessage.includes('暂停')
                        ? 'bg-orange-100 text-orange-700'
                        : batchMessage.includes('恢复') || batchMessage.includes('继续')
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-purple-100 text-purple-700'
                    }`}>
                      <div className="flex items-center gap-2">
                        {isBatchAnalyzing && (
                          <Loader2 className="w-3 h-3 animate-spin flex-shrink-0" />
                        )}
                        <span className="text-xs">{batchMessage}</span>
                      </div>
                      {/* 进度条 */}
                      {batchAnalysisStatus && isBatchAnalyzing && batchAnalysisStatus.totalCount > 0 && (
                        <div className="mt-2">
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                              style={{ 
                                width: `${(batchAnalysisStatus.processedCount / batchAnalysisStatus.totalCount) * 100}%` 
                              }}
                            ></div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
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
          <IssueTableView 
            issues={issues} 
            pagination={pagination || undefined}
            loading={loading}
            onSearch={handleSearch}
            onPageChange={handlePageChange}
            onLimitChange={handleLimitChange}
          />
        </Card>
      </div>
    </div>
  )
}