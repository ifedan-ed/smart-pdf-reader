import { createClient as createWebDAVClient } from 'webdav'

export interface NextcloudFile {
  filename: string
  basename: string
  type: 'file' | 'directory'
  size: number
  mime?: string
}

export function createClient(url: string, username: string, password: string) {
  return createWebDAVClient(url, {
    username,
    password,
  })
}

export async function listFiles(client: ReturnType<typeof createWebDAVClient>, path: string): Promise<NextcloudFile[]> {
  const contents = await client.getDirectoryContents(path)
  const items = Array.isArray(contents) ? contents : (contents as { data: unknown[] }).data || []

  return (items as Array<{
    filename: string
    basename: string
    type: string
    size: number
    mime?: string
  }>)
    .filter((item) => {
      if (item.type === 'directory') return true
      const mime = item.mime || ''
      const ext = item.basename.toLowerCase().endsWith('.pdf')
      return ext || mime === 'application/pdf'
    })
    .map((item) => ({
      filename: item.filename,
      basename: item.basename,
      type: item.type as 'file' | 'directory',
      size: item.size || 0,
      mime: item.mime,
    }))
}

export async function downloadFile(client: ReturnType<typeof createWebDAVClient>, path: string): Promise<Buffer> {
  const content = await client.getFileContents(path)
  if (Buffer.isBuffer(content)) {
    return content
  }
  if (content instanceof ArrayBuffer) {
    return Buffer.from(content)
  }
  return Buffer.from(content as string, 'binary')
}
