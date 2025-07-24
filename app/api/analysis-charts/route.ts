import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '../../../lib/supabase'

export interface ChartData {
  openIssues: number
  closedIssues: number
  openPRs: number
  closedPRs: number
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const repo = searchParams.get('repo')
  
  try {
    // First get the repo_id for this repository
    let repoId: number | null = null
    if (repo) {
      const { data: repoData, error: repoError } = await supabase
        .from('github_repos')
        .select('id')
        .eq('full_name', repo)
        .single()
      
      if (repoError || !repoData) {
        return NextResponse.json({
          openIssues: 0,
          closedIssues: 0,
          openPRs: 0,
          closedPRs: 0
        })
      }
      
      repoId = repoData.id
    }
    
    // Get open issues count (not PRs)
    let openIssuesQuery = supabase
      .from('github_issues')
      .select('*', { count: 'exact', head: true })
      .eq('state', 'open')
      .eq('is_pull_request', false)
    
    if (repoId) {
      openIssuesQuery = openIssuesQuery.eq('repo_id', repoId)
    }
    
    const { count: openIssuesCount } = await openIssuesQuery
    
    // Get closed issues count (not PRs)
    let closedIssuesQuery = supabase
      .from('github_issues')
      .select('*', { count: 'exact', head: true })
      .eq('state', 'closed')
      .eq('is_pull_request', false)
    
    if (repoId) {
      closedIssuesQuery = closedIssuesQuery.eq('repo_id', repoId)
    }
    
    const { count: closedIssuesCount } = await closedIssuesQuery
    
    // Get open PRs count
    let openPRsQuery = supabase
      .from('github_issues')
      .select('*', { count: 'exact', head: true })
      .eq('state', 'open')
      .eq('is_pull_request', true)
    
    if (repoId) {
      openPRsQuery = openPRsQuery.eq('repo_id', repoId)
    }
    
    const { count: openPRsCount } = await openPRsQuery
    
    // Get closed PRs count
    let closedPRsQuery = supabase
      .from('github_issues')
      .select('*', { count: 'exact', head: true })
      .eq('state', 'closed')
      .eq('is_pull_request', true)
    
    if (repoId) {
      closedPRsQuery = closedPRsQuery.eq('repo_id', repoId)
    }
    
    const { count: closedPRsCount } = await closedPRsQuery
    
    const chartData: ChartData = {
      openIssues: openIssuesCount || 0,
      closedIssues: closedIssuesCount || 0,
      openPRs: openPRsCount || 0,
      closedPRs: closedPRsCount || 0
    }
    
    return NextResponse.json(chartData)
  } catch (error) {
    console.error('Error in analysis-charts API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}