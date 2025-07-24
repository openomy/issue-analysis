import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '../../../../lib/supabase'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const repo = searchParams.get('repo')
  try {
    // For repo filtering, we need to use joins properly
    let repoId: number | null = null
    if (repo) {
      // First get the repo_id for this repository
      const { data: repoData, error: repoError } = await supabase
        .from('github_repos')
        .select('id')
        .eq('full_name', repo)
        .single()
      
      if (repoError || !repoData) {
        return NextResponse.json({
          total: 0,
          open: 0,
          closed: 0,
          pull_requests: 0,
          by_label: {},
          by_repo: {}
        })
      }
      
      repoId = repoData.id
    }

    // Get total count
    let totalQuery = supabase
      .from('github_issues')
      .select('*', { count: 'exact', head: true })
    
    if (repoId) {
      totalQuery = totalQuery.eq('repo_id', repoId)
    }

    const { count: totalCount, error: countError } = await totalQuery

    if (countError) {
      console.error('Error fetching total count:', countError)
      return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })
    }

    // Get counts by state
    let openQuery = supabase
      .from('github_issues')
      .select('*', { count: 'exact', head: true })
      .eq('state', 'open')
    
    if (repoId) {
      openQuery = openQuery.eq('repo_id', repoId)
    }

    const { count: openCount, error: openError } = await openQuery

    let closedQuery = supabase
      .from('github_issues')
      .select('*', { count: 'exact', head: true })
      .eq('state', 'closed')
    
    if (repoId) {
      closedQuery = closedQuery.eq('repo_id', repoId)
    }

    const { count: closedCount, error: closedError } = await closedQuery

    let prQuery = supabase
      .from('github_issues')
      .select('*', { count: 'exact', head: true })
      .eq('is_pull_request', true)
    
    if (repoId) {
      prQuery = prQuery.eq('repo_id', repoId)
    }

    const { count: prCount, error: prError } = await prQuery

    if (openError || closedError || prError) {
      console.error('Error fetching counts:', { openError, closedError, prError })
      return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })
    }

    // Get sample data for labels and repos aggregation (with limit for performance)
    let issuesQuery = supabase
      .from('github_issues')
      .select(`
        labels,
        github_repos (
          full_name
        )
      `)
      .limit(10000)
    
    if (repoId) {
      issuesQuery = issuesQuery.eq('repo_id', repoId)
    }

    const { data: issues, error } = await issuesQuery

    if (error) {
      console.error('Error fetching issue data for aggregation:', error)
      return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })
    }

    const stats = {
      total: totalCount || 0,
      open: openCount || 0,
      closed: closedCount || 0,
      pull_requests: prCount || 0,
      by_label: {} as { [key: string]: number },
      by_repo: {} as { [key: string]: number }
    }

    issues.forEach(issue => {
      const repoName = (issue as any).github_repos?.full_name
      if (repoName) {
        stats.by_repo[repoName] = (stats.by_repo[repoName] || 0) + 1
      }

      if (issue.labels && Array.isArray(issue.labels)) {
        issue.labels.forEach((label: any) => {
          if (label.name) {
            stats.by_label[label.name] = (stats.by_label[label.name] || 0) + 1
          }
        })
      }
    })

    return NextResponse.json(stats)
  } catch (error) {
    console.error('Error in stats API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}