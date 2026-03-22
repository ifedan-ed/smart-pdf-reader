import { NextRequest, NextResponse } from 'next/server'
import { getAuthFromRequest } from '@/lib/auth'
import { summarizeText } from '@/lib/openrouter'

export async function POST(request: NextRequest) {
  const auth = getAuthFromRequest(request)
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { text, apiKey: reqApiKey } = await request.json()

    if (!text) {
      return NextResponse.json({ error: 'text is required' }, { status: 400 })
    }

    const apiKey = reqApiKey || process.env.OPENROUTER_API_KEY || ''
    if (!apiKey) {
      return NextResponse.json({ error: 'OpenRouter API key is required' }, { status: 400 })
    }

    const summary = await summarizeText(text, apiKey)

    return NextResponse.json({ summary })
  } catch (error) {
    console.error('AI summarize error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Summarization failed' },
      { status: 500 }
    )
  }
}
