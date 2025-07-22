import { redis } from './upstash'
import { supabase } from './supabase'
import { octokit } from './github'
import { GitHubIssue, GitHubRepo } from '../types'

export async function syncOneIssue(): Promise<boolean> {
  try {
    const issueToSync = await redis.lpop('github:issues:queue')
    if (!issueToSync) {
      console.log('No issues to sync')
      return false
    }

    const [owner, repo, issueNumber] = (issueToSync as string).split(':')
    
    const { data: issue } = await octokit.rest.issues.get({
      owner,
      repo,
      issue_number: parseInt(issueNumber)
    })

    const repoData = await getOrCreateRepo(owner, repo)
    if (!repoData) {
      console.error(`Failed to get repo data for ${owner}/${repo}`)
      return false
    }

    const issueData: Partial<GitHubIssue> = {
      id: issue.id,
      repo_id: repoData.id,
      url: issue.url,
      title: issue.title,
      body: issue.body || null,
      state: issue.state as 'open' | 'closed',
      labels: issue.labels,
      is_pull_request: !!issue.pull_request,
      pr_url: issue.pull_request?.html_url || null,
      created_at: issue.created_at,
      closed_at: issue.closed_at
    }

    console.log("issueData",issueData)

    const { error } = await supabase
      .from('github_issues')
      .upsert(issueData, { onConflict: 'id' })

    if (error) {
      console.error('Error upserting issue:', error)
      return false
    }

    await redis.set(`github:issue:${issue.id}:last_sync`, new Date().toISOString())
    
    console.log(`Synced issue ${owner}/${repo}#${issueNumber}`)
    return true
  } catch (error) {
    console.error('Error syncing issue:', error)
    return false
  }
}

async function getOrCreateRepo(owner: string, repo: string): Promise<GitHubRepo | null> {
  try {
    const { data: existingRepo, error } = await supabase
      .from('github_repos')
      .select('*')
      .eq('full_name', `${owner}/${repo}`)
      .single()

    if (!error && existingRepo) {
      return existingRepo
    }

    const { data: repoData } = await octokit.rest.repos.get({
      owner,
      repo
    })

    const newRepo: Partial<GitHubRepo> = {
      id: repoData.id,
      name: repoData.name,
      full_name: repoData.full_name,
      owner: repoData.owner.login,
      html_url: repoData.html_url,
      description: repoData.description || '',
      language: repoData.language || '',
      topics: repoData.topics || [],
      stars: repoData.stargazers_count,
      forks: repoData.forks_count
    }

    const { data: insertedRepo, error: insertError } = await supabase
      .from('github_repos')
      .insert(newRepo)
      .select()
      .single()

    if (insertError) {
      console.error('Error inserting repo:', insertError)
      return null
    }

    return insertedRepo
  } catch (error) {
    console.error('Error getting/creating repo:', error)
    return null
  }
}

export async function addIssueToQueue(owner: string, repo: string, issueNumber: number): Promise<void> {
  const issueKey = `${owner}:${repo}:${issueNumber}`
  
  // Check if already in queue
  const queueItems = await redis.lrange('github:issues:queue', 0, -1)
  if (queueItems.includes(issueKey)) {
    console.log(`Issue ${issueKey} already in queue, skipping`)
    return
  }
  
  await redis.rpush('github:issues:queue', issueKey)
}

export async function addRepoIssuesToQueue(owner: string, repo: string): Promise<void> {
  try {
    const issues = await octokit.paginate(octokit.rest.issues.listForRepo, {
      owner,
      repo,
      state: 'all',
      per_page: 100
    })

    for (const issue of issues) {
      await addIssueToQueue(owner, repo, issue.number)
    }

    console.log(`Added ${issues.length} issues to queue for ${owner}/${repo}`)
  } catch (error) {
    console.error(`Error adding issues to queue for ${owner}/${repo}:`, error)
  }
}