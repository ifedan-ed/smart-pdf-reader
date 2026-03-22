import { NextRequest, NextResponse } from 'next/server'
import { getAuthFromRequest } from '@/lib/auth'
import { askQuestion } from '@/lib/openrouter'
import { resolveApiKeys } from '@/lib/apikeys'

export async function POST(request: NextRequest) {
  const auth = getAuthFromRequest(request)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { question, pageText } = await request.json()

    if (!question || !pageText) {
      return NextResponse.json({ error: 'question and pageText are required' }, { status: 400 })
    }

    const { openRouterKey } = await resolveApiKeys(auth.userId)
    if (!openRouterKey) {
      return NextResponse.json(
        { error: 'OpenRouter API key not configured. Add your key in Settings.' },
        { status: 400 }
      )
    }

    const answer = await askQuestion(pageText, question, openRouterKey)
    return NextResponse.json({ answer })
  } catch (error) {
    console.error('AI ask error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'AI request failed' },
      { status: 500 }
    )
  }
}
