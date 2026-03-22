import { NextRequest, NextResponse } from 'next/server'
import { getAuthFromRequest } from '@/lib/auth'
import { getVoices } from '@/lib/elevenlabs'

export async function GET(request: NextRequest) {
  const auth = getAuthFromRequest(request)
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const queryApiKey = searchParams.get('apiKey')
  const apiKey = queryApiKey || process.env.ELEVENLABS_API_KEY || ''

  if (!apiKey) {
    return NextResponse.json({ error: 'ElevenLabs API key is required' }, { status: 400 })
  }

  try {
    const voices = await getVoices(apiKey)
    return NextResponse.json({ voices })
  } catch (error) {
    console.error('Get voices error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch voices' },
      { status: 500 }
    )
  }
}
