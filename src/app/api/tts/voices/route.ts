import { NextRequest, NextResponse } from 'next/server'
import { getAuthFromRequest } from '@/lib/auth'
import { getVoices } from '@/lib/elevenlabs'
import { resolveApiKeys } from '@/lib/apikeys'

export async function GET(request: NextRequest) {
  const auth = getAuthFromRequest(request)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { elevenLabsKey } = await resolveApiKeys(auth.userId)

  if (!elevenLabsKey) {
    return NextResponse.json(
      { error: 'ElevenLabs API key not configured. Add your key in Settings.' },
      { status: 400 }
    )
  }

  try {
    const voices = await getVoices(elevenLabsKey)
    return NextResponse.json({ voices })
  } catch (error) {
    console.error('Get voices error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch voices' },
      { status: 500 }
    )
  }
}
