export interface Voice {
  id: string
  name: string
  preview_url: string
  category: string
  labels: Record<string, string>
}

export async function getVoices(apiKey: string): Promise<Voice[]> {
  const response = await fetch('https://api.elevenlabs.io/v1/voices', {
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`ElevenLabs API error: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()
  return (data.voices || []).map((v: {
    voice_id: string
    name: string
    preview_url: string
    category: string
    labels: Record<string, string>
  }) => ({
    id: v.voice_id,
    name: v.name,
    preview_url: v.preview_url,
    category: v.category,
    labels: v.labels || {},
  }))
}

export async function textToSpeech(text: string, voiceId: string, apiKey: string): Promise<Buffer> {
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      'Accept': 'audio/mpeg',
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.5,
      },
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`ElevenLabs TTS error: ${response.status} ${errorText}`)
  }

  const arrayBuffer = await response.arrayBuffer()
  return Buffer.from(arrayBuffer)
}
