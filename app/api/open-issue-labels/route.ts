import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '../../../lib/supabase'

export interface LabelStat {
  name: string
  count: number
}

export interface LabelStatsResponse {
  mainLabels: LabelStat[]
  versionStats: LabelStat[]
  deploymentStats: LabelStat[]
  platformStats: LabelStat[]
  totalIssues: number
}

// Define the analysis labels from the system prompt
const MAIN_LABELS = [
  'tool_calling',
  'mcp', 
  'setting',
  'file_system',
  'env',
  'chat',
  'plugin',
  'search',
  'tts',
  'design_style',
  'docs',
  'mobile',
  'react_native',
  'auth',
  'drawing',
  'need_manual_check'
]

const DEPLOYMENT_LABELS = ['cloud', 'desktop', 'docker']
const PLATFORM_LABELS = ['windows', 'macos', 'linux']

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const repo = searchParams.get('repo')
  
  try {
    // First get the repo_id for this repository
    let repoId: number | null = null
    if (repo) {
      const { data: repoData, error: repoError } = await supabase
        .from('github_repos')
        .select('id')
        .eq('full_name', repo)
        .single()
      
      if (repoError || !repoData) {
        return NextResponse.json({
          mainLabels: [],
          versionStats: [],
          deploymentStats: [],
          platformStats: [],
          totalIssues: 0
        })
      }
      
      repoId = repoData.id
    }
    
    // Query to get all open issues (not PRs) with their analysis labels
    let query = supabase
      .from('issue_label')
      .select(`
        *,
        github_issues!inner(
          id,
          state,
          is_pull_request,
          repo_id
        )
      `)
      .eq('github_issues.state', 'open')
      .eq('github_issues.is_pull_request', false)
    
    if (repoId) {
      query = query.eq('github_issues.repo_id', repoId)
    }
    
    const { data: labeledIssues, error } = await query
    
    if (error) {
      console.error('Error fetching labeled issues:', error)
      return NextResponse.json({ error: 'Failed to fetch labeled issues' }, { status: 500 })
    }
    
    if (!labeledIssues || labeledIssues.length === 0) {
      return NextResponse.json({
        mainLabels: [],
        versionStats: [],
        deploymentStats: [],
        platformStats: [],
        totalIssues: 0
      })
    }
    
    // Count analysis labels by category
    const mainLabelCounts: Record<string, number> = {}
    const versionCounts: Record<string, number> = {}
    const deploymentCounts: Record<string, number> = {}
    const platformCounts: Record<string, number> = {}
    const uniqueIssues = new Set<number>()
    
    labeledIssues.forEach(labeledIssue => {
      // Track unique issues to calculate total correctly
      uniqueIssues.add(labeledIssue.issue_id)
      
      // Count main labels
      MAIN_LABELS.forEach(labelType => {
        if (labeledIssue[labelType] === true) {
          // Convert database field names to display names
          const displayName = labelType
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ')
          
          mainLabelCounts[displayName] = (mainLabelCounts[displayName] || 0) + 1
        }
      })
      
      // Special handling for model_provider (add to main labels)
      if (labeledIssue.model_provider && labeledIssue.model_provider !== 'false') {
        const providerName = `${labeledIssue.model_provider.charAt(0).toUpperCase() + labeledIssue.model_provider.slice(1)} Provider`
        mainLabelCounts[providerName] = (mainLabelCounts[providerName] || 0) + 1
      }
      
      // Count deployment labels
      DEPLOYMENT_LABELS.forEach(labelType => {
        if (labeledIssue[labelType] === true) {
          const displayName = labelType.charAt(0).toUpperCase() + labelType.slice(1)
          deploymentCounts[displayName] = (deploymentCounts[displayName] || 0) + 1
        }
      })
      
      // Count platform labels
      PLATFORM_LABELS.forEach(labelType => {
        if (labeledIssue[labelType] === true) {
          const displayName = labelType.charAt(0).toUpperCase() + labelType.slice(1)
          platformCounts[displayName] = (platformCounts[displayName] || 0) + 1
        }
      })
      
      // Count version labels with grouping
      if (labeledIssue.version && labeledIssue.version !== 'false' && labeledIssue.version !== 'latest') {
        // Group versions by major.minor (e.g., 1.9.1 -> v1.9.x, 2.0.5 -> v2.0.x)
        let versionKey = labeledIssue.version
        const versionMatch = versionKey.match(/^(\d+)\.(\d+)/)
        
        if (versionMatch) {
          // Group by major.minor version
          versionKey = `v${versionMatch[1]}.${versionMatch[2]}.x`
        } else {
          // Fallback for non-standard version formats
          versionKey = `v${versionKey}`
        }
        
        versionCounts[versionKey] = (versionCounts[versionKey] || 0) + 1
      }
    })
    
    // Convert to arrays and sort by count
    const mainLabels: LabelStat[] = Object.entries(mainLabelCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10) // Top 10 for bar chart
    
    // Process version stats - only show top 5, group rest as "Others"
    const allVersionStats: LabelStat[] = Object.entries(versionCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
    
    const top5Versions = allVersionStats.slice(0, 5)
    const otherVersions = allVersionStats.slice(5)
    
    const versionStats = top5Versions
    if (otherVersions.length > 0) {
      const othersCount = otherVersions.reduce((sum, version) => sum + version.count, 0)
      versionStats.push({
        name: 'Others',
        count: othersCount
      })
    }
    
    const deploymentStats: LabelStat[] = Object.entries(deploymentCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
    
    const platformStats: LabelStat[] = Object.entries(platformCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
    
    return NextResponse.json({
      mainLabels,
      versionStats,
      deploymentStats,
      platformStats,
      totalIssues: uniqueIssues.size
    })
  } catch (error) {
    console.error('Error in open-issue-labels API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}