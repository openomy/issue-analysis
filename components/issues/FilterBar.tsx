'use client'

import { useState } from 'react'
import { Search, Filter, X } from 'lucide-react'
import { Card, CardContent } from '../ui/card'
import { Input } from '../ui/input'
import { Button } from '../ui/button'

interface FilterBarProps {
  onFilterChange: (filters: FilterState) => void
  loading?: boolean
}

export interface FilterState {
  state: string
  label: string
  repo: string
  author: string
  search: string
}

export function FilterBar({ onFilterChange, loading }: FilterBarProps) {
  const [filters, setFilters] = useState<FilterState>({
    state: 'all',
    label: '',
    repo: '',
    author: '',
    search: '',
  })

  const [isExpanded, setIsExpanded] = useState(false)

  const handleFilterChange = (key: keyof FilterState, value: string) => {
    const newFilters = { ...filters, [key]: value }
    setFilters(newFilters)
    onFilterChange(newFilters)
  }

  const clearFilters = () => {
    const clearedFilters: FilterState = {
      state: 'all',
      label: '',
      repo: '',
      author: '',
      search: '',
    }
    setFilters(clearedFilters)
    onFilterChange(clearedFilters)
  }

  const hasActiveFilters = Object.entries(filters).some(([key, value]) => 
    key !== 'state' ? value !== '' : value !== 'all'
  )

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              type="text"
              placeholder="Search issues..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              className="pl-10"
              disabled={loading}
            />
          </div>
          
          <select
            value={filters.state}
            onChange={(e) => handleFilterChange('state', e.target.value)}
            className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={loading}
          >
            <option value="all">All States</option>
            <option value="open">Open</option>
            <option value="closed">Closed</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              disabled={loading}
            >
              <X className="w-4 h-4 mr-1" />
              Clear
            </Button>
          )}
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            disabled={loading}
          >
            <Filter className="w-4 h-4 mr-1" />
            {isExpanded ? 'Less' : 'More'} Filters
          </Button>
        </div>
      </div>

      {isExpanded && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
          <Input
            type="text"
            placeholder="Filter by label..."
            value={filters.label}
            onChange={(e) => handleFilterChange('label', e.target.value)}
            disabled={loading}
          />
          
          <Input
            type="text"
            placeholder="Filter by repository..."
            value={filters.repo}
            onChange={(e) => handleFilterChange('repo', e.target.value)}
            disabled={loading}
          />
          
          <Input
            type="text"
            placeholder="Filter by author..."
            value={filters.author}
            onChange={(e) => handleFilterChange('author', e.target.value)}
            disabled={loading}
          />
        </div>
      )}
      </CardContent>
    </Card>
  )
}