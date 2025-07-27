'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Card } from '../ui/card'
import { Calendar, TrendingUp, TrendingDown, Minus } from 'lucide-react'

export interface WeekComparisonData {
  thisWeek: {
    period_label: string
    issues_count: number
    prs_count: number
    period_start: string
    period_end: string
  } | null
  lastWeek: {
    period_label: string
    issues_count: number
    prs_count: number
    period_start: string
    period_end: string
  } | null
}

interface WeekComparisonChartProps {
  data: WeekComparisonData | null
  loading?: boolean
}

export function WeekComparisonChart({ data, loading = false }: WeekComparisonChartProps) {
  if (loading) {
    return (
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">This Week vs Last Week</h3>
        <div className="h-80 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
        </div>
      </Card>
    )
  }

  if (!data || (!data.thisWeek && !data.lastWeek)) {
    return (
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">This Week vs Last Week</h3>
        <div className="h-80 flex items-center justify-center text-gray-500">
          <div className="text-center">
            <Calendar className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <div className="text-lg mb-2">No weekly data available</div>
            <p className="text-sm">Weekly analysis data will appear here once generated</p>
          </div>
        </div>
      </Card>
    )
  }

  // 准备图表数据
  const chartData = []
  
  if (data.lastWeek) {
    chartData.push({
      period: data.lastWeek.period_label,
      issues: data.lastWeek.issues_count,
      prs: data.lastWeek.prs_count,
      week: 'Last Week'
    })
  }
  
  if (data.thisWeek) {
    chartData.push({
      period: data.thisWeek.period_label,
      issues: data.thisWeek.issues_count,
      prs: data.thisWeek.prs_count,
      week: 'This Week'
    })
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.dataKey === 'issues' ? 'Issues' : 'PRs'}: <span className="font-medium">{entry.value}</span>
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  // 计算变化趋势
  const calculateChange = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0
    return ((current - previous) / previous) * 100
  }

  const issuesChange = data.thisWeek && data.lastWeek 
    ? calculateChange(data.thisWeek.issues_count, data.lastWeek.issues_count)
    : 0
  const prsChange = data.thisWeek && data.lastWeek 
    ? calculateChange(data.thisWeek.prs_count, data.lastWeek.prs_count)
    : 0

  const getTrendIcon = (change: number) => {
    if (change > 0) return <TrendingUp className="w-4 h-4 text-green-600" />
    if (change < 0) return <TrendingDown className="w-4 h-4 text-red-600" />
    return <Minus className="w-4 h-4 text-gray-400" />
  }

  const getTrendColor = (change: number) => {
    if (change > 0) return 'text-green-600'
    if (change < 0) return 'text-red-600'
    return 'text-gray-400'
  }

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">This Week vs Last Week</h3>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{
              top: 20,
              right: 30,
              left: 20,
              bottom: 60,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis 
              dataKey="period"
              angle={-45}
              textAnchor="end"
              height={80}
              tick={{ fontSize: 12 }}
              stroke="#666"
            />
            <YAxis stroke="#666" fontSize={12} />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Bar 
              dataKey="issues" 
              fill="#ef4444" 
              name="Issues"
              radius={[2, 2, 0, 0]}
            />
            <Bar 
              dataKey="prs" 
              fill="#3b82f6" 
              name="PRs"
              radius={[2, 2, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      
      {/* Summary Stats */}
      <div className="mt-6 grid grid-cols-2 gap-4">
        {/* Issues Comparison */}
        <div className="text-center p-4 bg-red-50 rounded-lg">
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className="text-2xl font-bold text-red-600">
              {data.thisWeek?.issues_count || 0}
            </span>
            {data.thisWeek && data.lastWeek && (
              <div className="flex items-center gap-1">
                {getTrendIcon(issuesChange)}
                <span className={`text-sm font-medium ${getTrendColor(issuesChange)}`}>
                  {Math.abs(issuesChange).toFixed(1)}%
                </span>
              </div>
            )}
          </div>
          <div className="text-sm text-gray-600">Issues This Week</div>
          {data.lastWeek && (
            <div className="text-xs text-gray-500 mt-1">
              vs {data.lastWeek.issues_count} last week
            </div>
          )}
        </div>
        
        {/* PRs Comparison */}
        <div className="text-center p-4 bg-blue-50 rounded-lg">
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className="text-2xl font-bold text-blue-600">
              {data.thisWeek?.prs_count || 0}
            </span>
            {data.thisWeek && data.lastWeek && (
              <div className="flex items-center gap-1">
                {getTrendIcon(prsChange)}
                <span className={`text-sm font-medium ${getTrendColor(prsChange)}`}>
                  {Math.abs(prsChange).toFixed(1)}%
                </span>
              </div>
            )}
          </div>
          <div className="text-sm text-gray-600">PRs This Week</div>
          {data.lastWeek && (
            <div className="text-xs text-gray-500 mt-1">
              vs {data.lastWeek.prs_count} last week
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}