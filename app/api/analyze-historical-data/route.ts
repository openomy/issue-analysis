/* eslint-disable @typescript-eslint/ban-ts-comment */
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '../../../lib/supabase'

// 周期划分逻辑函数
function getWeekPeriods(year: number, month: number) {
  const periods = []
  
  // 获取本月最后一天
  const lastDay = new Date(year, month, 0).getDate()
  
  // 第1周：1-7号
  periods.push({
    start: new Date(year, month - 1, 1, 0, 0, 0),
    end: new Date(year, month - 1, 7, 23, 59, 59)
  })
  
  // 第2周：8-14号
  periods.push({
    start: new Date(year, month - 1, 8, 0, 0, 0),
    end: new Date(year, month - 1, 14, 23, 59, 59)
  })
  
  // 第3周：15-21号
  periods.push({
    start: new Date(year, month - 1, 15, 0, 0, 0),
    end: new Date(year, month - 1, 21, 23, 59, 59)
  })
  
  // 第4周：22号到月末
  periods.push({
    start: new Date(year, month - 1, 22, 0, 0, 0),
    end: new Date(year, month - 1, lastDay, 23, 59, 59)
  })
  
  return periods
}

// 确保周期记录存在
async function ensureWeekRecord(periodStart: Date, periodEnd: Date) {
  const periodStartStr = periodStart.toISOString().split('T')[0]
  const periodEndStr = periodEnd.toISOString().split('T')[0]
  
  // 检查记录是否已存在
  const { data: existing, error: checkError } = await supabase
    .from('week_analysis')
    .select('id')
    .eq('period_start', periodStartStr)
    .single()
  
  if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows returned
    throw checkError
  }
  
  if (!existing) {
    // 创建新记录，只初始化必要字段
    const { error: insertError } = await supabase
      .from('week_analysis')
      .insert({
        period_start: periodStartStr,
        period_end: periodEndStr,
        new_issues: [],
        new_prs: []
      })
    
    if (insertError) {
      throw insertError
    }
    
    return true // 表示创建了新记录
  }
  
  return false // 记录已存在
}

// 处理单个周期的数据
async function processWeekData(repoId: number, periodStart: Date, periodEnd: Date) {
  const periodStartStr = periodStart.toISOString().split('T')[0]
  
  // 获取当前周期记录中已存在的数据
  const { data: existingRecord, error: recordError } = await supabase
    .from('week_analysis')
    .select('new_issues, new_prs')
    .eq('period_start', periodStartStr)
    .single()
  
  if (recordError) {
    throw recordError
  }
  
  const existingNewIssues = existingRecord?.new_issues || []
  const existingNewPRs = existingRecord?.new_prs || []
  
  // 创建已存在条目的ID集合，用于快速去重
  const existingIssueIds = new Set(existingNewIssues.map((item: {id: number}) => item.id))
  const existingPRIds = new Set(existingNewPRs.map((item: {id: number}) => item.id))
  
  // 获取这个周期内创建的所有issues和PRs
  const { data: issues, error } = await supabase
    .from('github_issues')
    .select('id, url, title, state, is_pull_request, created_at')
    .eq('repo_id', repoId)
    .gte('created_at', periodStart.toISOString())
    .lte('created_at', periodEnd.toISOString())
    .order('created_at', { ascending: true })
  
  if (error) {
    throw error
  }
  
  if (!issues || issues.length === 0) {
    return { newIssues: existingNewIssues, newPRs: existingNewPRs, counts: { issues: 0, prs: 0 } }
  }
  
  // 分类并去重issues和PRs
  let newIssuesAdded = 0
  let newPRsAdded = 0
  
  issues.forEach(issue => {
    const item = {
      id: issue.id,
      // @ts-ignore
      number: issue?.number,
      // @ts-ignore
      url: issue?.html_url || issue.url, // 使用url字段作为唯一标识
      title: issue.title,
      state: issue.state,
      created_at: issue.created_at
    }
    
    if (issue.is_pull_request) {
      // 检查PR是否已存在
      if (!existingPRIds.has(issue.id)) {
        existingNewPRs.push(item)
        existingPRIds.add(issue.id)
        newPRsAdded++
      }
    } else {
      // 检查Issue是否已存在
      if (!existingIssueIds.has(issue.id)) {
        existingNewIssues.push(item)
        existingIssueIds.add(issue.id)
        newIssuesAdded++
      }
    }
  })
  
  // 只更新new_issues和new_prs字段
  const { error: updateError } = await supabase
    .from('week_analysis')
    .update({
      new_issues: existingNewIssues,
      new_prs: existingNewPRs,
      updated_at: new Date().toISOString()
    })
    .eq('period_start', periodStartStr)
  
  if (updateError) {
    throw updateError
  }
  
  return {
    newIssues: existingNewIssues,
    newPRs: existingNewPRs,
    counts: {
      issues: newIssuesAdded,
      prs: newPRsAdded,
      totalIssues: existingNewIssues.length,
      totalPRs: existingNewPRs.length
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const { repo } = await request.json()
    
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
    
    const repoId = repoData.id
    
    // 获取所有issues的创建时间范围
    const { data: timeRange, error: timeError } = await supabase
      .from('github_issues')
      .select('created_at')
      .eq('repo_id', repoId)
      .order('created_at', { ascending: true })
      .limit(1)
    
    const { data: timeRangeEnd, error: timeErrorEnd } = await supabase
      .from('github_issues')
      .select('created_at')
      .eq('repo_id', repoId)
      .order('created_at', { ascending: false })
      .limit(1)
    
    if (timeError || timeErrorEnd || !timeRange || !timeRangeEnd || timeRange.length === 0 || timeRangeEnd.length === 0) {
      return NextResponse.json({ error: 'No issues found for this repository' }, { status: 404 })
    }
    
    const startDate = new Date(timeRange[0].created_at)
    const endDate = new Date(timeRangeEnd[0].created_at)
    
    let processedCount = 0
    let weeksCreated = 0
    
    // 遍历从最早到最晚的每个月
    const current = new Date(startDate.getFullYear(), startDate.getMonth(), 1)
    const end = new Date(endDate.getFullYear(), endDate.getMonth() + 1, 0)
    
    while (current <= end) {
      const year = current.getFullYear()
      const month = current.getMonth() + 1
      
      // 获取这个月的周期划分
      const periods = getWeekPeriods(year, month)
      
      for (const period of periods) {
        // 确保周期记录存在
        const created = await ensureWeekRecord(period.start, period.end)
        if (created) {
          weeksCreated++
        }
        
        // 处理这个周期的数据
        const result = await processWeekData(repoId, period.start, period.end)
        processedCount += result.counts.issues + result.counts.prs
        
        console.log(`Processed period ${period.start.toISOString().split('T')[0]} to ${period.end.toISOString().split('T')[0]}: +${result.counts.issues} new issues, +${result.counts.prs} new PRs (total: ${result.counts.totalIssues} issues, ${result.counts.totalPRs} PRs)`)
      }
      
      // 移动到下一个月
      current.setMonth(current.getMonth() + 1)
    }
    
    return NextResponse.json({
      success: true,
      processedCount,
      weeksCreated,
      message: `Successfully analyzed historical data for ${repo}`
    })
    
  } catch (error) {
    console.error('Error in analyze-historical-data API:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}