import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '../../../lib/supabase'
import { GitHubIssue } from '../../../types'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  
  const state = searchParams.get('state')
  const label = searchParams.get('label')
  const repo = searchParams.get('repo')
  const author = searchParams.get('author')
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '50')
  const offset = (page - 1) * limit

  try {
    let query = supabase
      .from('github_issues')
      .select(`
        *,
        github_repos (
          name,
          full_name,
          owner,
          html_url
        )
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (state && state !== 'all') {
      query = query.eq('state', state)
    }

    if (label) {
      query = query.contains('labels', [{ name: label }])
    }

    if (repo) {
      query = query.eq('github_repos.full_name', repo)
    }

    if (author) {
      query = query.eq('author', author)
    }

    const { data: issues, error } = await query

    if (error) {
      console.error('Error fetching issues:', error)
      return NextResponse.json({ error: 'Failed to fetch issues' }, { status: 500 })
    }

    const { data: countData, error: countError } = await supabase
      .from('github_issues')
      .select('*', { count: 'exact', head: true })

    const totalCount = countData?.length || 0

    return NextResponse.json({
      data: issues,
      pagination: {
        page,
        limit,
        total: totalCount,
        hasNext: offset + limit < totalCount,
        hasPrev: page > 1
      }
    })

  } catch (error) {
    console.error('Error in issues API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}