'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Card } from '../ui/card'

export interface LabelData {
  name: string
  count: number
}

interface MainLabelBarChartProps {
  data: LabelData[]
  totalIssues: number
  loading?: boolean
}

export function MainLabelBarChart({ data, totalIssues, loading = false }: MainLabelBarChartProps) {
  if (loading) {
    return (
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Main Issue Categories</h3>
        <div className="h-80 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
        </div>
      </Card>
    )
  }

  if (data.length === 0) {
    return (
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Main Issue Categories</h3>
        <div className="h-80 flex items-center justify-center text-gray-500">
          <div className="text-center">
            <div className="text-lg mb-2">No analyzed issues found</div>
            <p className="text-sm">Issues need to be analyzed first to appear in this chart</p>
          </div>
        </div>
      </Card>
    )
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0]
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium">{label}</p>
          <p className="text-sm text-gray-600">
            Issues: <span className="font-medium text-blue-600">{data.value}</span>
          </p>
          <p className="text-xs text-gray-500">
            {totalIssues > 0 ? `${((data.value / totalIssues) * 100).toFixed(1)}% of total issues` : ''}
          </p>
        </div>
      )
    }
    return null
  }

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Main Issue Categories</h3>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
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
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      
      {/* Summary Stats */}
      <div className="mt-6 grid grid-cols-3 gap-4 text-center">
        <div>
          <div className="text-2xl font-bold text-blue-600">
            {data.reduce((sum, item) => sum + item.count, 0)}
          </div>
          <div className="text-sm text-gray-600">Total Label Assignments</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-green-600">
            {totalIssues}
          </div>
          <div className="text-sm text-gray-600">Analyzed Issues</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-purple-600">
            {data.length}
          </div>
          <div className="text-sm text-gray-600">Categories</div>
        </div>
      </div>
    </Card>
  )
}