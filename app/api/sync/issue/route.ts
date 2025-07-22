import { NextResponse } from 'next/server'
import { syncOneIssue } from '../../../../lib/sync-issue'

export async function POST() {
  try {
    const success = await syncOneIssue()
    
    if (success) {
      return NextResponse.json({ 
        success: true, 
        message: 'Issue synced successfully' 
      })
    } else {
      return NextResponse.json({ 
        success: false, 
        message: 'No issues to sync or sync failed' 
      })
    }
  } catch (error) {
    console.error('Error in sync API:', error)
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}