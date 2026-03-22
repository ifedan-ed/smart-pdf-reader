import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthFromRequest } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const auth = getAuthFromRequest(request)
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (auth.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const users = await prisma.user.findMany({
      include: {
        _count: { select: { pdfs: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    const pdfsAggregate = await prisma.pDF.aggregate({
      _count: true,
      _sum: { size: true },
    })

    const stats = {
      totalUsers: users.length,
      totalPDFs: pdfsAggregate._count,
      totalStorage: pdfsAggregate._sum.size || 0,
    }

    return NextResponse.json({
      users: users.map(u => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        createdAt: u.createdAt,
        _count: u._count,
      })),
      stats,
    })
  } catch (error) {
    console.error('Admin get users error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const auth = getAuthFromRequest(request)
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (auth.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { userId } = await request.json()

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    if (userId === auth.userId) {
      return NextResponse.json({ error: 'Cannot delete yourself' }, { status: 400 })
    }

    // Get user's PDFs to delete files
    const pdfs = await prisma.pDF.findMany({ where: { userId } })
    const { unlink } = await import('fs/promises')
    const { existsSync } = await import('fs')

    for (const pdf of pdfs) {
      if (pdf.path && existsSync(pdf.path)) {
        try {
          await unlink(pdf.path)
        } catch {
          // ignore
        }
      }
    }

    await prisma.user.delete({ where: { id: userId } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Admin delete user error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const auth = getAuthFromRequest(request)
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (auth.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { userId, role } = await request.json()

    if (!userId || !role) {
      return NextResponse.json({ error: 'userId and role are required' }, { status: 400 })
    }

    if (!['USER', 'ADMIN'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { role },
      select: { id: true, email: true, name: true, role: true },
    })

    return NextResponse.json({ user })
  } catch (error) {
    console.error('Admin update role error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
