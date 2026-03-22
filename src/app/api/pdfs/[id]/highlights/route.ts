import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthFromRequest } from '@/lib/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = getAuthFromRequest(request)
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const highlights = await prisma.highlight.findMany({
      where: { pdfId: params.id, userId: auth.userId },
      orderBy: [{ page: 'asc' }, { createdAt: 'asc' }],
    })

    return NextResponse.json({ highlights })
  } catch (error) {
    console.error('Get highlights error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = getAuthFromRequest(request)
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { page, text, color, rects } = await request.json()

    if (!page || !text || !rects) {
      return NextResponse.json({ error: 'page, text, and rects are required' }, { status: 400 })
    }

    // Verify PDF ownership
    const pdf = await prisma.pDF.findFirst({
      where: { id: params.id, userId: auth.userId },
    })

    if (!pdf) {
      return NextResponse.json({ error: 'PDF not found' }, { status: 404 })
    }

    const highlight = await prisma.highlight.create({
      data: {
        pdfId: params.id,
        userId: auth.userId,
        page,
        text,
        color: color || '#ffff00',
        rects: typeof rects === 'string' ? rects : JSON.stringify(rects),
      },
    })

    return NextResponse.json({ highlight }, { status: 201 })
  } catch (error) {
    console.error('Create highlight error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = getAuthFromRequest(request)
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { highlightId } = await request.json()

    if (!highlightId) {
      return NextResponse.json({ error: 'highlightId is required' }, { status: 400 })
    }

    const highlight = await prisma.highlight.findFirst({
      where: { id: highlightId, userId: auth.userId, pdfId: params.id },
    })

    if (!highlight) {
      return NextResponse.json({ error: 'Highlight not found' }, { status: 404 })
    }

    await prisma.highlight.delete({ where: { id: highlightId } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete highlight error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
