import { redis } from '../../../../lib/upstash'
import { supabase } from '../../../../lib/supabase'
import { syncOneIssue } from '../../../../lib/sync-issue'

export async function POST() {
  try {
    // Check if there are items in the queue
    const queueLength = await redis.llen('github:issues:queue')
    if (queueLength === 0) {
      return Response.json({ 
        success: true, 
        message: 'No issues in queue',
        synced: false
      })
    }

    // Peek at the next item without removing it
    const nextItem = await redis.lindex('github:issues:queue', 0)
    if (!nextItem) {
      return Response.json({ 
        success: true, 
        message: 'No issues in queue',
        synced: false
      })
    }

    const [owner, repo, issueNumber] = (nextItem as string).split(':')
    
    // Check if this issue already exists in database
    const { data: existingIssue } = await supabase
      .from('github_issues')
      .select('id')
      .eq('url', `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}`)
      .single()

    if (existingIssue) {
      // Issue exists, remove from queue without syncing
      await redis.lpop('github:issues:queue')
      return Response.json({ 
        success: true, 
        message: `Issue ${owner}/${repo}#${issueNumber} already exists, skipped`,
        synced: false,
        skipped: true
      })
    }

    // Issue doesn't exist, sync it
    const result = await syncOneIssue()
    
    return Response.json({ 
      success: true, 
      message: result ? `Synced issue ${owner}/${repo}#${issueNumber}` : 'No issues to sync',
      synced: result
    })
  } catch (error) {
    console.error('Error in smart sync:', error)
    return Response.json({ 
      success: false, 
      error: 'Failed to smart sync' 
    }, { status: 500 })
  }
}