import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthFromRequest } from '@/lib/auth'
import { createClient, listFiles } from '@/lib/nextcloud'

export async function GET(request: NextRequest) {
  const auth = getAuthFromRequest(request)
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const path = searchParams.get('path') || '/'

  try {
    const config = await prisma.nextcloudConfig.findUnique({
      where: { userId: auth.userId },
    })

    if (!config) {
      return NextResponse.json(
        { error: 'Nextcloud is not configured. Please set up Nextcloud in Settings.' },
        { status: 400 }
      )
    }

    const client = createClient(config.url, config.username, config.password)
    const files = await listFiles(client, path)

    return NextResponse.json({ files, path })
  } catch (error) {
    console.error('Nextcloud browse error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to browse Nextcloud' },
      { status: 500 }
    )
  }
}
