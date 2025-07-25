import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '../../../lib/supabase'

export async function GET() {
  try {
    // Get all repositories with issue counts
    const { data: repos, error: reposError } = await supabase
      .from('github_repos')
      .select(`
        id,
        full_name,
        name,
        owner,
        description,
        stars,
        forks,
        language,
        created_at,
        updated_at
      `)
      .order('stars', { ascending: false })
    
    if (reposError) {
      console.error('Error fetching repos:', reposError)
      return NextResponse.json({ error: 'Failed to fetch repositories' }, { status: 500 })
    }

    // Get issue counts for each repository
    const reposWithCounts = await Promise.all(
      repos.map(async (repo) => {
        // Total issues
        const { count: totalIssues } = await supabase
          .from('github_issues')
          .select('*', { count: 'exact', head: true })
          .eq('repo_id', repo.id)
        
        // Analyzed issues
        const { count: analyzedIssues } = await supabase
          .from('github_issues')
          .select(`
            id,
            issue_label!inner(issue_id)
          `, { count: 'exact', head: true })
          .eq('repo_id', repo.id)
        
        return {
          ...repo,
          totalIssues: totalIssues || 0,
          analyzedIssues: analyzedIssues || 0,
          unanalyzedIssues: (totalIssues || 0) - (analyzedIssues || 0),
          analysisCompletePercentage: totalIssues ? Math.round(((analyzedIssues || 0) / totalIssues) * 100) : 0
        }
      })
    )

    // Sort by total issues descending
    reposWithCounts.sort((a, b) => b.totalIssues - a.totalIssues)

    return NextResponse.json({
      repositories: reposWithCounts,
      totalRepositories: reposWithCounts.length,
      summary: {
        totalIssues: reposWithCounts.reduce((sum, repo) => sum + repo.totalIssues, 0),
        totalAnalyzed: reposWithCounts.reduce((sum, repo) => sum + repo.analyzedIssues, 0),
        totalUnanalyzed: reposWithCounts.reduce((sum, repo) => sum + repo.unanalyzedIssues, 0)
      }
    })

  } catch (error) {
    console.error('Error in repos list API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}