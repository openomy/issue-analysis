import { redis } from '../../../../lib/upstash'

export async function POST() {
  try {
    // Get all items from the queue
    const queueItems = await redis.lrange('github:issues:queue', 0, -1)
    
    if (queueItems.length === 0) {
      return Response.json({ 
        success: true, 
        message: 'Queue is empty',
        removedCount: 0
      })
    }

    // Find duplicates
    const uniqueItems = Array.from(new Set(queueItems))
    const duplicateCount = queueItems.length - uniqueItems.length

    if (duplicateCount === 0) {
      return Response.json({ 
        success: true, 
        message: 'No duplicates found',
        removedCount: 0
      })
    }

    // Clear the queue and repopulate with unique items
    await redis.del('github:issues:queue')
    
    if (uniqueItems.length > 0) {
      await redis.rpush('github:issues:queue', ...uniqueItems)
    }

    return Response.json({ 
      success: true, 
      message: `Removed ${duplicateCount} duplicate items`,
      removedCount: duplicateCount,
      remainingCount: uniqueItems.length
    })
  } catch (error) {
    console.error('Error deduplicating queue:', error)
    return Response.json({ 
      success: false, 
      error: 'Failed to deduplicate queue' 
    }, { status: 500 })
  }
}