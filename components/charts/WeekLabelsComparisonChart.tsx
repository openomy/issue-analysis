'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Card } from '../ui/card'
import { Calendar, Tag } from 'lucide-react'

export interface LabelStat {
  name: string
  count: number
}

export interface WeekLabelsComparisonData {
  thisWeek: {
    period_label: string
    labels: LabelStat[]
    totalIssues: number
  } | null
  lastWeek: {
    period_label: string
    labels: LabelStat[]
    totalIssues: number
  } | null
}

interface WeekLabelsComparisonChartProps {
  data: WeekLabelsComparisonData | null
  loading?: boolean
}

export function WeekLabelsComparisonChart({ data, loading = false }: WeekLabelsComparisonChartProps) {
  if (loading) {
    return (
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Weekly Categories Comparison</h3>
        <div className="h-80 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
        </div>
      </Card>
    )
  }

  if (!data || (!data.thisWeek && !data.lastWeek)) {
    return (
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Weekly Categories Comparison</h3>
        <div className="h-80 flex items-center justify-center text-gray-500">
          <div className="text-center">
            <Tag className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <div className="text-lg mb-2">No category data available</div>
            <p className="text-sm">Issue category analysis will appear here once available</p>
          </div>
        </div>
      </Card>
    )
  }

  // 准备图表数据 - 合并两周的标签数据
  const allLabels = new Set<string>()
  
  // 收集所有标签名
  data.thisWeek?.labels.forEach(label => allLabels.add(label.name))
  data.lastWeek?.labels.forEach(label => allLabels.add(label.name))
  
  if (allLabels.size === 0) {
    return (
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Weekly Categories Comparison</h3>
        <div className="h-80 flex items-center justify-center text-gray-500">
          <div className="text-center">
            <Tag className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <div className="text-lg mb-2">No labeled issues found</div>
            <p className="text-sm">Issues need analysis labels to appear in this chart</p>
          </div>
        </div>
      </Card>
    )
  }

  // 为每个标签创建对比数据
  const chartData = Array.from(allLabels).map(labelName => {
    const thisWeekLabel = data.thisWeek?.labels.find(l => l.name === labelName)
    const lastWeekLabel = data.lastWeek?.labels.find(l => l.name === labelName)
    
    return {
      name: labelName,
      thisWeek: thisWeekLabel?.count || 0,
      lastWeek: lastWeekLabel?.count || 0
    }
  })
  .filter(item => item.thisWeek > 0 || item.lastWeek > 0) // 只显示有数据的标签
  .sort((a, b) => (b.thisWeek + b.lastWeek) - (a.thisWeek + a.lastWeek)) // 按总数排序
  .slice(0, 10) // 只显示前10个

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.dataKey === 'thisWeek' ? 'This Week' : 'Last Week'}: <span className="font-medium">{entry.value}</span>
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Weekly Categories Comparison</h3>
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
              dataKey="name"
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
              dataKey="lastWeek" 
              fill="#94a3b8" 
              name={data.lastWeek?.period_label || "Last Week"}
              radius={[2, 2, 0, 0]}
            />
            <Bar 
              dataKey="thisWeek" 
              fill="#3b82f6" 
              name={data.thisWeek?.period_label || "This Week"}
              radius={[2, 2, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      
      {/* Summary Stats */}
      <div className="mt-6 grid grid-cols-2 gap-4">
        {/* This Week Summary */}
        <div className="text-center p-4 bg-blue-50 rounded-lg">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Calendar className="w-5 h-5 text-blue-600" />
            <span className="text-lg font-semibold text-blue-600">
              {data.thisWeek?.period_label || "This Week"}
            </span>
          </div>
          <div className="text-2xl font-bold text-blue-600 mb-1">
            {data.thisWeek?.totalIssues || 0}
          </div>
          <div className="text-sm text-gray-600">Analyzed Issues</div>
          <div className="text-xs text-gray-500 mt-1">
            {data.thisWeek?.labels.length || 0} categories found
          </div>
        </div>
        
        {/* Last Week Summary */}
        <div className="text-center p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Calendar className="w-5 h-5 text-gray-600" />
            <span className="text-lg font-semibold text-gray-600">
              {data.lastWeek?.period_label || "Last Week"}
            </span>
          </div>
          <div className="text-2xl font-bold text-gray-600 mb-1">
            {data.lastWeek?.totalIssues || 0}
          </div>
          <div className="text-sm text-gray-600">Analyzed Issues</div>
          <div className="text-xs text-gray-500 mt-1">
            {data.lastWeek?.labels.length || 0} categories found
          </div>
        </div>
      </div>
      
      {/* Top Categories */}
      {chartData.length > 0 && (
        <div className="mt-6">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Top Categories This Period</h4>
          <div className="space-y-2">
            {chartData.slice(0, 5).map((item, index) => (
              <div key={index} className="flex items-center justify-between text-sm">
                <span className="text-gray-700">{item.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-blue-600 font-medium">{item.thisWeek}</span>
                  <span className="text-gray-400">vs</span>
                  <span className="text-gray-500">{item.lastWeek}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  )
}