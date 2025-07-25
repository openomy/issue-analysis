'use client'

import { useMemo, useState, useEffect } from 'react'
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getSortedRowModel,
  SortingState,
} from '@tanstack/react-table'
import { GitHubIssue, PaginationInfo } from '../../types'
import { LabelBadge } from './LabelBadge'
import { ExternalLink, GitPullRequest, MessageCircle, ArrowUpDown, ArrowUp, ArrowDown, Brain, Loader2, Check, X, Search } from 'lucide-react'
import { Badge } from '../ui/badge'
import { Input } from '../ui/input'
import { Button } from '../ui/button'
import { Select, SelectContent, SelectItem } from '../ui/select'
import { Pagination } from '../ui/pagination'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table'

interface IssueTableViewProps {
  issues: (GitHubIssue & { github_repos?: { full_name: string; html_url: string } })[]
  pagination?: PaginationInfo
  loading?: boolean
  onSearch?: (search: string) => void
  onPageChange?: (page: number) => void
  onLimitChange?: (limit: number) => void
}

const columnHelper = createColumnHelper<GitHubIssue & { github_repos?: { full_name: string; html_url: string } }>()

export function IssueTableView({ 
  issues, 
  pagination, 
  loading, 
  onSearch, 
  onPageChange, 
  onLimitChange 
}: IssueTableViewProps) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [searchInput, setSearchInput] = useState('')
  const [analyzingIssues, setAnalyzingIssues] = useState<Set<number>>(new Set())
  const [analysisResults, setAnalysisResults] = useState<Map<number, 'success' | 'error'>>(new Map())

  // 防抖搜索
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (onSearch) {
        onSearch(searchInput)
      }
    }, 500)

    return () => clearTimeout(timeoutId)
  }, [searchInput, onSearch])

  const analyzeIssue = async (issue: GitHubIssue) => {
    setAnalyzingIssues(prev => new Set(prev).add(issue.id))
    setAnalysisResults(prev => {
      const newMap = new Map(prev)
      newMap.delete(issue.id)
      return newMap
    })

    try {
      // 调用分析接口
      const analysisResponse = await fetch('/api/issue-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          issue_ID: issue.id.toString(),
          GITHUB_ISSUE_CONTENT: `# ${issue.title} \n\n${issue.body || ''}`
        })
      })

      if (!analysisResponse.ok) {
        throw new Error('Analysis failed')
      }

      const analysisResult = await analysisResponse.json()

      console.log("analysisResult",analysisResult)

      // 保存分析结果
      const saveResponse = await fetch('/api/issue-analysis/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          issue_id: issue.id,
          is_pull_request: issue.is_pull_request,
          analysis: analysisResult.analysis
        })
      })

      if (!saveResponse.ok) {
        throw new Error('Save failed')
      }

      setAnalysisResults(prev => new Map(prev).set(issue.id, 'success'))
    } catch (error) {
      console.error('Error analyzing issue:', error)
      setAnalysisResults(prev => new Map(prev).set(issue.id, 'error'))
    } finally {
      setAnalyzingIssues(prev => {
        const newSet = new Set(prev)
        newSet.delete(issue.id)
        return newSet
      })
    }
  }

  const columns = useMemo(
    () => [
      columnHelper.display({
        id: 'type',
        header: 'Type',
        size: 60,
        cell: ({ row }) => (
          <div className="flex items-center justify-center">
            {row.original.is_pull_request ? (
              <GitPullRequest className="w-4 h-4 text-blue-600" />
            ) : (
              <div className="w-4 h-4 rounded-full bg-green-500" />
            )}
          </div>
        ),
      }),
      columnHelper.accessor('number', {
        header: ({ column }) => (
          <button
            className="flex items-center gap-1 hover:bg-accent hover:text-accent-foreground p-1 rounded font-medium"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            #
            {column.getIsSorted() === 'asc' ? (
              <ArrowUp className="w-3 h-3" />
            ) : column.getIsSorted() === 'desc' ? (
              <ArrowDown className="w-3 h-3" />
            ) : (
              <ArrowUpDown className="w-3 h-3" />
            )}
          </button>
        ),
        size: 80,
        cell: ({ getValue }) => (
          <span className="font-mono text-muted-foreground">#{getValue()}</span>
        ),
      }),
      columnHelper.accessor('title', {
        header: ({ column }) => (
          <button
            className="flex items-center gap-1 hover:bg-accent hover:text-accent-foreground p-1 rounded font-medium"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Title
            {column.getIsSorted() === 'asc' ? (
              <ArrowUp className="w-3 h-3" />
            ) : column.getIsSorted() === 'desc' ? (
              <ArrowDown className="w-3 h-3" />
            ) : (
              <ArrowUpDown className="w-3 h-3" />
            )}
          </button>
        ),
        cell: ({ getValue, row }) => (
          <div className="max-w-md">
            <a 
              href={row.original.html_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:text-primary/80 font-medium flex items-center gap-1 truncate"
              title={getValue()}
            >
              <span className="truncate">{getValue()}</span>
              <ExternalLink className="w-3 h-3 flex-shrink-0" />
            </a>
          </div>
        ),
      }),
      columnHelper.accessor('state', {
        header: ({ column }) => (
          <button
            className="flex items-center gap-1 hover:bg-accent hover:text-accent-foreground p-1 rounded font-medium"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            State
            {column.getIsSorted() === 'asc' ? (
              <ArrowUp className="w-3 h-3" />
            ) : column.getIsSorted() === 'desc' ? (
              <ArrowDown className="w-3 h-3" />
            ) : (
              <ArrowUpDown className="w-3 h-3" />
            )}
          </button>
        ),
        size: 80,
        cell: ({ getValue }) => (
          <Badge variant={getValue() === 'open' ? 'default' : 'secondary'}>
            {getValue()}
          </Badge>
        ),
      }),
      columnHelper.accessor('author', {
        header: ({ column }) => (
          <button
            className="flex items-center gap-1 hover:bg-accent hover:text-accent-foreground p-1 rounded font-medium"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Author
            {column.getIsSorted() === 'asc' ? (
              <ArrowUp className="w-3 h-3" />
            ) : column.getIsSorted() === 'desc' ? (
              <ArrowDown className="w-3 h-3" />
            ) : (
              <ArrowUpDown className="w-3 h-3" />
            )}
          </button>
        ),
        size: 120,
        cell: ({ getValue }) => (
          <span className="text-foreground">{getValue()}</span>
        ),
      }),
      columnHelper.accessor('labels', {
        header: 'Labels',
        size: 200,
        enableSorting: false,
        cell: ({ getValue }) => {
          const labels = getValue()
          if (!labels || !Array.isArray(labels) || labels.length === 0) {
            return null
          }
          return (
            <div className="flex flex-wrap gap-1 max-w-[200px]">
              {labels.slice(0, 3).map((label: {id: string, name: string, color: string}) => (
                <LabelBadge key={label.id || label.name} label={label} />
              ))}
              {labels.length > 3 && (
                <span className="text-xs text-muted-foreground">+{labels.length - 3} more</span>
              )}
            </div>
          )
        },
      }),
      columnHelper.accessor('comments_count', {
        header: ({ column }) => (
          <button
            className="flex items-center gap-1 hover:bg-accent hover:text-accent-foreground p-1 rounded font-medium"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Comments
            {column.getIsSorted() === 'asc' ? (
              <ArrowUp className="w-3 h-3" />
            ) : column.getIsSorted() === 'desc' ? (
              <ArrowDown className="w-3 h-3" />
            ) : (
              <ArrowUpDown className="w-3 h-3" />
            )}
          </button>
        ),
        size: 100,
        cell: ({ getValue }) => {
          const count = getValue()
          return count > 0 ? (
            <span className="flex items-center gap-1 text-muted-foreground">
              <MessageCircle className="w-3 h-3" />
              {count}
            </span>
          ) : null
        },
      }),
      columnHelper.accessor('created_at', {
        header: ({ column }) => (
          <button
            className="flex items-center gap-1 hover:bg-accent hover:text-accent-foreground p-1 rounded font-medium"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Created
            {column.getIsSorted() === 'asc' ? (
              <ArrowUp className="w-3 h-3" />
            ) : column.getIsSorted() === 'desc' ? (
              <ArrowDown className="w-3 h-3" />
            ) : (
              <ArrowUpDown className="w-3 h-3" />
            )}
          </button>
        ),
        size: 120,
        cell: ({ getValue }) => (
          <span className="text-muted-foreground text-sm">
            {new Date(getValue()).toLocaleDateString()}
          </span>
        ),
      }),
      columnHelper.display({
        id: 'analyze',
        header: 'Analyze',
        size: 100,
        cell: ({ row }) => {
          const issue = row.original
          const isAnalyzing = analyzingIssues.has(issue.id)
          const result = analysisResults.get(issue.id)
          
          return (
            <Button
              size="sm"
              variant="outline"
              onClick={() => analyzeIssue(issue)}
              disabled={isAnalyzing}
              className="h-8 px-3"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  Analyzing
                </>
              ) : result === 'success' ? (
                <>
                  <Check className="w-3 h-3 mr-1 text-green-600" />
                  Done
                </>
              ) : result === 'error' ? (
                <>
                  <X className="w-3 h-3 mr-1 text-red-600" />
                  Retry
                </>
              ) : (
                <>
                  <Brain className="w-3 h-3 mr-1" />
                  Analyze
                </>
              )}
            </Button>
          )
        },
      }),
    ],
    [analyzingIssues, analysisResults]
  )

  const table = useReactTable({
    data: issues,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    state: {
      sorting,
    },
    manualPagination: true, // 启用服务端分页
    manualFiltering: true,  // 启用服务端过滤
  })

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-10 bg-gray-200 rounded animate-pulse"></div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-16 bg-gray-100 rounded animate-pulse"></div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Search and Controls */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search issues..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9"
            />
          </div>
          {pagination && (
            <span className="text-sm text-muted-foreground">
              Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} issues
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Rows per page:</span>
          <Select
            value={pagination?.limit.toString() || '50'}
            onValueChange={(value) => onLimitChange?.(parseInt(value))}
          >
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="25">25</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    style={{ width: header.getSize() }}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} className="whitespace-nowrap">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {table.getRowModel().rows.length === 0 && !loading && (
        <div className="text-center py-8 text-muted-foreground">
          No issues found matching your criteria.
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Page {pagination.page} of {pagination.totalPages}
          </div>
          <Pagination
            currentPage={pagination.page}
            totalPages={pagination.totalPages}
            onPageChange={(page) => onPageChange?.(page)}
          />
          <div className="text-sm text-muted-foreground">
            Total: {pagination.total} issues
          </div>
        </div>
      )}
    </div>
  )
}