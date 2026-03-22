import { NextRequest, NextResponse } from 'next/server'
import { getAuthFromRequest } from '@/lib/auth'
import { summarizeText } from '@/lib/openrouter'
import { resolveApiKeys } from '@/lib/apikeys'

export async function POST(request: NextRequest) {
  const auth = getAuthFromRequest(request)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { text } = await request.json()

    if (!text) {
      return NextResponse.json({ error: 'text is required' }, { status: 400 })
    }

    const { openRouterKey } = await resolveApiKeys(auth.userId)
    if (!openRouterKey) {
      return NextResponse.json(
        { error: 'OpenRouter API key not configured. Add your key in Settings.' },
        { status: 400 }
      )
    }

    const summary = await summarizeText(text, openRouterKey)
    return NextResponse.json({ summary })
  } catch (error) {
    console.error('AI summarize error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Summarization failed' },
      { status: 500 }
    )
  }
}
