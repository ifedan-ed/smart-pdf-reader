import { NextRequest, NextResponse } from 'next/server'
import { getAuthFromRequest } from '@/lib/auth'
import prisma from '@/lib/db'

export async function GET(request: NextRequest) {
  const auth = getAuthFromRequest(request)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const keys = await prisma.userApiKeys.findUnique({ where: { userId: auth.userId } })

  return NextResponse.json({
    hasElevenLabsKey: !!(keys?.elevenLabsKey),
    hasOpenRouterKey: !!(keys?.openRouterKey),
  })
}

export async function PUT(request: NextRequest) {
  const auth = getAuthFromRequest(request)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { elevenLabsKey, openRouterKey } = await request.json()

  await prisma.userApiKeys.upsert({
    where: { userId: auth.userId },
    update: {
      ...(elevenLabsKey !== undefined && { elevenLabsKey: elevenLabsKey || null }),
      ...(openRouterKey !== undefined && { openRouterKey: openRouterKey || null }),
    },
    create: {
      userId: auth.userId,
      elevenLabsKey: elevenLabsKey || null,
      openRouterKey: openRouterKey || null,
    },
  })

  return NextResponse.json({ success: true })
}
