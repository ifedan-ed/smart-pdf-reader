import { NextRequest, NextResponse } from 'next/server'
import { getAuthFromRequest } from '@/lib/auth'

export async function POST(request: NextRequest) {
  const auth = getAuthFromRequest(request)
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { imageData } = await request.json()

    if (!imageData) {
      return NextResponse.json({ error: 'imageData is required' }, { status: 400 })
    }

    // Dynamic import to avoid SSR issues
    const Tesseract = await import('tesseract.js')

    const worker = await Tesseract.createWorker('eng')

    try {
      const { data: { text } } = await worker.recognize(imageData)
      await worker.terminate()
      return NextResponse.json({ text: text.trim() })
    } catch (ocrError) {
      await worker.terminate()
      throw ocrError
    }
  } catch (error) {
    console.error('OCR error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'OCR failed' },
      { status: 500 }
    )
  }
}
