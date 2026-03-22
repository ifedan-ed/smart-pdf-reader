import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthFromRequest } from '@/lib/auth'
import { createClient, downloadFile } from '@/lib/nextcloud'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { v4 as uuidv4 } from 'uuid'

export async function POST(request: NextRequest) {
  const auth = getAuthFromRequest(request)
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { path, filename } = await request.json()

    if (!path) {
      return NextResponse.json({ error: 'path is required' }, { status: 400 })
    }

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
    const fileBuffer = await downloadFile(client, path)

    const uploadDir = join(process.cwd(), 'uploads', auth.userId)
    await mkdir(uploadDir, { recursive: true })

    const fileId = uuidv4()
    const savedFilename = `${fileId}.pdf`
    const filePath = join(uploadDir, savedFilename)

    await writeFile(filePath, fileBuffer)

    const originalFilename = filename || path.split('/').pop() || 'imported.pdf'
    const title = originalFilename.replace(/\.pdf$/i, '').replace(/[-_]/g, ' ')

    // Count pages
    let pageCount = 0
    try {
      const content = fileBuffer.toString('latin1')
      const matches = content.match(/\/Type\s*\/Page[^s]/g)
      pageCount = matches ? matches.length : 0
    } catch {
      pageCount = 0
    }

    const pdf = await prisma.pDF.create({
      data: {
        title,
        filename: originalFilename,
        path: filePath,
        pageCount,
        size: fileBuffer.length,
        source: 'nextcloud',
        userId: auth.userId,
      },
    })

    return NextResponse.json({ pdf }, { status: 201 })
  } catch (error) {
    console.error('Nextcloud copy error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to import from Nextcloud' },
      { status: 500 }
    )
  }
}
