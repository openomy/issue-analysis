'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { ExternalLink, BarChart3 } from 'lucide-react'
import { IssuePRPieChart, ChartData } from '../../../../components/charts/IssuePRPieChart'
import { WeeklyTrendChart, WeeklyData } from '../../../../components/charts/WeeklyTrendChart'
import { MainLabelBarChart } from '../../../../components/charts/MainLabelBarChart'
import { VersionPieChart } from '../../../../components/charts/VersionPieChart'
import { DeploymentPieChart } from '../../../../components/charts/DeploymentPieChart'
import { PlatformPieChart } from '../../../../components/charts/PlatformPieChart'

interface LabelData {
  name: string
  count: number
}

interface AnalysisData {
  mainLabels: LabelData[]
  versionStats: LabelData[]
  deploymentStats: LabelData[]
  platformStats: LabelData[]
  totalIssues: number
}

export default function AnalysisChartsPage() {
  const params = useParams()
  const owner = params.owner as string
  const repo = params.repo as string
  
  const [chartData, setChartData] = useState<ChartData | null>(null)
  const [weeklyData, setWeeklyData] = useState<WeeklyData[]>([])
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null)
  const [loading, setLoading] = useState(true)
  const [weeklyLoading, setWeeklyLoading] = useState(true)
  const [labelLoading, setLabelLoading] = useState(true)
  const [repoInfo, setRepoInfo] = useState<{html_url: string} | null>(null)

  const fetchChartData = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/analysis-charts?repo=${owner}/${repo}`)
      const data = await response.json()
      setChartData(data)
    } catch (error) {
      console.error('Error fetching chart data:', error)
    }
    setLoading(false)
  }, [owner, repo])

  const fetchWeeklyData = useCallback(async () => {
    setWeeklyLoading(true)
    try {
      const response = await fetch(`/api/week-analysis?repo=${owner}/${repo}`)
      const result = await response.json()
      
      if (result.data) {
        setWeeklyData(result.data)
      }
    } catch (error) {
      console.error('Error fetching weekly data:', error)
    }
    setWeeklyLoading(false)
  }, [owner, repo])

  const fetchAnalysisData = useCallback(async () => {
    setLabelLoading(true)
    try {
      const response = await fetch(`/api/open-issue-labels?repo=${owner}/${repo}`)
      const data = await response.json()
      
      if (data.mainLabels || data.versionStats || data.deploymentStats || data.platformStats) {
        const transformedData: AnalysisData = {
          mainLabels: data.mainLabels || [],
          versionStats: data.versionStats || [],
          deploymentStats: data.deploymentStats || [],
          platformStats: data.platformStats || [],
          totalIssues: data.totalIssues || 0
        }
        
        setAnalysisData(transformedData)
      } else {
        setAnalysisData(null)
      }
    } catch (error) {
      console.error('Error fetching analysis data:', error)
    }
    setLabelLoading(false)
  }, [owner, repo])

  const fetchRepoInfo = useCallback(async () => {
    try {
      // Try to get repository information
      const response = await fetch(`/api/issues?repo=${owner}/${repo}&limit=1`)
      const result = await response.json()
      
      if (result.data && result.data.length > 0) {
        setRepoInfo(result.data[0].github_repos)
      }
    } catch (error) {
      console.error('Error fetching repository info:', error)
    }
  }, [owner, repo])

  useEffect(() => {
    if (owner && repo) {
      fetchChartData()
      fetchWeeklyData()
      fetchAnalysisData()
      fetchRepoInfo()
    }
  }, [owner, repo, fetchChartData, fetchWeeklyData, fetchAnalysisData, fetchRepoInfo])

  if (loading && !chartData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading analysis charts...</p>
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
                <BarChart3 className="w-8 h-8" />
                {owner}/{repo} Analytics
              </h1>
              <p className="text-gray-600 mt-1">
                Statistical analysis and visualizations for this repository
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
        </div>

        {/* Charts Section */}
        <div className="space-y-8 mb-8">
          {/* Current Stats - Pie Chart */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="lg:col-span-1">
              {chartData && (
                <IssuePRPieChart 
                  data={chartData} 
                  loading={loading}
                />
              )}
            </div>
            
            {/* Main Labels Bar Chart */}
            <div className="lg:col-span-1">
              <MainLabelBarChart 
                data={analysisData?.mainLabels || []} 
                totalIssues={analysisData?.totalIssues || 0}
                loading={labelLoading}
              />
            </div>
          </div>

          {/* Analysis Charts - Three specific categories */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Version Distribution */}
            <div className="lg:col-span-1">
              <VersionPieChart 
                data={analysisData?.versionStats || []}
                loading={labelLoading}
              />
            </div>
            
            {/* Deployment Distribution */}
            <div className="lg:col-span-1">
              <DeploymentPieChart 
                data={analysisData?.deploymentStats || []}
                loading={labelLoading}
              />
            </div>
            
            {/* Platform Distribution */}
            <div className="lg:col-span-1">
              <PlatformPieChart 
                data={analysisData?.platformStats || []}
                loading={labelLoading}
              />
            </div>
          </div>

          {/* Historical Trends */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Issues Trend */}
            <div className="lg:col-span-1">
              <WeeklyTrendChart
                data={weeklyData}
                type="issues"
                title="Issues Created Over Time"
                loading={weeklyLoading}
              />
            </div>
            
            {/* PRs Trend */}
            <div className="lg:col-span-1">
              <WeeklyTrendChart
                data={weeklyData}
                type="prs"
                title="Pull Requests Created Over Time"
                loading={weeklyLoading}
              />
            </div>
          </div>
        </div>

        {/* Summary Section */}
        {chartData && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-xl font-semibold mb-4">Repository Summary</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div className="p-4 bg-red-50 rounded-lg">
                <div className="text-2xl font-bold text-red-600">{chartData.openIssues}</div>
                <div className="text-sm text-gray-600">Open Issues</div>
              </div>
              <div className="p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{chartData.closedIssues}</div>
                <div className="text-sm text-gray-600">Closed Issues</div>
              </div>
              <div className="p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{chartData.openPRs}</div>
                <div className="text-sm text-gray-600">Open PRs</div>
              </div>
              <div className="p-4 bg-violet-50 rounded-lg">
                <div className="text-2xl font-bold text-violet-600">{chartData.closedPRs}</div>
                <div className="text-sm text-gray-600">Closed PRs</div>
              </div>
            </div>
            
            <div className="mt-6 text-center text-gray-600">
              <p>
                Total Items: {chartData.openIssues + chartData.closedIssues + chartData.openPRs + chartData.closedPRs} | 
                Issues: {chartData.openIssues + chartData.closedIssues} | 
                PRs: {chartData.openPRs + chartData.closedPRs}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}