import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '../../../../lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { issue_id, is_pull_request, analysis } = body

    // 验证输入参数
    if (!issue_id || analysis === undefined) {
      return NextResponse.json(
        { error: 'Missing required parameters: issue_id and analysis' },
        { status: 400 }
      )
    }

    // 将 AI 分析结果映射到数据库字段
    const issueLabel = {
      issue_id: parseInt(`${issue_id}`),
      is_pull_request: `${is_pull_request}` === 'true',
      tool_calling: `${analysis['tool Calling']}` === 'true',
      mcp: `${analysis['mcp']}` === 'true',
      model_provider: `${analysis['model_provider']}` === 'false' ? null : `${analysis['model_provider'] === undefined ? "": analysis['model_provider']}`,
      setting: `${analysis['setting']}` === 'true',
      file_system: `${analysis['file_system']}` === 'true',
      env: `${analysis['env']}` === 'true',
      chat: `${analysis['chat']}` === 'true',
      plugin: `${analysis['plugin']}` === 'true',
      search: `${analysis['search']}` === 'true',
      tts: `${analysis['tts']}` === 'true',
      design_style: `${analysis['design_style']}` === 'true',
      docs: `${analysis['docs']}` === 'true',
      mobile: `${analysis['mobile']}` === 'true',
      desktop: `${analysis['desktop']}` === 'true',
      docker: `${analysis['docker']}` === 'true',
      windows: `${analysis['windows']}` === 'true',
      react_native: `${analysis['react_native']}` === 'true',
      auth: `${analysis['auth']}` === 'true',
      macos: `${analysis['macos']}` === 'true',
      cloud: `${analysis['cloud']}` === 'true',
      drawing: `${analysis['drawing']}` === 'true',
      linux: `${analysis['linux']}` === 'true',
      version: `${analysis['version']}` === 'false' ? null : `${analysis['version']}`,
      need_manual_check: `${analysis['need_manual_check']}` === 'true',
      updated_at: new Date().toISOString()
    }

    // 检查是否已存在该 issue 的标签
    const { data: existingLabel, error: selectError } = await supabase
      .from('issue_label')
      .select('id')
      .eq('issue_id', issue_id)
      .single()

    if (selectError && selectError.code !== 'PGRST116') {
      // PGRST116 是 "not found" 错误，其他错误需要处理
      console.error('Error checking existing label:', selectError)
      return NextResponse.json(
        { error: 'Database query failed' },
        { status: 500 }
      )
    }

    let result
    if (existingLabel) {
      // 更新现有记录
      const { data, error } = await supabase
        .from('issue_label')
        .update(issueLabel)
        .eq('issue_id', issue_id)
        .select()

      result = { data, error }
    } else {
      // 插入新记录
      const { data, error } = await supabase
        .from('issue_label')
        .insert([issueLabel])
        .select()

      result = { data, error }
    }

    if (result.error) {
      console.error('Error saving issue label:', result.error)
      return NextResponse.json(
        { error: 'Failed to save analysis result' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: result.data?.[0]
    })

  } catch (error) {
    console.error('Error in save issue analysis API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}