import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { systemPrompt } from './system-prompt'


// 初始化 OpenAI 客户端
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_PROXY_URL,
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { issue_ID, GITHUB_ISSUE_CONTENT } = body

    // 验证输入参数
    if (!issue_ID || !GITHUB_ISSUE_CONTENT) {
      return NextResponse.json(
        { error: 'Missing required parameters: issue_ID and GITHUB_ISSUE_CONTENT' },
        { status: 400 }
      )
    }

    // 替换系统提示中的占位符
    const processedPrompt = systemPrompt
      .replace('{{issue_ID}}', issue_ID)
      .replace('{{GITHUB_ISSUE_CONTENT}}', GITHUB_ISSUE_CONTENT)

    // 调用 OpenAI API
    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert at extracting GitHub Issue categorization information. Return only valid JSON as specified in the schema.'
        },
        {
          role: 'user',
          content: processedPrompt
        }
      ],
      temperature: 0,
      response_format: { type: 'json_object' }
    })

    const result = completion.choices[0]?.message?.content

    if (!result) {
      return NextResponse.json(
        { error: 'No response from AI service' },
        { status: 500 }
      )
    }

    // 尝试解析 JSON 结果
    let parsedResult
    try {
      parsedResult = JSON.parse(result)
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', parseError)
      return NextResponse.json(
        { error: 'Invalid JSON response from AI service' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      issue_ID,
      analysis: parsedResult
    })

  } catch (error) {
    console.error('Error in issue analysis API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}