import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthFromRequest } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const auth = getAuthFromRequest(request)
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const config = await prisma.nextcloudConfig.findUnique({
      where: { userId: auth.userId },
      select: { url: true, username: true, password: true },
    })

    return NextResponse.json({ config })
  } catch (error) {
    console.error('Get Nextcloud config error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const auth = getAuthFromRequest(request)
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { url, username, password } = await request.json()

    if (!url || !username || !password) {
      return NextResponse.json({ error: 'url, username, and password are required' }, { status: 400 })
    }

    const config = await prisma.nextcloudConfig.upsert({
      where: { userId: auth.userId },
      update: { url, username, password },
      create: { userId: auth.userId, url, username, password },
    })

    return NextResponse.json({ config: { url: config.url, username: config.username } })
  } catch (error) {
    console.error('Save Nextcloud config error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
