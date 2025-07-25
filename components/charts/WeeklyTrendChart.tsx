/* eslint-disable @typescript-eslint/ban-ts-comment */
'use client'

import { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Card } from '../ui/card'
import { Badge } from '../ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog'
import { ExternalLink, Calendar, GitBranch, GitPullRequest } from 'lucide-react'

export interface WeeklyData {
  originalLabel: string
  id: number
  period_start: string
  period_end: string
  period_label: string
  issues_count: number
  prs_count: number
  new_issues: Array<{
    id: number
    number: number
    url: string
    title: string
    state: string
    created_at: string
  }>
  new_prs: Array<{
    id: number
    number: number
    url: string
    title: string
    state: string
    created_at: string
  }>
  created_at: string
  updated_at: string
}

interface WeeklyTrendChartProps {
  data: WeeklyData[]
  type: 'issues' | 'prs'
  title: string
  loading?: boolean
}

export function WeeklyTrendChart({ data, type, title, loading = false }: WeeklyTrendChartProps) {
  const [selectedWeek, setSelectedWeek] = useState<WeeklyData | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const chartData = data.map(week => ({
    ...week,
    count: type === 'issues' ? week.issues_count : week.prs_count
  }))

  // 处理图表数据，添加月份信息
  const processedChartData = chartData.map((week, index) => {
    const date = new Date(week.period_start)
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    
    // 检查是否是该月的第一周
    const isFirstWeekOfMonth = index === 0 || 
      monthKey !== `${new Date(chartData[index - 1].period_start).getFullYear()}-${String(new Date(chartData[index - 1].period_start).getMonth() + 1).padStart(2, '0')}`
    
    return {
      ...week,
      monthLabel: isFirstWeekOfMonth ? date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '',
      originalLabel: week.period_label
    }
  })

  const handleBarClick = (data: {payload: WeeklyData}) => {
    const weekData = data.payload
    setSelectedWeek(weekData)
    setIsModalOpen(true)
  }

  const CustomTooltip = ({ active, payload }: {active?: boolean, payload?: Array<{payload: WeeklyData}>}) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      const count = type === 'issues' ? data.issues_count : data.prs_count
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium">{data.originalLabel || data.period_label}</p>
          <p className="text-sm text-gray-600">
            {type === 'issues' ? 'New Issues' : 'New PRs'}: <span className="font-medium text-blue-600">{count}</span>
          </p>
          <p className="text-xs text-gray-500 mt-1">Click to view details</p>
        </div>
      )
    }
    return null
  }

  if (loading) {
    return (
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">{title}</h3>
        <div className="h-80 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
        </div>
      </Card>
    )
  }

  if (chartData.length === 0) {
    return (
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">{title}</h3>
        <div className="h-80 flex items-center justify-center text-gray-500">
          <div className="text-center">
            {type === 'issues' ? <GitBranch className="w-12 h-12 mx-auto mb-4 text-gray-400" /> : <GitPullRequest className="w-12 h-12 mx-auto mb-4 text-gray-400" />}
            <p>No data available</p>
            <p className="text-sm mt-2">Run &quot;解析历史数据&quot; first to generate trend data</p>
          </div>
        </div>
      </Card>
    )
  }

  const itemsData = selectedWeek ? (type === 'issues' ? selectedWeek.new_issues : selectedWeek.new_prs) : []

  return (
    <>
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">{title}</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={processedChartData}
              margin={{
                top: 20,
                right: 30,
                left: 20,
                bottom: 60,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis 
                dataKey="monthLabel"
                angle={-45}
                textAnchor="end"
                height={80}
                interval={0}
                tick={{ fontSize: 12 }}
                stroke="#666"
              />
              <YAxis stroke="#666" fontSize={12} />
              <Tooltip content={<CustomTooltip />} />
              <Bar 
                dataKey="count" 
                fill="#3b82f6" 
                radius={[2, 2, 0, 0]}
                cursor="pointer"
                // @ts-ignore
                onClick={handleBarClick}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
        
        {/* Summary Stats */}
        <div className="mt-4 grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-blue-600">
              {chartData.reduce((sum, week) => sum + week.count, 0)}
            </div>
            <div className="text-sm text-gray-600">Total {type === 'issues' ? 'Issues' : 'PRs'}</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-600">
              {Math.max(...chartData.map(week => week.count), 0)}
            </div>
            <div className="text-sm text-gray-600">Peak Week</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-purple-600">
              {chartData.length}
            </div>
            <div className="text-sm text-gray-600">Active Weeks</div>
          </div>
        </div>
      </Card>

      {/* Detail Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {type === 'issues' ? <GitBranch className="w-5 h-5" /> : <GitPullRequest className="w-5 h-5" />}
              {type === 'issues' ? 'New Issues' : 'New PRs'} - {selectedWeek?.period_label}
            </DialogTitle>
          </DialogHeader>
          
          {selectedWeek && (
            <div className="space-y-4">
              <div className="flex items-center gap-4 text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                <div className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {selectedWeek.period_start} to {selectedWeek.period_end}
                </div>
                <div className="font-medium">
                  {itemsData.length} {type === 'issues' ? 'issues' : 'PRs'} created
                </div>
              </div>
              
              <div className="space-y-3">
                {itemsData.length > 0 ? (
                  itemsData.map((item, index) => (
                    <div key={item.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-sm font-mono text-gray-500">#{item.number}</span>
                            <Badge variant={item.state === 'open' ? 'default' : 'secondary'}>
                              {item.state}
                            </Badge>
                          </div>
                          <h4 className="font-medium text-gray-900 mb-1 line-clamp-2">
                            {item.title}
                          </h4>
                          <p className="text-sm text-gray-500">
                            Created: {new Date(item.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 flex items-center gap-1 text-sm"
                        >
                          View
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-gray-500 py-8">
                    No {type === 'issues' ? 'issues' : 'PRs'} found for this period
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}