'use client'

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import { Card } from '../ui/card'
import { Monitor, Apple, Laptop } from 'lucide-react'

export interface LabelData {
  name: string
  count: number
}

interface PlatformPieChartProps {
  data: LabelData[]
  loading?: boolean
}

const COLORS = {
  'Windows': '#0078d4', // Microsoft Blue
  'Macos': '#000000', // Apple Black
  'Linux': '#fcc624', // Linux Gold
}

const ICONS = {
  'Windows': Monitor,
  'Macos': Apple,
  'Linux': Laptop,
}

export function PlatformPieChart({ data, loading = false }: PlatformPieChartProps) {
  if (loading) {
    return (
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Platform Distribution</h3>
        <div className="h-80 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
        </div>
      </Card>
    )
  }

  if (data.length === 0) {
    return (
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Platform Distribution</h3>
        <div className="h-80 flex items-center justify-center text-gray-500">
          <div className="text-center">
            <div className="text-lg mb-2">No platform-specific issues found</div>
            <p className="text-sm">Issues related to Windows, macOS, or Linux will appear here</p>
          </div>
        </div>
      </Card>
    )
  }

  // Assign colors to data
  const pieData = data.map((item) => ({
    ...item,
    color: COLORS[item.name as keyof typeof COLORS] || '#6b7280'
  }))

  const CustomTooltip = ({ active, payload }: {active?: boolean, payload?: Array<{value: number, payload: any}>}) => {
    if (active && payload && payload.length) {
      const data = payload[0]
      const total = pieData.reduce((sum, item) => sum + item.count, 0)
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium">{data.payload.name}</p>
          <p className="text-sm text-gray-600">
            Issues: <span className="font-medium">{data.value}</span>
          </p>
          <p className="text-xs text-gray-500">
            {((data.value / total) * 100).toFixed(1)}% of platform issues
          </p>
        </div>
      )
    }
    return null
  }

  const total = pieData.reduce((sum, item) => sum + item.count, 0)

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Platform Distribution</h3>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name} (${((percent || 0) * 100).toFixed(1)}%)`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="count"
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
      <div className="mt-6">
        <div className="text-center mb-4">
          <div className="text-2xl font-bold text-blue-600">{total}</div>
          <div className="text-sm text-gray-600">Platform-specific Issues</div>
        </div>
        
        {/* Legend with Icons */}
        <div className="grid grid-cols-1 gap-2">
          {pieData.map((item, index) => {
            const IconComponent = ICONS[item.name as keyof typeof ICONS]
            return (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: item.color }}
                  ></div>
                  <div className="flex items-center gap-1">
                    {IconComponent && <IconComponent className="w-4 h-4 text-gray-600" />}
                    <span className="text-sm text-gray-700">{item.name}</span>
                  </div>
                </div>
                <div className="text-sm font-medium text-gray-900">
                  {item.count} ({((item.count / total) * 100).toFixed(1)}%)
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </Card>
  )
}