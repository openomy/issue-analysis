import { NextResponse } from 'next/server'
import { supabase } from '../../../../lib/supabase'

export async function GET() {
  try {
    // Get total count
    const { count: totalCount, error: countError } = await supabase
      .from('github_issues')
      .select('*', { count: 'exact', head: true })

    if (countError) {
      console.error('Error fetching total count:', countError)
      return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })
    }

    // Get counts by state
    const { count: openCount, error: openError } = await supabase
      .from('github_issues')
      .select('*', { count: 'exact', head: true })
      .eq('state', 'open')

    const { count: closedCount, error: closedError } = await supabase
      .from('github_issues')
      .select('*', { count: 'exact', head: true })
      .eq('state', 'closed')

    const { count: prCount, error: prError } = await supabase
      .from('github_issues')
      .select('*', { count: 'exact', head: true })
      .eq('is_pull_request', true)

    if (openError || closedError || prError) {
      console.error('Error fetching counts:', { openError, closedError, prError })
      return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })
    }

    // Get sample data for labels and repos aggregation (with limit for performance)
    const { data: issues, error } = await supabase
      .from('github_issues')
      .select(`
        labels,
        github_repos (
          full_name
        )
      `)
      .limit(10000)

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