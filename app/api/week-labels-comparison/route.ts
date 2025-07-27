import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '../../../lib/supabase'

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

// Define the main analysis labels (same as in open-issue-labels API)
const MAIN_LABELS = [
  'tool_calling',
  'mcp', 
  'setting',
  'file_system',
  'env',
  'chat',
  'plugin',
  'search',
  'tts',
  'design_style',
  'docs',
  'mobile',
  'react_native',
  'auth',
  'drawing',
  'need_manual_check'
]

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
    
    // 处理每周的标签数据
    const processWeekLabels = async (week: any) => {
      const allIssueIds: number[] = []
      
      // 收集所有 issue 和 PR 的 ID
      if (week.new_issues && Array.isArray(week.new_issues)) {
        console.log('Processing new_issues:', week.new_issues.length)
        allIssueIds.push(...week.new_issues.map((issue: any) => issue.id))
      }
      if (week.new_prs && Array.isArray(week.new_prs)) {
        console.log('Processing new_prs:', week.new_prs.length)
        allIssueIds.push(...week.new_prs.map((pr: any) => pr.id))
      }
      
      console.log('Total issue IDs collected:', allIssueIds.length)
      
      if (allIssueIds.length === 0) {
        return {
          period_label: formatPeriodLabel(week.period_start, week.period_end),
          labels: [],
          totalIssues: 0
        }
      }
      
      // 从 issue_label 表获取这些 issue/PR 的标签分析
      console.log('Querying issue_label table with IDs:', allIssueIds)
      const { data: labelData, error: labelError } = await supabase
        .from('issue_label')
        .select('*')
        .in('issue_id', allIssueIds)
      
      console.log('Label data result:', { 
        labelDataLength: labelData?.length || 0, 
        error: labelError?.message 
      })
      
      if (labelError) {
        console.error('Error fetching label data:', labelError)
        return {
          period_label: formatPeriodLabel(week.period_start, week.period_end),
          labels: [],
          totalIssues: allIssueIds.length
        }
      }
      
      if (!labelData) {
        return {
          period_label: formatPeriodLabel(week.period_start, week.period_end),
          labels: [],
          totalIssues: allIssueIds.length
        }
      }
      
      // 统计标签
      const labelCounts: Record<string, number> = {}
      const uniqueIssues = new Set<number>()
      
      labelData.forEach((labeledIssue: any) => {
        uniqueIssues.add(labeledIssue.issue_id)
        
        // 统计主要标签
        MAIN_LABELS.forEach(labelType => {
          if (labeledIssue[labelType] === true) {
            const displayName = labelType
              .split('_')
              .map(word => word.charAt(0).toUpperCase() + word.slice(1))
              .join(' ')
            
            labelCounts[displayName] = (labelCounts[displayName] || 0) + 1
          }
        })
        
        // 处理 model_provider
        if (labeledIssue.model_provider && labeledIssue.model_provider !== 'false') {
          const providerName = `${labeledIssue.model_provider.charAt(0).toUpperCase() + labeledIssue.model_provider.slice(1)} Provider`
          labelCounts[providerName] = (labelCounts[providerName] || 0) + 1
        }
      })
      
      // 转换为数组并排序
      const labels: LabelStat[] = Object.entries(labelCounts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10) // 只取前10个
      
      return {
        period_label: formatPeriodLabel(week.period_start, week.period_end),
        labels,
        totalIssues: uniqueIssues.size
      }
    }
    
    console.log('Processing weekData:', { 
      totalWeeks: weekData.length,
      firstWeek: weekData[0] ? formatPeriodLabel(weekData[0].period_start, weekData[0].period_end) : 'null',
      secondWeek: weekData[1] ? formatPeriodLabel(weekData[1].period_start, weekData[1].period_end) : 'null'
    })
    
    const thisWeekLabels = await processWeekLabels(weekData[0])
    const lastWeekLabels = weekData[1] ? await processWeekLabels(weekData[1]) : null
    
    const result: WeekLabelsComparisonData = {
      thisWeek: thisWeekLabels,
      lastWeek: lastWeekLabels
    }
    
    return NextResponse.json(result)
    
  } catch (error) {
    console.error('Error in week-labels-comparison API:', error)
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