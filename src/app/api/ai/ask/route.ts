import { NextRequest, NextResponse } from 'next/server'
import { getAuthFromRequest } from '@/lib/auth'
import { askQuestion } from '@/lib/openrouter'

export async function POST(request: NextRequest) {
  const auth = getAuthFromRequest(request)
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { question, pageText, apiKey: reqApiKey } = await request.json()

    if (!question || !pageText) {
      return NextResponse.json({ error: 'question and pageText are required' }, { status: 400 })
    }

    const apiKey = reqApiKey || process.env.OPENROUTER_API_KEY || ''
    if (!apiKey) {
      return NextResponse.json({ error: 'OpenRouter API key is required' }, { status: 400 })
    }

    const answer = await askQuestion(pageText, question, apiKey)

    return NextResponse.json({ answer })
  } catch (error) {
    console.error('AI ask error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'AI request failed' },
      { status: 500 }
    )
  }
}
