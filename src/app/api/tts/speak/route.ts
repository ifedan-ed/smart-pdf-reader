import { NextRequest, NextResponse } from 'next/server'
import { getAuthFromRequest } from '@/lib/auth'
import { textToSpeech } from '@/lib/elevenlabs'

export async function POST(request: NextRequest) {
  const auth = getAuthFromRequest(request)
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { text, voiceId, apiKey: reqApiKey } = await request.json()

    if (!text || !voiceId) {
      return NextResponse.json({ error: 'text and voiceId are required' }, { status: 400 })
    }

    const apiKey = reqApiKey || process.env.ELEVENLABS_API_KEY || ''
    if (!apiKey) {
      return NextResponse.json({ error: 'ElevenLabs API key is required' }, { status: 400 })
    }

    const audioBuffer = await textToSpeech(text, voiceId, apiKey)

    return new NextResponse(new Uint8Array(audioBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.length.toString(),
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('TTS error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'TTS failed' },
      { status: 500 }
    )
  }
}
