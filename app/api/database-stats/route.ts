import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '../../../lib/supabase'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const repo = searchParams.get('repo')
  
  try {
    let query = `
      id,
      repo_id,
      github_repos!inner(full_name)
    `
    
    // Get total issues for the repository or all repositories
    let issuesQuery = supabase
      .from('github_issues')
      .select(query, { count: 'exact' })
    
    if (repo) {
      issuesQuery = issuesQuery.eq('github_repos.full_name', repo)
    }
    
    const { count: totalIssues, error: issuesError } = await issuesQuery
    
    if (issuesError) {
      console.error('Error fetching issues:', issuesError)
      return NextResponse.json({ error: 'Failed to fetch issues' }, { status: 500 })
    }

    // Get issues that have analysis in issue_label table
    let analyzedQuery = supabase
      .from('github_issues')
      .select(`
        id,
        github_repos!inner(full_name),
        issue_label!inner(issue_id)
      `, { count: 'exact' })
    
    if (repo) {
      analyzedQuery = analyzedQuery.eq('github_repos.full_name', repo)
    }
    
    const { count: analyzedIssues, error: analyzedError } = await analyzedQuery
    
    if (analyzedError) {
      console.error('Error fetching analyzed issues:', analyzedError)
      return NextResponse.json({ error: 'Failed to fetch analyzed issues' }, { status: 500 })
    }

    // Get repository list for context
    let repoData = null
    if (repo) {
      const { data: repoInfo, error: repoError } = await supabase
        .from('github_repos')
        .select('id, full_name, name, owner')
        .eq('full_name', repo)
        .single()
      
      if (repoError) {
        console.error('Error fetching repo info:', repoError)
      } else {
        repoData = repoInfo
      }
    }

    const result = {
      repository: repo || 'All repositories',
      repositoryInfo: repoData,
      totalIssues: totalIssues || 0,
      analyzedIssues: analyzedIssues || 0,
      unanalyzedIssues: (totalIssues || 0) - (analyzedIssues || 0),
      analysisCompletePercentage: totalIssues ? Math.round(((analyzedIssues || 0) / totalIssues) * 100) : 0,
      timestamp: new Date().toISOString()
    }

    return NextResponse.json(result)

  } catch (error) {
    console.error('Error in database stats API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}