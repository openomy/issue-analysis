/* eslint-disable @typescript-eslint/ban-ts-comment */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { redis } from '../../../lib/upstash'

// Helper function to safely parse Redis data
function safeJsonParse(data: unknown): unknown | null {
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
  console.log(`🔍 [10X-GET-ALL-ISSUES] Starting to fetch all issues for repo: ${repo}`)
  const allIssues = []
  let page = 0
  const pageSize = 1000

  while (true) {
    console.log(`📄 [10X-GET-ALL-ISSUES] Fetching page ${page + 1} (${page * pageSize} - ${(page + 1) * pageSize - 1})`)
    
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
      console.error(`💥 [10X-GET-ALL-ISSUES] Error on page ${page + 1}:`, error)
      throw error
    }
    
    if (!data || data.length === 0) {
      console.log(`✅ [10X-GET-ALL-ISSUES] No more data on page ${page + 1}, stopping`)
      break
    }

    console.log(`📊 [10X-GET-ALL-ISSUES] Page ${page + 1} returned ${data.length} issues`)
    allIssues.push(...data)
    page++
  }

  console.log(`🎉 [10X-GET-ALL-ISSUES] Total issues fetched: ${allIssues.length}`)
  return allIssues
}

// Queue key for 10x batch analysis
const BATCH_10X_QUEUE_KEY = 'batch:analysis:10x:queue'
const BATCH_10X_STATUS_KEY = 'batch:analysis:10x:status'

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
        return await start10xBatchAnalysis(repo)
      case 'status':
        return await get10xBatchStatus(repo)
      case 'cancel':
        return await cancel10xBatchAnalysis(repo)
      case 'resume':
        return await resume10xBatchAnalysis(repo)
      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: start, status, cancel, or resume' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('10x Batch analysis error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

async function start10xBatchAnalysis(repo: string) {
  try {
    console.log(`🚀 [10X-BATCH-START] Starting 10x batch analysis for repo: ${repo}`)
    
    // Check if 10x batch analysis is already running
    const currentStatus = await redis.get(`${BATCH_10X_STATUS_KEY}:${repo}`)
    const parsedStatus = safeJsonParse(currentStatus)
    console.log(`📊 [10X-BATCH-START] Current status check:`, parsedStatus)
    // @ts-ignore
    if (parsedStatus && parsedStatus?.status === 'running') {
      console.log(`⚠️ [10X-BATCH-START] 10x Batch analysis already running for ${repo}`)
      return NextResponse.json({
        error: '10x Batch analysis is already running for this repository'
      }, { status: 409 })
    }

    // Get ALL issues for this repository using pagination
    console.log(`🔍 [10X-BATCH-START] Querying database for repo: ${repo}`)
    
    let allIssues
    try {
      allIssues = await getAllIssues(repo)
    } catch (issuesError) {
      console.error('💥 [10X-BATCH-START] Database error:', issuesError)
      return NextResponse.json(
        { error: 'Failed to fetch issues from database' },
        { status: 500 }
      )
    }

    const issuesCount = allIssues.length
    console.log(`📈 [10X-BATCH-START] Found ${issuesCount} issues in database for repo: ${repo}`)
    console.log(`📋 [10X-BATCH-START] Sample issues:`, allIssues?.slice(0, 2)?.map(i => ({ id: i.id, title: i.title })))

    if (issuesCount === 0) {
      console.log(`❌ [10X-BATCH-START] No issues found for repo: ${repo}`)
      return NextResponse.json({
        message: 'No issues found for this repository',
        processedCount: 0,
        totalCount: 0
      })
    }

    // Clear existing queue for this repo
    console.log(`🧹 [10X-BATCH-START] Clearing existing queue for repo: ${repo}`)
    await redis.del(`${BATCH_10X_QUEUE_KEY}:${repo}`)

    // Filter out issues that already have analysis in issue_label table
    console.log(`🔍 [10X-BATCH-START] Checking for already analyzed issues in database`)
    const allIssueIds = allIssues.map(issue => issue.id)
    
    // Get existing analyzed issue IDs from issue_label table in batches to avoid URI too large error
    const existingIssueIds = new Set<number>()
    let batchSize = 100 // Process 100 IDs at a time
    
    for (let i = 0; i < allIssueIds.length; i += batchSize) {
      const batch = allIssueIds.slice(i, i + batchSize)
      const batchNumber = Math.floor(i / batchSize) + 1
      const totalBatches = Math.ceil(allIssueIds.length / batchSize)
      
      console.log(`📋 [10X-BATCH-START] Checking batch ${batchNumber}/${totalBatches} (${batch.length} IDs)`)
      
      try {
        const { data: existingLabels, error: labelError } = await supabase
          .from('issue_label')
          .select('issue_id')
          .in('issue_id', batch)
        
        if (labelError) {
          console.error(`💥 [10X-BATCH-START] Error checking existing labels batch ${batchNumber}:`, labelError)
          return NextResponse.json(
            { error: `Failed to check existing analysis data in batch ${batchNumber}` },
            { status: 500 }
          )
        }
        
        // Add found IDs to the set
        if (existingLabels) {
          existingLabels.forEach(label => existingIssueIds.add(label.issue_id))
        }
        
        console.log(`✅ [10X-BATCH-START] Batch ${batchNumber}: found ${existingLabels?.length || 0} existing labels`)
        
      } catch (error) {
        console.error(`💥 [10X-BATCH-START] Error processing batch ${batchNumber}:`, error)
        return NextResponse.json(
          { error: `Failed to process analysis check batch ${batchNumber}` },
          { status: 500 }
        )
      }
    }
    console.log(`📊 [10X-BATCH-START] Found ${existingIssueIds.size} already analyzed issues out of ${allIssues.length} total`)
    
    // Filter out already analyzed issues
    const unanalyzedIssues = allIssues.filter(issue => !existingIssueIds.has(issue.id))
    const filteredCount = unanalyzedIssues.length
    
    console.log(`✨ [10X-BATCH-START] After filtering: ${filteredCount} issues need analysis (${allIssues.length - filteredCount} already analyzed)`)
    
    if (filteredCount === 0) {
      console.log(`✅ [10X-BATCH-START] All issues already analyzed for repo: ${repo}`)
      return NextResponse.json({
        message: 'All issues have already been analyzed for this repository',
        totalCount: allIssues.length,
        alreadyAnalyzed: allIssues.length,
        needAnalysis: 0
      })
    }

    // Add only unanalyzed issues to the 10x batch analysis queue
    console.log(`📦 [10X-BATCH-START] Creating queue items for ${filteredCount} unanalyzed issues`)
    const queueItems = unanalyzedIssues.map(issue => JSON.stringify({
      issue_id: issue.id,
      // @ts-ignore
      issue_number: issue?.number,
      title: issue.title,
      body: issue.body || '',
      // @ts-ignore
      html_url: issue?.html_url,
      is_pull_request: issue.is_pull_request,
      repo: repo
    }))

    // Add items to queue in batches to avoid Upstash size limits (10MB)
    batchSize = 500 // Smaller batch size to be safe
    console.log(`📤 [10X-BATCH-START] Adding ${queueItems.length} items to Redis queue in batches of ${batchSize}`)
    
    for (let i = 0; i < queueItems.length; i += batchSize) {
      const batch = queueItems.slice(i, i + batchSize)
      const batchNumber = Math.floor(i / batchSize) + 1
      const totalBatches = Math.ceil(queueItems.length / batchSize)
      
      console.log(`📦 [10X-BATCH-START] Adding batch ${batchNumber}/${totalBatches} (${batch.length} items)`)
      
      try {
        await redis.rpush(`${BATCH_10X_QUEUE_KEY}:${repo}`, ...batch)
        console.log(`✅ [10X-BATCH-START] Successfully added batch ${batchNumber}/${totalBatches}`)
      } catch (error) {
        console.error(`💥 [10X-BATCH-START] Failed to add batch ${batchNumber}:`, error)
        throw error
      }
    }
    
    console.log(`🎉 [10X-BATCH-START] Successfully added all ${queueItems.length} items to queue`)

    // Set initial status
    const initialStatus = {
      status: 'running',
      startTime: new Date().toISOString(),
      totalCount: filteredCount, // Use filtered count instead of original count
      processedCount: 0,
      successCount: 0,
      errorCount: 0,
      currentIssues: [],
      errors: [],
      originalTotalCount: issuesCount, // Keep track of original total
      alreadyAnalyzedCount: allIssues.length - filteredCount // Track skipped count
    }

    console.log(`💾 [10X-BATCH-START] Setting initial status:`, initialStatus)
    await redis.set(
      `${BATCH_10X_STATUS_KEY}:${repo}`,
      JSON.stringify(initialStatus),
      { ex: 86400 } // Expire after 24 hours
    )

    // Start processing in background with 10x parallel workers
    console.log(`🏃 [10X-BATCH-START] Starting 10x parallel background processing for ${repo}`)
    process10xBatchQueue(repo)

    const response = {
      message: '10x Batch analysis started successfully',
      totalCount: filteredCount, // Issues that need analysis
      originalTotalCount: issuesCount, // Original total issues in repo
      alreadyAnalyzedCount: allIssues.length - filteredCount, // Issues already analyzed
      queueLength: queueItems.length,
      concurrency: 10
    }
    console.log(`📤 [10X-BATCH-START] Returning response:`, response)
    return NextResponse.json(response)

  } catch (error) {
    console.error('Start 10x batch analysis error:', error)
    return NextResponse.json(
      { error: 'Failed to start 10x batch analysis' },
      { status: 500 }
    )
  }
}

async function get10xBatchStatus(repo: string) {
  try {
    console.log(`📊 [10X-BATCH-STATUS] Getting status for repo: ${repo}`)
    const statusData = await redis.get(`${BATCH_10X_STATUS_KEY}:${repo}`)
    
    if (!statusData) {
      console.log(`❌ [10X-BATCH-STATUS] No status data found for repo: ${repo}`)
      return NextResponse.json({
        status: 'not_started',
        message: 'No 10x batch analysis found for this repository'
      })
    }

    const status = safeJsonParse(statusData) as {
      status: string
      totalCount: number
      processedCount: number
      successCount: number
      errorCount: number
      remainingCount?: number
    }
    if (!status) {
      console.log(`💥 [10X-BATCH-STATUS] Failed to parse status data for repo: ${repo}`)
      return NextResponse.json({
        status: 'error',
        message: 'Failed to parse status data'
      })
    }
    
    const queueLength = await redis.llen(`${BATCH_10X_QUEUE_KEY}:${repo}`)
    
    // Get real success count from database using JOIN query
    console.log(`🔍 [10X-BATCH-STATUS] Querying real success count from database for repo: ${repo}`)
    
    try {
      // Use JOIN to count analyzed issues for this repo directly
      const { count: realSuccessCount, error: countError } = await supabase
        .from('issue_label')
        .select('issue_id, github_issues!inner(github_repos!inner(full_name))', { count: 'exact', head: true })
        .eq('github_issues.github_repos.full_name', repo)
      
      if (countError) {
        console.error('❌ [10X-BATCH-STATUS] Error querying success count:', countError)
        // Fall back to status data if database query fails
      } else {
        console.log(`✅ [10X-BATCH-STATUS] Real success count from database: ${realSuccessCount}`)
        // Update status with real success count
            // @ts-ignore
        status.successCount = realSuccessCount || 0
        // Calculate processedCount based on queue progress
            // @ts-ignore
        status.processedCount = status.totalCount - queueLength
            // @ts-ignore
        status.errorCount = Math.max(0, status.processedCount - status.successCount)
      }
    } catch (dbError) {
      console.error('❌ [10X-BATCH-STATUS] Database query error:', dbError)
      // Fall back to status data if database query fails
    }
    
    console.log(`📈 [10X-BATCH-STATUS] Status for ${repo}:`, { 
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
    console.error('Get 10x batch status error:', error)
    return NextResponse.json(
      { error: 'Failed to get 10x batch status' },
      { status: 500 }
    )
  }
}

async function cancel10xBatchAnalysis(repo: string) {
  try {
    // Clear the queue
    await redis.del(`${BATCH_10X_QUEUE_KEY}:${repo}`)
    
    // Update status to cancelled
    const currentStatus = await redis.get(`${BATCH_10X_STATUS_KEY}:${repo}`)
    if (currentStatus) {
      const status = safeJsonParse(currentStatus) as {
        status: string
        endTime?: string
      }
      if (status) {
        status.status = 'cancelled'
        status.endTime = new Date().toISOString()
        
        await redis.set(
          `${BATCH_10X_STATUS_KEY}:${repo}`,
          JSON.stringify(status),
          { ex: 3600 } // Keep cancelled status for 1 hour
        )
      } else {
        // Just set a basic cancelled status if parsing failed
        await redis.set(
          `${BATCH_10X_STATUS_KEY}:${repo}`,
          JSON.stringify({
            status: 'cancelled',
            endTime: new Date().toISOString()
          }),
          { ex: 3600 }
        )
      }
    }

    return NextResponse.json({
      message: '10x Batch analysis cancelled successfully'
    })

  } catch (error) {
    console.error('Cancel 10x batch analysis error:', error)
    return NextResponse.json(
      { error: 'Failed to cancel 10x batch analysis' },
      { status: 500 }
    )
  }
}

async function resume10xBatchAnalysis(repo: string) {
  try {
    console.log(`▶️ [10X-BATCH-RESUME] Resuming 10x batch analysis for repo: ${repo}`)
    
    // Get current status
    const currentStatus = await redis.get(`${BATCH_10X_STATUS_KEY}:${repo}`)
    if (!currentStatus) {
      return NextResponse.json({
        error: 'No 10x batch analysis found for this repository'
      }, { status: 404 })
    }

    const status = safeJsonParse(currentStatus) as {
      status: string
      totalCount: number
      processedCount: number
      successCount: number
      errorCount: number
      remainingCount?: number
      resumedAt?: string
      endTime?: string
    }
    if (!status) {
      return NextResponse.json({
        error: 'Failed to parse status data'
      }, { status: 500 })
    }

    // Check if there are still items in queue
    const queueLength = await redis.llen(`${BATCH_10X_QUEUE_KEY}:${repo}`)
    if (queueLength === 0) {
      // No items left, mark as completed
      status.status = 'completed'
      status.endTime = new Date().toISOString()
      
      await redis.set(
        `${BATCH_10X_STATUS_KEY}:${repo}`,
        JSON.stringify(status),
        { ex: 3600 }
      )
      
      return NextResponse.json({
        message: 'No remaining items to process. 10x Analysis marked as completed.',
        processedCount: status.processedCount,
        totalCount: status.totalCount
      })
    }

    // Update status to running
    status.status = 'running'
    status.resumedAt = new Date().toISOString()
    
    await redis.set(
      `${BATCH_10X_STATUS_KEY}:${repo}`,
      JSON.stringify(status),
      { ex: 86400 }
    )
    
    // Restart background processing
    console.log(`🔄 [10X-BATCH-RESUME] Restarting 10x parallel background processing for: ${repo}`)
    process10xBatchQueue(repo)
    
    console.log(`✅ [10X-BATCH-RESUME] Successfully resumed 10x batch analysis for: ${repo}`)
    
    return NextResponse.json({
      message: '10x Batch analysis resumed successfully',
      processedCount: status.processedCount,
      totalCount: status.totalCount,
      remainingCount: queueLength
    })

  } catch (error) {
    console.error('Resume 10x batch analysis error:', error)
    return NextResponse.json(
      { error: 'Failed to resume 10x batch analysis' },
      { status: 500 }
    )
  }
}

// 10x Parallel background processing function
async function process10xBatchQueue(repo: string) {
  console.log(`🔄 [10X-BATCH-PROCESS] Starting 10x parallel background processing for repo: ${repo}`)
  const maxRetries = 3
  const delayBetweenRequests = 500 // 0.5 second delay between API calls
  const concurrency = 50 // 10 parallel workers
  let activeWorkers = 0
  let shouldStop = false

  // Worker function to process a single issue
  const processIssue = async (workerId: number): Promise<void> => {
    while (!shouldStop) {
      try {
        // Check if process should continue
        const statusData = await redis.get(`${BATCH_10X_STATUS_KEY}:${repo}`)
        if (!statusData) {
          console.log(`❌ [10X-WORKER-${workerId}] No status data found, stopping processing for: ${repo}`)
          break
        }

        const status = safeJsonParse(statusData) as {
          status: string
          totalCount: number
          processedCount: number
          successCount: number
          errorCount: number
          errors?: Array<{
            issue_id: number
            issue_number: number
            error: string
            timestamp: string
          }>
          currentIssues?: Array<{
            id: number
            number: number
            title: string
            workerId: number
          }>
        }
        if (!status) {
          console.error(`💥 [10X-WORKER-${workerId}] Failed to parse status data, stopping batch processing`)
          break
        }
        if (status.status !== 'running') {
          console.log(`⏹️ [10X-WORKER-${workerId}] Status is ${status.status}, stopping processing for: ${repo}`)
          break
        }

        // Get next item from queue
        const queueItem = await redis.lpop(`${BATCH_10X_QUEUE_KEY}:${repo}`)
        if (!queueItem) {
          // Queue is empty, check if all workers are done
          if (activeWorkers === 1) { // This is the last worker
            console.log(`✅ [10X-WORKER-${workerId}] Queue is empty, marking as completed for: ${repo}`)
            status.status = 'completed'
            status.endTime = new Date().toISOString()
            await redis.set(`${BATCH_10X_STATUS_KEY}:${repo}`, JSON.stringify(status), { ex: 3600 })
            console.log(`🎉 [10X-WORKER-${workerId}] 10x Batch processing completed for: ${repo}`)
          }
          break
        }

        const issue = safeJsonParse(queueItem) as {
          issue_id: number
          issue_number: number
          title: string
          body: string
          html_url: string
          is_pull_request: boolean
        }
        if (!issue) {
          console.error(`💥 [10X-WORKER-${workerId}] Failed to parse queue item, skipping:`, queueItem)
          continue
        }
        
        console.log(`🔍 [10X-WORKER-${workerId}] Processing issue ${issue.issue_number} (ID: ${issue.issue_id}) for ${repo}`)
        
        let retryCount = 0
        let success = false

        // Update current issues in status
        if (!status.currentIssues) {
          status.currentIssues = []
        }
        // Remove any existing entry for this worker
        status.currentIssues = status.currentIssues.filter(item => item.workerId !== workerId)
        // Add current issue for this worker
        status.currentIssues.push({
          id: issue.issue_id,
          number: issue.issue_number,
          title: issue.title,
          workerId: workerId
        })
        await redis.set(`${BATCH_10X_STATUS_KEY}:${repo}`, JSON.stringify(status))

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
            
            console.log(`✅ [10X-WORKER-${workerId}] Successfully processed issue ${issue.issue_number}`)
          } catch (error: unknown) {
            retryCount++
            // @ts-ignore
            console.error(`⚠️ [10X-WORKER-${workerId}] Analysis error for issue ${issue.issue_id} (attempt ${retryCount}):`, error.message)
            
            if (retryCount >= maxRetries) {
              status.errorCount++
              if( status.errors) {
                status.errors.push({
                issue_id: issue.issue_id,
                issue_number: issue.issue_number,
                        // @ts-ignore
                error: error.message,
                timestamp: new Date().toISOString()
              })
              console.error(`💥 [10X-WORKER-${workerId}] Failed to process issue ${issue.issue_number} after ${maxRetries} attempts`)
           
              }
         } else {
              // Wait before retry
              await new Promise(resolve => setTimeout(resolve, delayBetweenRequests * retryCount))
            }
          }
        }

        status.processedCount++
        
        // Remove current issue from status after processing
        if (status.currentIssues) {
          status.currentIssues = status.currentIssues.filter(item => item.workerId !== workerId)
        }
        
        // Update status after processing
        await redis.set(`${BATCH_10X_STATUS_KEY}:${repo}`, JSON.stringify(status))
        
        // Log progress every 10 items total across all workers
        if (status.processedCount % 10 === 0) {
          console.log(`📊 [10X-WORKER-${workerId}] Progress: ${status.processedCount}/${status.totalCount} (${Math.round((status.processedCount/status.totalCount)*100)}%) - Success: ${status.successCount}, Errors: ${status.errorCount}`)
        }

        // Add delay between requests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, delayBetweenRequests))

      } catch (error) {
        console.error(`💥 [10X-WORKER-${workerId}] Batch processing error:`, error)
        // Continue processing other items
        continue
      }
    }
    
    activeWorkers--
    console.log(`👋 [10X-WORKER-${workerId}] Worker stopped. Active workers: ${activeWorkers}`)
  }

  // Start 10 parallel workers
  console.log(`🚀 [10X-BATCH-PROCESS] Starting ${concurrency} parallel workers for ${repo}`)
  const workers = []
  for (let i = 1; i <= concurrency; i++) {
    activeWorkers++
    workers.push(processIssue(i))
  }

  // Wait for all workers to complete
  await Promise.all(workers)
  console.log(`🏁 [10X-BATCH-PROCESS] All workers completed for ${repo}`)
}