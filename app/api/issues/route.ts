import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '../../../lib/supabase'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  
  const state = searchParams.get('state')
  const label = searchParams.get('label')
  const repo = searchParams.get('repo')
  const author = searchParams.get('author')
  const search = searchParams.get('search') // 新增搜索参数
  const page = parseInt(searchParams.get('page') || '1')
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100) // 限制最大100条
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

    // 添加搜索功能 - 在标题、内容或作者中搜索
    if (search) {
      query = query.or(`title.ilike.%${search}%,body.ilike.%${search}%,author.ilike.%${search}%`)
    }

    const { data: issues, error } = await query

    if (error) {
      console.error('Error fetching issues:', error)
      return NextResponse.json({ error: 'Failed to fetch issues' }, { status: 500 })
    }

    // 构建计数查询，应用相同的过滤条件
    let countQuery = supabase
      .from('github_issues')
      .select('*', { count: 'exact', head: true })

    if (state && state !== 'all') {
      countQuery = countQuery.eq('state', state)
    }

    if (label) {
      countQuery = countQuery.contains('labels', [{ name: label }])
    }

    if (repo) {
      countQuery = countQuery.eq('github_repos.full_name', repo)
    }

    if (author) {
      countQuery = countQuery.eq('author', author)
    }

    if (search) {
      countQuery = countQuery.or(`title.ilike.%${search}%,body.ilike.%${search}%,author.ilike.%${search}%`)
    }

    const { count: totalCount } = await countQuery

    return NextResponse.json({
      data: issues,
      pagination: {
        page,
        limit,
        total: totalCount || 0,
        hasNext: offset + limit < (totalCount || 0),
        hasPrev: page > 1,
        totalPages: Math.ceil((totalCount || 0) / limit)
      }
    })

  } catch (error) {
    console.error('Error in issues API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}