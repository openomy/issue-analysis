import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { redis } from '../../../lib/upstash'

// Helper function to safely parse Redis data
function safeJsonParse(data: any): any | null {
  if (!data) return null
  
  try {
    // Handle different data types that Redis might return
    let jsonString: string
    
    if (typeof data === 'string') {
      jsonString = data
    } else if (Buffer.isBuffer(data)) {
      jsonString = data.toString('utf-8')
    } else if (typeof data === 'object') {
      // If it's already an object, return it directly
      return data
    } else {
      jsonString = String(data)
    }
    
    return JSON.parse(jsonString)
  } catch (error) {
    console.error('Failed to parse JSON data:', error, 'Original data:', data, 'Data type:', typeof data)
    return null
  }
}

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
)

// Function to get all issues using pagination
async function getAllIssues(repo: string) {
  console.log(`🔍 [GET-ALL-ISSUES] Starting to fetch all issues for repo: ${repo}`)
  const allIssues = []
  let page = 0
  const pageSize = 1000

  while (true) {
    console.log(`📄 [GET-ALL-ISSUES] Fetching page ${page + 1} (${page * pageSize} - ${(page + 1) * pageSize - 1})`)
    
    const { data, error } = await supabase
      .from('github_issues')
      .select(`
        id,
        title,
        body,
        is_pull_request,
        github_repos!inner(full_name)
      `)
      .eq('github_repos.full_name', repo)
      .range(page * pageSize, (page + 1) * pageSize - 1)

    if (error) {
      console.error(`💥 [GET-ALL-ISSUES] Error on page ${page + 1}:`, error)
      throw error
    }
    
    if (!data || data.length === 0) {
      console.log(`✅ [GET-ALL-ISSUES] No more data on page ${page + 1}, stopping`)
      break
    }

    console.log(`📊 [GET-ALL-ISSUES] Page ${page + 1} returned ${data.length} issues`)
    allIssues.push(...data)
    page++
  }

  console.log(`🎉 [GET-ALL-ISSUES] Total issues fetched: ${allIssues.length}`)
  return allIssues
}

// Queue key for batch analysis
const BATCH_QUEUE_KEY = 'batch:analysis:queue'
const BATCH_STATUS_KEY = 'batch:analysis:status'

export async function POST(request: NextRequest) {
  try {
    const { repo, action } = await request.json()

    if (!repo) {
      return NextResponse.json(
        { error: 'Repository parameter is required' },
        { status: 400 }
      )
    }

    switch (action) {
      case 'start':
        return await startBatchAnalysis(repo)
      case 'status':
        return await getBatchStatus(repo)
      case 'cancel':
        return await cancelBatchAnalysis(repo)
      case 'pause':
        return await pauseBatchAnalysis(repo)
      case 'resume':
        return await resumeBatchAnalysis(repo)
      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: start, status, cancel, pause, or resume' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Batch analysis error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

async function startBatchAnalysis(repo: string) {
  try {
    console.log(`🚀 [BATCH-START] Starting batch analysis for repo: ${repo}`)
    
    // Check if batch analysis is already running
    const currentStatus = await redis.get(`${BATCH_STATUS_KEY}:${repo}`)
    const parsedStatus = safeJsonParse(currentStatus)
    console.log(`📊 [BATCH-START] Current status check:`, parsedStatus)
    
    if (parsedStatus && parsedStatus.status === 'running') {
      console.log(`⚠️ [BATCH-START] Batch analysis already running for ${repo}`)
      return NextResponse.json({
        error: 'Batch analysis is already running for this repository'
      }, { status: 409 })
    }


    // Get ALL issues for this repository using pagination
    console.log(`🔍 [BATCH-START] Querying database for repo: ${repo}`)
    
    let allIssues
    try {
      allIssues = await getAllIssues(repo)
    } catch (issuesError) {
      console.error('💥 [BATCH-START] Database error:', issuesError)
      return NextResponse.json(
        { error: 'Failed to fetch issues from database' },
        { status: 500 }
      )
    }

    const issuesCount = allIssues.length
    console.log(`📈 [BATCH-START] Found ${issuesCount} issues in database for repo: ${repo}`)
    console.log(`📋 [BATCH-START] Sample issues:`, allIssues?.slice(0, 2)?.map(i => ({ id: i.id, title: i.title })))

    if (issuesCount === 0) {
      console.log(`❌ [BATCH-START] No issues found for repo: ${repo}`)
      return NextResponse.json({
        message: 'No issues found for this repository',
        processedCount: 0,
        totalCount: 0
      })
    }

    // Clear existing queue for this repo
    console.log(`🧹 [BATCH-START] Clearing existing queue for repo: ${repo}`)
    await redis.del(`${BATCH_QUEUE_KEY}:${repo}`)

    // Add ALL issues to the batch analysis queue in batches to avoid Redis size limits
    console.log(`📦 [BATCH-START] Creating queue items for ${issuesCount} issues`)
    const queueItems = allIssues.map(issue => JSON.stringify({
      issue_id: issue.id,
      issue_number: issue.number,
      title: issue.title,
      body: issue.body || '',
      html_url: issue.html_url,
      is_pull_request: issue.is_pull_request,
      repo: repo
    }))

    // Add items to queue in batches to avoid Upstash size limits (10MB)
    const batchSize = 500 // Smaller batch size to be safe
    console.log(`📤 [BATCH-START] Adding ${queueItems.length} items to Redis queue in batches of ${batchSize}`)
    
    for (let i = 0; i < queueItems.length; i += batchSize) {
      const batch = queueItems.slice(i, i + batchSize)
      const batchNumber = Math.floor(i / batchSize) + 1
      const totalBatches = Math.ceil(queueItems.length / batchSize)
      
      console.log(`📦 [BATCH-START] Adding batch ${batchNumber}/${totalBatches} (${batch.length} items)`)
      
      try {
        await redis.rpush(`${BATCH_QUEUE_KEY}:${repo}`, ...batch)
        console.log(`✅ [BATCH-START] Successfully added batch ${batchNumber}/${totalBatches}`)
      } catch (error) {
        console.error(`💥 [BATCH-START] Failed to add batch ${batchNumber}:`, error)
        throw error
      }
    }
    
    console.log(`🎉 [BATCH-START] Successfully added all ${queueItems.length} items to queue`)

    // Set initial status
    const initialStatus = {
      status: 'running',
      startTime: new Date().toISOString(),
      totalCount: issuesCount,
      processedCount: 0,
      successCount: 0,
      errorCount: 0,
      currentIssue: null,
      errors: []
    }

    console.log(`💾 [BATCH-START] Setting initial status:`, initialStatus)
    await redis.set(
      `${BATCH_STATUS_KEY}:${repo}`,
      JSON.stringify(initialStatus),
      { ex: 86400 } // Expire after 24 hours
    )

    // Start processing in background
    console.log(`🏃 [BATCH-START] Starting background processing for ${repo}`)
    processBatchQueue(repo)

    const response = {
      message: 'Batch analysis started successfully',
      totalCount: issuesCount,
      queueLength: queueItems.length
    }
    console.log(`📤 [BATCH-START] Returning response:`, response)
    return NextResponse.json(response)

  } catch (error) {
    console.error('Start batch analysis error:', error)
    return NextResponse.json(
      { error: 'Failed to start batch analysis' },
      { status: 500 }
    )
  }
}

async function getBatchStatus(repo: string) {
  try {
    console.log(`📊 [BATCH-STATUS] Getting status for repo: ${repo}`)
    const statusData = await redis.get(`${BATCH_STATUS_KEY}:${repo}`)
    
    if (!statusData) {
      console.log(`❌ [BATCH-STATUS] No status data found for repo: ${repo}`)
      return NextResponse.json({
        status: 'not_started',
        message: 'No batch analysis found for this repository'
      })
    }

    const status = safeJsonParse(statusData)
    if (!status) {
      console.log(`💥 [BATCH-STATUS] Failed to parse status data for repo: ${repo}`)
      return NextResponse.json({
        status: 'error',
        message: 'Failed to parse status data'
      })
    }
    
    const queueLength = await redis.llen(`${BATCH_QUEUE_KEY}:${repo}`)
    
    // Get real success count from database using JOIN query
    console.log(`🔍 [BATCH-STATUS] Querying real success count from database for repo: ${repo}`)
    
    try {
      // Use JOIN to count analyzed issues for this repo directly
      const { count: realSuccessCount, error: countError } = await supabase
        .from('issue_label')
        .select('issue_id, github_issues!inner(github_repos!inner(full_name))', { count: 'exact', head: true })
        .eq('github_issues.github_repos.full_name', repo)
      
      if (countError) {
        console.error('❌ [BATCH-STATUS] Error querying success count:', countError)
        // Fall back to status data if database query fails
      } else {
        console.log(`✅ [BATCH-STATUS] Real success count from database: ${realSuccessCount}`)
        // Update status with real success count
        status.successCount = realSuccessCount || 0
        // Calculate processedCount based on queue progress
        status.processedCount = status.totalCount - queueLength
        status.errorCount = Math.max(0, status.processedCount - status.successCount)
      }
    } catch (dbError) {
      console.error('❌ [BATCH-STATUS] Database query error:', dbError)
      // Fall back to status data if database query fails
    }
    
    console.log(`📈 [BATCH-STATUS] Status for ${repo}:`, { 
      status: status.status, 
      totalCount: status.totalCount, 
      processedCount: status.processedCount,
      successCount: status.successCount,
      errorCount: status.errorCount,
      remainingCount: queueLength 
    })

    return NextResponse.json({
      ...status,
      remainingCount: queueLength
    })

  } catch (error) {
    console.error('Get batch status error:', error)
    return NextResponse.json(
      { error: 'Failed to get batch status' },
      { status: 500 }
    )
  }
}

async function cancelBatchAnalysis(repo: string) {
  try {
    // Clear the queue
    await redis.del(`${BATCH_QUEUE_KEY}:${repo}`)
    
    // Update status to cancelled
    const currentStatus = await redis.get(`${BATCH_STATUS_KEY}:${repo}`)
    if (currentStatus) {
      const status = safeJsonParse(currentStatus)
      if (status) {
        status.status = 'cancelled'
        status.endTime = new Date().toISOString()
        
        await redis.set(
          `${BATCH_STATUS_KEY}:${repo}`,
          JSON.stringify(status),
          { ex: 3600 } // Keep cancelled status for 1 hour
        )
      } else {
        // Just set a basic cancelled status if parsing failed
        await redis.set(
          `${BATCH_STATUS_KEY}:${repo}`,
          JSON.stringify({
            status: 'cancelled',
            endTime: new Date().toISOString()
          }),
          { ex: 3600 }
        )
      }
    }

    return NextResponse.json({
      message: 'Batch analysis cancelled successfully'
    })

  } catch (error) {
    console.error('Cancel batch analysis error:', error)
    return NextResponse.json(
      { error: 'Failed to cancel batch analysis' },
      { status: 500 }
    )
  }
}

async function pauseBatchAnalysis(repo: string) {
  try {
    console.log(`⏸️ [BATCH-PAUSE] Pausing batch analysis for repo: ${repo}`)
    
    // Get current status
    const currentStatus = await redis.get(`${BATCH_STATUS_KEY}:${repo}`)
    if (!currentStatus) {
      return NextResponse.json({
        error: 'No batch analysis found for this repository'
      }, { status: 404 })
    }

    const status = safeJsonParse(currentStatus)
    if (!status) {
      return NextResponse.json({
        error: 'Failed to parse status data'
      }, { status: 500 })
    }

    // Only allow pausing if currently running
    if (status.status !== 'running') {
      return NextResponse.json({
        error: `Cannot pause analysis in status: ${status.status}`
      }, { status: 400 })
    }

    // Update status to paused
    status.status = 'paused'
    status.pausedAt = new Date().toISOString()
    
    await redis.set(
      `${BATCH_STATUS_KEY}:${repo}`,
      JSON.stringify(status),
      { ex: 86400 } // Keep status for 24 hours
    )
    
    console.log(`✅ [BATCH-PAUSE] Successfully paused batch analysis for: ${repo}`)
    
    return NextResponse.json({
      message: 'Batch analysis paused successfully',
      processedCount: status.processedCount,
      totalCount: status.totalCount,
      remainingCount: await redis.llen(`${BATCH_QUEUE_KEY}:${repo}`)
    })

  } catch (error) {
    console.error('Pause batch analysis error:', error)
    return NextResponse.json(
      { error: 'Failed to pause batch analysis' },
      { status: 500 }
    )
  }
}

async function resumeBatchAnalysis(repo: string) {
  try {
    console.log(`▶️ [BATCH-RESUME] Resuming batch analysis for repo: ${repo}`)
    
    // Get current status
    const currentStatus = await redis.get(`${BATCH_STATUS_KEY}:${repo}`)
    if (!currentStatus) {
      return NextResponse.json({
        error: 'No batch analysis found for this repository'
      }, { status: 404 })
    }

    const status = safeJsonParse(currentStatus)
    if (!status) {
      return NextResponse.json({
        error: 'Failed to parse status data'
      }, { status: 500 })
    }

    // Only allow resuming if currently paused
    if (status.status !== 'paused') {
      return NextResponse.json({
        error: `Cannot resume analysis in status: ${status.status}`
      }, { status: 400 })
    }

    // Check if there are still items in queue
    const queueLength = await redis.llen(`${BATCH_QUEUE_KEY}:${repo}`)
    if (queueLength === 0) {
      // No items left, mark as completed
      status.status = 'completed'
      status.endTime = new Date().toISOString()
      
      await redis.set(
        `${BATCH_STATUS_KEY}:${repo}`,
        JSON.stringify(status),
        { ex: 3600 }
      )
      
      return NextResponse.json({
        message: 'No remaining items to process. Analysis marked as completed.',
        processedCount: status.processedCount,
        totalCount: status.totalCount
      })
    }

    // Update status to running
    status.status = 'running'
    status.resumedAt = new Date().toISOString()
    
    await redis.set(
      `${BATCH_STATUS_KEY}:${repo}`,
      JSON.stringify(status),
      { ex: 86400 }
    )
    
    // Restart background processing
    console.log(`🔄 [BATCH-RESUME] Restarting background processing for: ${repo}`)
    processBatchQueue(repo)
    
    console.log(`✅ [BATCH-RESUME] Successfully resumed batch analysis for: ${repo}`)
    
    return NextResponse.json({
      message: 'Batch analysis resumed successfully',
      processedCount: status.processedCount,
      totalCount: status.totalCount,
      remainingCount: queueLength
    })

  } catch (error) {
    console.error('Resume batch analysis error:', error)
    return NextResponse.json(
      { error: 'Failed to resume batch analysis' },
      { status: 500 }
    )
  }
}

// Background processing function
async function processBatchQueue(repo: string) {
  console.log(`🔄 [BATCH-PROCESS] Starting background processing for repo: ${repo}`)
  const maxRetries = 3
  const delayBetweenRequests = 1000 // 1 second delay between API calls
  let processedInThisBatch = 0
  const logInterval = 10 // Log progress every 10 items

  while (true) {
    try {
      // Check if process should continue
      const statusData = await redis.get(`${BATCH_STATUS_KEY}:${repo}`)
      if (!statusData) {
        console.log(`❌ [BATCH-PROCESS] No status data found, stopping processing for: ${repo}`)
        break
      }

      const status = safeJsonParse(statusData)
      if (!status) {
        console.error('💥 [BATCH-PROCESS] Failed to parse status data, stopping batch processing')
        break
      }
      if (status.status === 'paused') {
        console.log(`⏸️ [BATCH-PROCESS] Status is paused, stopping processing for: ${repo}`)
        console.log(`📊 [BATCH-PROCESS] Paused at: ${status.processedCount}/${status.totalCount} processed`)
        break
      } else if (status.status !== 'running') {
        console.log(`⏹️ [BATCH-PROCESS] Status is ${status.status}, stopping processing for: ${repo}`)
        break
      }

      // Get next item from queue
      const queueItem = await redis.lpop(`${BATCH_QUEUE_KEY}:${repo}`)
      if (!queueItem) {
        // Queue is empty, mark as completed
        console.log(`✅ [BATCH-PROCESS] Queue is empty, marking as completed for: ${repo}`)
        status.status = 'completed'
        status.endTime = new Date().toISOString()
        await redis.set(`${BATCH_STATUS_KEY}:${repo}`, JSON.stringify(status), { ex: 3600 })
        console.log(`🎉 [BATCH-PROCESS] Batch processing completed for: ${repo}`)
        break
      }

      const issue = safeJsonParse(queueItem)
      if (!issue) {
        console.error('💥 [BATCH-PROCESS] Failed to parse queue item, skipping:', queueItem)
        continue
      }
      
      processedInThisBatch++
      
      // Only log every N items to reduce log spam
      if (processedInThisBatch % logInterval === 0 || processedInThisBatch === 1) {
        console.log(`🔍 [BATCH-PROCESS] Processing issue ${issue.issue_number} (ID: ${issue.issue_id}) for ${repo} [${processedInThisBatch} processed]`)
      }
      
      let retryCount = 0
      let success = false

      // Update current issue in status
      status.currentIssue = {
        id: issue.issue_id,
        number: issue.issue_number,
        title: issue.title
      }
      await redis.set(`${BATCH_STATUS_KEY}:${repo}`, JSON.stringify(status))
      
      if (processedInThisBatch % logInterval === 0 || processedInThisBatch === 1) {
        console.log(`📝 [BATCH-PROCESS] Updated status with current issue: ${issue.issue_number}`)
      }

      // Retry logic for API calls
      while (retryCount < maxRetries && !success) {
        try {
          // Call the issue analysis API
          const analysisResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/issue-analysis`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              issue_ID: issue.issue_id.toString(),
              GITHUB_ISSUE_CONTENT: `# ${issue.title}\n\n${issue.body}`
            })
          })

          if (!analysisResponse.ok) {
            throw new Error(`Analysis API returned ${analysisResponse.status}`)
          }

          const analysisResult = await analysisResponse.json()

          // Save the analysis result
          const saveResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/issue-analysis/save`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              issue_id: issue.issue_id,
              is_pull_request: issue.is_pull_request,
              analysis: analysisResult.analysis
            })
          })

          if (!saveResponse.ok) {
            throw new Error(`Save API returned ${saveResponse.status}`)
          }

          success = true
          status.successCount++
          
          if (processedInThisBatch % logInterval === 0) {
            console.log(`✅ [BATCH-PROCESS] Successfully processed issue ${issue.issue_number}`)
          }

        } catch (error) {
          retryCount++
          if (retryCount <= 2) { // Only log first few retries to reduce spam
            console.error(`⚠️ [BATCH-PROCESS] Analysis error for issue ${issue.issue_id} (attempt ${retryCount}):`, error.message)
          }
          
          if (retryCount >= maxRetries) {
            status.errorCount++
            status.errors.push({
              issue_id: issue.issue_id,
              issue_number: issue.issue_number,
              error: error.message,
              timestamp: new Date().toISOString()
            })
            console.error(`💥 [BATCH-PROCESS] Failed to process issue ${issue.issue_number} after ${maxRetries} attempts`)
          } else {
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, delayBetweenRequests * retryCount))
          }
        }
      }

      status.processedCount++
      
      // Update status more frequently for better UI responsiveness
      await redis.set(`${BATCH_STATUS_KEY}:${repo}`, JSON.stringify(status))
      
      // Log progress every 10 items for better monitoring
      if (status.processedCount % 10 === 0) {
        console.log(`📊 [BATCH-PROCESS] Progress: ${status.processedCount}/${status.totalCount} (${Math.round((status.processedCount/status.totalCount)*100)}%) - Success: ${status.successCount}, Errors: ${status.errorCount}`)
      }

      // Add delay between requests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, delayBetweenRequests))

    } catch (error) {
      console.error('Batch processing error:', error)
      // Continue processing other items
      continue
    }
  }
}