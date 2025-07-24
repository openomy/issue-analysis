'use client'

import { useMemo } from 'react'
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getSortedRowModel,
  SortingState,
  getFilteredRowModel,
  ColumnFiltersState,
} from '@tanstack/react-table'
import { useState } from 'react'
import { GitHubIssue } from '../../types'
import { LabelBadge } from './LabelBadge'
import { ExternalLink, GitPullRequest, MessageCircle, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { Badge } from '../ui/badge'
import { Input } from '../ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table'

interface IssueTableViewProps {
  issues: (GitHubIssue & { github_repos?: { full_name: string; html_url: string } })[]
  loading?: boolean
}

const columnHelper = createColumnHelper<GitHubIssue & { github_repos?: { full_name: string; html_url: string } }>()

export function IssueTableView({ issues, loading }: IssueTableViewProps) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [globalFilter, setGlobalFilter] = useState('')

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
              {labels.slice(0, 3).map((label: any) => (
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
    ],
    []
  )

  const table = useReactTable({
    data: issues,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    state: {
      sorting,
      columnFilters,
      globalFilter,
    },
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
      {/* Search */}
      <div className="flex items-center gap-4">
        <Input
          placeholder="Search issues..."
          value={globalFilter ?? ''}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="max-w-sm"
        />
        <span className="text-sm text-muted-foreground">
          Showing {table.getFilteredRowModel().rows.length} of {issues.length} issues
        </span>
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

      {table.getFilteredRowModel().rows.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          No issues found matching your criteria.
        </div>
      )}
    </div>
  )
}