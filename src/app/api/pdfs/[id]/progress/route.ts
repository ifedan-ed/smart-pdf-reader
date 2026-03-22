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
    const progress = await prisma.readingProgress.findUnique({
      where: {
        pdfId_userId: { pdfId: params.id, userId: auth.userId },
      },
    })

    return NextResponse.json({ progress })
  } catch (error) {
    console.error('Get progress error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = getAuthFromRequest(request)
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { currentPage } = await request.json()

    if (!currentPage || typeof currentPage !== 'number') {
      return NextResponse.json({ error: 'currentPage is required' }, { status: 400 })
    }

    // Verify PDF exists and user owns it
    const pdf = await prisma.pDF.findFirst({
      where: { id: params.id, userId: auth.userId },
    })

    if (!pdf) {
      return NextResponse.json({ error: 'PDF not found' }, { status: 404 })
    }

    const progress = await prisma.readingProgress.upsert({
      where: {
        pdfId_userId: { pdfId: params.id, userId: auth.userId },
      },
      update: { currentPage },
      create: { pdfId: params.id, userId: auth.userId, currentPage },
    })

    return NextResponse.json({ progress })
  } catch (error) {
    console.error('Update progress error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
