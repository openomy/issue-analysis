import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '../../../lib/supabase'

export interface WeekComparisonData {
  thisWeek: {
    period_label: string
    issues_count: number
    prs_count: number
    period_start: string
    period_end: string
  }
  lastWeek: {
    period_label: string
    issues_count: number
    prs_count: number
    period_start: string
    period_end: string
  }
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
      return NextResponse.json({ 
        thisWeek: null,
        lastWeek: null
      })
    }
    
    // 获取最近两周的数据，按时间倒序排列
    const { data: weekData, error: weekError } = await supabase
      .from('week_analysis')
      .select('*')
      .order('period_start', { ascending: false })
      .limit(2)
    
    if (weekError) {
      console.error('Error fetching week analysis data:', weekError)
      return NextResponse.json({ error: 'Failed to fetch week analysis data' }, { status: 500 })
    }
    
    if (!weekData || weekData.length === 0) {
      return NextResponse.json({
        thisWeek: null,
        lastWeek: null
      })
    }
    
    // 格式化数据
    const formatWeekData = (week: any) => ({
      period_label: formatPeriodLabel(week.period_start, week.period_end),
      issues_count: week.new_issues ? week.new_issues.length : 0,
      prs_count: week.new_prs ? week.new_prs.length : 0,
      period_start: week.period_start,
      period_end: week.period_end
    })
    
    const result: WeekComparisonData = {
      thisWeek: weekData[0] ? formatWeekData(weekData[0]) : null,
      lastWeek: weekData[1] ? formatWeekData(weekData[1]) : null
    }
    
    return NextResponse.json(result)
    
  } catch (error) {
    console.error('Error in week-comparison API:', error)
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