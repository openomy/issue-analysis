import { redis } from '../../../../lib/upstash'
import { supabase } from '../../../../lib/supabase'

export async function POST() {
  try {
    // Get all items from the queue
    const queueItems = await redis.lrange('github:issues:queue', 0, -1)
    
    if (queueItems.length === 0) {
      return Response.json({ 
        success: true, 
        message: 'Queue is empty',
        removedCount: 0,
        remainingCount: 0
      })
    }

    // Get all synced issue URLs from database
    const { data: syncedIssues, error } = await supabase
      .from('github_issues')
      .select('url')

    if (error) {
      throw error
    }

    // Convert synced URLs to queue key format
    const syncedKeys = new Set<string>()
    
    if (syncedIssues) {
      for (const issue of syncedIssues) {
        // URL format: https://api.github.com/repos/owner/repo/issues/number
        const urlMatch = issue.url.match(/\/repos\/([^\/]+)\/([^\/]+)\/issues\/(\d+)$/)
        if (urlMatch) {
          const [, owner, repo, issueNumber] = urlMatch
          const key = `${owner}:${repo}:${issueNumber}`
          syncedKeys.add(key)
        }
      }
    }

    // Filter out synced items from queue
    const itemsToKeep = queueItems.filter(item => !syncedKeys.has(item as string))
    const removedCount = queueItems.length - itemsToKeep.length

    // Clear queue and repopulate with remaining items
    await redis.del('github:issues:queue')
    
    if (itemsToKeep.length > 0) {
      await redis.rpush('github:issues:queue', ...itemsToKeep)
    }

    return Response.json({ 
      success: true, 
      message: `Removed ${removedCount} already synced items from queue`,
      removedCount,
      remainingCount: itemsToKeep.length
    })
  } catch (error) {
    console.error('Error cleaning synced items from queue:', error)
    return Response.json({ 
      success: false, 
      error: 'Failed to clean synced items from queue' 
    }, { status: 500 })
  }
}

export async function GET() {
  try {
    // Get queue status
    const queueLength = await redis.llen('github:issues:queue')
    const queueItems = queueLength > 0 ? await redis.lrange('github:issues:queue', 0, -1) : []
    
    // Group by repository
    const repoStats: { [key: string]: number } = {}
    
    for (const item of queueItems) {
      const [owner, repo] = (item as string).split(':')
      const repoKey = `${owner}/${repo}`
      repoStats[repoKey] = (repoStats[repoKey] || 0) + 1
    }

    return Response.json({
      success: true,
      totalCount: queueLength,
      repoStats
    })
  } catch (error) {
    console.error('Error getting queue status:', error)
    return Response.json({ 
      success: false, 
      error: 'Failed to get queue status' 
    }, { status: 500 })
  }
}