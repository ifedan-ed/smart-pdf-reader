import { NextRequest, NextResponse } from 'next/server'
import { getAuthFromRequest } from '@/lib/auth'
import prisma from '@/lib/db'

export async function GET(request: NextRequest) {
  const auth = getAuthFromRequest(request)
  if (!auth || auth.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const configs = await prisma.siteConfig.findMany()
  const map: Record<string, string> = {}
  configs.forEach((c) => { map[c.key] = c.value })

  return NextResponse.json({
    hasElevenLabsKey: !!(map['elevenlabs_api_key']),
    hasOpenRouterKey: !!(map['openrouter_api_key']),
  })
}

export async function PUT(request: NextRequest) {
  const auth = getAuthFromRequest(request)
  if (!auth || auth.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { elevenLabsKey, openRouterKey } = await request.json()

  if (elevenLabsKey !== undefined) {
    if (elevenLabsKey) {
      await prisma.siteConfig.upsert({
        where: { key: 'elevenlabs_api_key' },
        update: { value: elevenLabsKey },
        create: { key: 'elevenlabs_api_key', value: elevenLabsKey },
      })
    } else {
      await prisma.siteConfig.deleteMany({ where: { key: 'elevenlabs_api_key' } })
    }
  }

  if (openRouterKey !== undefined) {
    if (openRouterKey) {
      await prisma.siteConfig.upsert({
        where: { key: 'openrouter_api_key' },
        update: { value: openRouterKey },
        create: { key: 'openrouter_api_key', value: openRouterKey },
      })
    } else {
      await prisma.siteConfig.deleteMany({ where: { key: 'openrouter_api_key' } })
    }
  }

  return NextResponse.json({ success: true })
}
