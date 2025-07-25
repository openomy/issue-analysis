'use client'

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import { Card } from '../ui/card'

export interface ChartData {
  openIssues: number
  closedIssues: number
  openPRs: number
  closedPRs: number
}

interface IssuePRPieChartProps {
  data: ChartData
  loading?: boolean
}

const COLORS = {
  openIssues: '#ef4444', // red-500
  closedIssues: '#22c55e', // green-500
  openPRs: '#3b82f6', // blue-500
  closedPRs: '#8b5cf6' // violet-500
}

export function IssuePRPieChart({ data, loading = false }: IssuePRPieChartProps) {
  const pieData = [
    {
      name: 'Open Issues',
      value: data.openIssues,
      color: COLORS.openIssues
    },
    {
      name: 'Closed Issues',
      value: data.closedIssues,
      color: COLORS.closedIssues
    },
    {
      name: 'Open PRs',
      value: data.openPRs,
      color: COLORS.openPRs
    },
    {
      name: 'Closed PRs',
      value: data.closedPRs,
      color: COLORS.closedPRs
    }
  ].filter(item => item.value > 0) // Only show items with values > 0

  if (loading) {
    return (
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Issues & PRs Distribution</h3>
        <div className="h-80 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
        </div>
      </Card>
    )
  }

  if (pieData.length === 0) {
    return (
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Issues & PRs Distribution</h3>
        <div className="h-80 flex items-center justify-center text-gray-500">
          No data available
        </div>
      </Card>
    )
  }

  const CustomTooltip = ({ active, payload }: {active?: boolean, payload?: Array<{value: number, payload: {name: string}}>}) => {
    if (active && payload && payload.length) {
      const data = payload[0]
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium">{data.payload.name}</p>
          <p className="text-sm text-gray-600">
            Count: <span className="font-medium">{data.value}</span>
          </p>
        </div>
      )
    }
    return null
  }

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Issues & PRs Distribution</h3>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name} (${((percent  || 0) * 100).toFixed(1)}%)`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
            >
              {pieData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
      
      {/* Summary Stats */}
      <div className="mt-6 grid grid-cols-2 gap-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-red-500">{data.openIssues}</div>
          <div className="text-sm text-gray-600">Open Issues</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-green-500">{data.closedIssues}</div>
          <div className="text-sm text-gray-600">Closed Issues</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-500">{data.openPRs}</div>
          <div className="text-sm text-gray-600">Open PRs</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-violet-500">{data.closedPRs}</div>
          <div className="text-sm text-gray-600">Closed PRs</div>
        </div>
      </div>
    </Card>
  )
}