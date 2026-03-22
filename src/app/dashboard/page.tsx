'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface PDF {
  id: string
  title: string
  filename: string
  pageCount: number
  size: number
  source: string
  createdAt: string
  progress?: { currentPage: number }[]
}

interface User {
  id: string
  email: string
  name: string
  role: string
}

interface NextcloudFile {
  filename: string
  basename: string
  type: 'file' | 'directory'
  size: number
}

export default function DashboardPage() {
  const router = useRouter()
  const [pdfs, setPdfs] = useState<PDF[]>([])
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [showNextcloud, setShowNextcloud] = useState(false)
  const [ncFiles, setNcFiles] = useState<NextcloudFile[]>([])
  const [ncPath, setNcPath] = useState('/')
  const [ncLoading, setNcLoading] = useState(false)
  const [ncImporting, setNcImporting] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const getToken = useCallback(() => {
    return localStorage.getItem('token')
  }, [])

  const fetchWithAuth = useCallback(async (url: string, options: RequestInit = {}) => {
    const token = getToken()
    return fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${token}`,
      },
    })
  }, [getToken])

  useEffect(() => {
    const userStr = localStorage.getItem('user')
    if (userStr) {
      try {
        setUser(JSON.parse(userStr))
      } catch {
        // ignore
      }
    }

    fetchWithAuth('/api/auth/me')
      .then(res => {
        if (!res.ok) {
          router.push('/login')
          return null
        }
        return res.json()
      })
      .then(data => {
        if (data) {
          setUser(data.user)
          localStorage.setItem('user', JSON.stringify(data.user))
        }
      })
      .catch(() => router.push('/login'))
  }, [router, fetchWithAuth])

  const loadPDFs = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetchWithAuth('/api/pdfs')
      if (!res.ok) throw new Error('Failed to load')
      const data = await res.json()
      setPdfs(data.pdfs || [])
    } catch {
      setError('Failed to load PDFs')
    } finally {
      setLoading(false)
    }
  }, [fetchWithAuth])

  useEffect(() => {
    loadPDFs()
  }, [loadPDFs])

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('Only PDF files are allowed')
      return
    }

    setUploading(true)
    setError('')

    const formData = new FormData()
    formData.append('pdf', file)

    try {
      const res = await fetchWithAuth('/api/pdfs', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Upload failed')
        return
      }

      await loadPDFs()
    } catch {
      setError('Upload failed. Please try again.')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this PDF?')) return

    try {
      const res = await fetchWithAuth(`/api/pdfs/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      setPdfs(prev => prev.filter(p => p.id !== id))
    } catch {
      setError('Failed to delete PDF')
    }
  }

  async function loadNextcloudFiles(path: string) {
    setNcLoading(true)
    try {
      const res = await fetchWithAuth(`/api/nextcloud/browse?path=${encodeURIComponent(path)}`)
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Failed to browse Nextcloud')
        return
      }
      const data = await res.json()
      setNcFiles(data.files || [])
      setNcPath(path)
    } catch {
      setError('Failed to connect to Nextcloud')
    } finally {
      setNcLoading(false)
    }
  }

  async function handleNcImport(file: NextcloudFile) {
    setNcImporting(file.filename)
    try {
      const res = await fetchWithAuth('/api/nextcloud/copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: file.filename, filename: file.basename }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Import failed')
        return
      }
      setShowNextcloud(false)
      await loadPDFs()
    } catch {
      setError('Failed to import from Nextcloud')
    } finally {
      setNcImporting(null)
    }
  }

  function handleLogout() {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
    router.push('/login')
  }

  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric'
    })
  }

  const filteredPdfs = pdfs.filter(pdf =>
    pdf.title.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <span className="font-bold text-gray-900">SmartPDF Reader</span>
            </div>

            <div className="flex items-center gap-4">
              {user?.role === 'ADMIN' && (
                <Link href="/admin" className="text-sm text-gray-600 hover:text-primary-600 font-medium">
                  Admin
                </Link>
              )}
              <Link href="/settings" className="text-sm text-gray-600 hover:text-primary-600 font-medium">
                Settings
              </Link>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                  <span className="text-primary-700 font-semibold text-sm">
                    {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                  </span>
                </div>
                <span className="text-sm text-gray-700 hidden sm:block">{user?.name}</span>
              </div>
              <button
                onClick={handleLogout}
                className="text-sm text-gray-500 hover:text-red-600 transition"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Library</h1>
            <p className="text-gray-500 mt-1">{pdfs.length} document{pdfs.length !== 1 ? 's' : ''}</p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => {
                setShowNextcloud(true)
                loadNextcloudFiles('/')
              }}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition text-sm font-medium"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
              </svg>
              Import from Nextcloud
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 text-white rounded-lg transition text-sm font-semibold"
            >
              {uploading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
              )}
              {uploading ? 'Uploading...' : 'Upload PDF'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={handleUpload}
            />
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError('')} className="text-red-400 hover:text-red-600">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search documents..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            />
          </div>
        </div>

        {/* PDF Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
                <div className="w-full h-32 bg-gray-100 rounded-lg mb-3" />
                <div className="h-4 bg-gray-100 rounded mb-2" />
                <div className="h-3 bg-gray-100 rounded w-2/3" />
              </div>
            ))}
          </div>
        ) : filteredPdfs.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              {search ? 'No documents found' : 'No documents yet'}
            </h3>
            <p className="text-gray-500 text-sm mb-6">
              {search ? 'Try a different search term' : 'Upload your first PDF to get started'}
            </p>
            {!search && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition text-sm font-medium"
              >
                Upload PDF
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredPdfs.map((pdf) => {
              const lastPage = pdf.progress?.[0]?.currentPage
              const progressPercent = pdf.pageCount > 0 && lastPage
                ? Math.round((lastPage / pdf.pageCount) * 100)
                : 0

              return (
                <div key={pdf.id} className="bg-white rounded-xl border border-gray-200 hover:border-primary-300 hover:shadow-md transition-all group">
                  <div
                    className="cursor-pointer p-4"
                    onClick={() => router.push(`/reader/${pdf.id}`)}
                  >
                    <div className="w-full h-32 bg-gradient-to-br from-primary-50 to-blue-100 rounded-lg flex items-center justify-center mb-3">
                      <svg className="w-12 h-12 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>

                    <h3 className="font-semibold text-gray-900 text-sm line-clamp-2 mb-1" title={pdf.title}>
                      {pdf.title}
                    </h3>

                    <div className="text-xs text-gray-500 space-y-1">
                      <div className="flex items-center justify-between">
                        <span>{pdf.pageCount} pages</span>
                        <span>{formatSize(pdf.size)}</span>
                      </div>
                      <div>{formatDate(pdf.createdAt)}</div>
                      {pdf.source === 'nextcloud' && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-xs">
                          Nextcloud
                        </span>
                      )}
                    </div>

                    {progressPercent > 0 && (
                      <div className="mt-2">
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>Progress</span>
                          <span>{progressPercent}%</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full">
                          <div
                            className="h-full bg-primary-500 rounded-full transition-all"
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="px-4 pb-3 flex justify-between items-center border-t border-gray-50">
                    <button
                      onClick={() => router.push(`/reader/${pdf.id}`)}
                      className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                    >
                      {lastPage ? `Continue (p.${lastPage})` : 'Open'}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(pdf.id) }}
                      className="text-xs text-gray-400 hover:text-red-500 transition opacity-0 group-hover:opacity-100"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>

      {/* Nextcloud Modal */}
      {showNextcloud && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-semibold">Import from Nextcloud</h2>
              <button onClick={() => setShowNextcloud(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6">
              <div className="flex items-center gap-2 mb-4 text-sm text-gray-500">
                <button
                  onClick={() => loadNextcloudFiles('/')}
                  className="hover:text-primary-600"
                >
                  Root
                </button>
                {ncPath !== '/' && (
                  <>
                    <span>/</span>
                    <span className="text-gray-900">{ncPath}</span>
                  </>
                )}
              </div>

              {ncLoading ? (
                <div className="text-center py-8">
                  <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-gray-500 text-sm mt-3">Loading files...</p>
                </div>
              ) : ncFiles.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>No PDF files found in this directory.</p>
                  <p className="text-xs mt-2">Make sure Nextcloud is configured in Settings.</p>
                </div>
              ) : (
                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {ncPath !== '/' && (
                    <button
                      onClick={() => {
                        const parent = ncPath.split('/').slice(0, -1).join('/') || '/'
                        loadNextcloudFiles(parent)
                      }}
                      className="w-full flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg text-sm text-gray-600"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                      ..
                    </button>
                  )}
                  {ncFiles.map((file) => (
                    <div
                      key={file.filename}
                      className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg"
                    >
                      <button
                        className="flex items-center gap-3 text-sm text-left flex-1"
                        onClick={() => {
                          if (file.type === 'directory') {
                            loadNextcloudFiles(file.filename)
                          }
                        }}
                      >
                        {file.type === 'directory' ? (
                          <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
                          </svg>
                        ) : (
                          <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        )}
                        <span className="text-gray-700">{file.basename}</span>
                      </button>

                      {file.type === 'file' && (
                        <button
                          onClick={() => handleNcImport(file)}
                          disabled={ncImporting === file.filename}
                          className="text-xs px-3 py-1 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:bg-primary-400 transition"
                        >
                          {ncImporting === file.filename ? 'Importing...' : 'Import'}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
