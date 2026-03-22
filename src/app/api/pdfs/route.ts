import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthFromRequest } from '@/lib/auth'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { v4 as uuidv4 } from 'uuid'

export async function GET(request: NextRequest) {
  const auth = getAuthFromRequest(request)
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const pdfs = await prisma.pDF.findMany({
      where: { userId: auth.userId },
      include: {
        progress: {
          where: { userId: auth.userId },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ pdfs })
  } catch (error) {
    console.error('Get PDFs error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = getAuthFromRequest(request)
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const formData = await request.formData()
    const file = formData.get('pdf') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Only PDF files are allowed' }, { status: 400 })
    }

    const maxSizeMB = parseInt(process.env.MAX_FILE_SIZE || '50')
    if (file.size > maxSizeMB * 1024 * 1024) {
      return NextResponse.json({ error: `File too large. Max ${maxSizeMB}MB allowed` }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const uploadDir = join(process.cwd(), 'uploads', auth.userId)
    await mkdir(uploadDir, { recursive: true })

    const fileId = uuidv4()
    const filename = `${fileId}.pdf`
    const filePath = join(uploadDir, filename)

    await writeFile(filePath, buffer)

    // Get page count (basic check - count PDF pages by reading structure)
    let pageCount = 0
    try {
      const content = buffer.toString('latin1')
      const matches = content.match(/\/Type\s*\/Page[^s]/g)
      pageCount = matches ? matches.length : 0
    } catch {
      pageCount = 0
    }

    const title = file.name.replace(/\.pdf$/i, '').replace(/[-_]/g, ' ')

    const pdf = await prisma.pDF.create({
      data: {
        title,
        filename: file.name,
        path: filePath,
        pageCount,
        size: file.size,
        source: 'upload',
        userId: auth.userId,
      },
    })

    return NextResponse.json({ pdf }, { status: 201 })
  } catch (error) {
    console.error('Upload PDF error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
