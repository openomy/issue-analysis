import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '../../../lib/supabase'

export interface WeekAnalysisData {
  id: number
  period_start: string
  period_end: string
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

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const repo = searchParams.get('repo')
  
  try {
    if (!repo) {
      return NextResponse.json({ error: 'Repository name is required' }, { status: 400 })
    }
    
    // 获取repo_id
    const { data: repoData, error: repoError } = await supabase
      .from('github_repos')
      .select('id')
      .eq('full_name', repo)
      .single()
    
    if (repoError || !repoData) {
      return NextResponse.json({ error: 'Repository not found' }, { status: 404 })
    }
    
    // 获取所有week_analysis数据，按时间排序
    const { data: weekData, error: weekError } = await supabase
      .from('week_analysis')
      .select('*')
      .order('period_start', { ascending: true })
    
    if (weekError) {
      console.error('Error fetching week analysis data:', weekError)
      return NextResponse.json({ error: 'Failed to fetch week analysis data' }, { status: 500 })
    }
    
    // 过滤出有数据的周期（至少有一个issue或PR）
    const filteredData = (weekData || []).filter(week => 
      (week.new_issues && week.new_issues.length > 0) || 
      (week.new_prs && week.new_prs.length > 0)
    )
    
    // 格式化数据用于图表显示
    const chartData = filteredData.map(week => ({
      id: week.id,
      period_start: week.period_start,
      period_end: week.period_end,
      period_label: formatPeriodLabel(week.period_start, week.period_end),
      issues_count: week.new_issues ? week.new_issues.length : 0,
      prs_count: week.new_prs ? week.new_prs.length : 0,
      new_issues: week.new_issues || [],
      new_prs: week.new_prs || [],
      created_at: week.created_at,
      updated_at: week.updated_at
    }))
    
    return NextResponse.json({
      data: chartData,
      total: chartData.length
    })
    
  } catch (error) {
    console.error('Error in week-analysis API:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// 格式化周期标签
function formatPeriodLabel(startDate: string, endDate: string): string {
  const start = new Date(startDate)
  const end = new Date(endDate)
  
  const startMonth = start.toLocaleDateString('en-US', { month: 'short' })
  const endMonth = end.toLocaleDateString('en-US', { month: 'short' })
  
  const startDay = start.getDate()
  const endDay = end.getDate()
  
  if (startMonth === endMonth) {
    return `${startMonth} ${startDay}-${endDay}`
  } else {
    return `${startMonth} ${startDay} - ${endMonth} ${endDay}`
  }
}