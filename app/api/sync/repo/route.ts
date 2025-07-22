import { NextRequest, NextResponse } from 'next/server'
import { addRepoIssuesToQueue } from '../../../../lib/sync-issue'

export async function POST(request: NextRequest) {
  try {
    const { owner, repo } = await request.json()
    
    if (!owner || !repo) {
      return NextResponse.json({ 
        success: false, 
        error: 'Owner and repo are required' 
      }, { status: 400 })
    }

    await addRepoIssuesToQueue(owner, repo)
    
    return NextResponse.json({ 
      success: true, 
      message: `Added issues from ${owner}/${repo} to sync queue` 
    })
  } catch (error) {
    console.error('Error in repo sync API:', error)
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to add repo issues to queue' 
    }, { status: 500 })
  }
}