import { NextRequest, NextResponse } from 'next/server'
import { getAuthFromRequest } from '@/lib/auth'
import { createClient, listFiles } from '@/lib/nextcloud'

export async function POST(request: NextRequest) {
  const auth = getAuthFromRequest(request)
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { url, username, password } = await request.json()

    if (!url || !username || !password) {
      return NextResponse.json({ error: 'url, username, and password are required' }, { status: 400 })
    }

    const client = createClient(url, username, password)
    await listFiles(client, '/')

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Test Nextcloud error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Connection failed',
    })
  }
}
