'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import dynamic from 'next/dynamic'

// Dynamically import to avoid SSR issues
const PDFViewer = dynamic(() => import('./PDFViewer'), { ssr: false, loading: () => (
  <div className="flex items-center justify-center h-full">
    <div className="text-center">
      <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
      <p className="text-gray-500">Loading PDF viewer...</p>
    </div>
  </div>
) })

interface Highlight {
  id: string
  page: number
  text: string
  color: string
  rects: string
}

interface Voice {
  id: string
  name: string
  category: string
}

interface PDFInfo {
  id: string
  title: string
  filename: string
  pageCount: number
  path: string
}

export default function ReaderPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [pdfInfo, setPdfInfo] = useState<PDFInfo | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [zoom, setZoom] = useState(1.0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sidebarTab, setSidebarTab] = useState<'ai' | 'tts' | 'highlights' | 'ocr'>('ai')
  const [highlights, setHighlights] = useState<Highlight[]>([])
  const [voices, setVoices] = useState<Voice[]>([])
  const [selectedVoice, setSelectedVoice] = useState('')
  const [ttsApiKey, setTtsApiKey] = useState('')
  const [aiApiKey, setAiApiKey] = useState('')
  const [aiQuestion, setAiQuestion] = useState('')
  const [aiAnswer, setAiAnswer] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [summary, setSummary] = useState('')
  const [summarizing, setSummarizing] = useState(false)
  const [ttsLoading, setTtsLoading] = useState(false)
  const [audioUrl, setAudioUrl] = useState('')
  const [pageText, setPageText] = useState('')
  const [selectedText, setSelectedText] = useState('')
  const [ocrText, setOcrText] = useState('')
  const [ocrLoading, setOcrLoading] = useState(false)
  const [showHighlightPicker, setShowHighlightPicker] = useState(false)
  const [pickerPosition, setPickerPosition] = useState({ x: 0, y: 0 })
  const [pendingHighlight, setPendingHighlight] = useState<{ text: string; rects: DOMRect[] } | null>(null)
  const [highlightColor, setHighlightColor] = useState('#ffff00')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const audioRef = useRef<HTMLAudioElement>(null)

  const getToken = useCallback(() => localStorage.getItem('token'), [])

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
    const savedApiKey = localStorage.getItem('elevenlabs_api_key') || ''
    const savedAiKey = localStorage.getItem('openrouter_api_key') || ''
    setTtsApiKey(savedApiKey)
    setAiApiKey(savedAiKey)
  }, [])

  useEffect(() => {
    async function loadPDF() {
      try {
        const res = await fetchWithAuth(`/api/pdfs/${id}`)
        if (!res.ok) {
          if (res.status === 404) setError('PDF not found')
          else setError('Failed to load PDF')
          return
        }
        const data = await res.json()
        setPdfInfo(data.pdf)
      } catch {
        setError('Failed to load PDF')
      } finally {
        setLoading(false)
      }
    }
    loadPDF()
  }, [id, fetchWithAuth])

  useEffect(() => {
    async function loadProgress() {
      try {
        const res = await fetchWithAuth(`/api/pdfs/${id}/progress`)
        if (res.ok) {
          const data = await res.json()
          if (data.progress?.currentPage) {
            setCurrentPage(data.progress.currentPage)
          }
        }
      } catch {
        // ignore
      }
    }
    loadProgress()
  }, [id, fetchWithAuth])

  useEffect(() => {
    async function loadHighlights() {
      try {
        const res = await fetchWithAuth(`/api/pdfs/${id}/highlights`)
        if (res.ok) {
          const data = await res.json()
          setHighlights(data.highlights || [])
        }
      } catch {
        // ignore
      }
    }
    loadHighlights()
  }, [id, fetchWithAuth])

  const saveProgress = useCallback(async (page: number) => {
    try {
      await fetchWithAuth(`/api/pdfs/${id}/progress`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPage: page }),
      })
    } catch {
      // ignore
    }
  }, [id, fetchWithAuth])

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page)
    saveProgress(page)
    setAiAnswer('')
    setSummary('')
    setOcrText('')
  }, [saveProgress])

  async function loadVoices() {
    if (voices.length > 0) return
    try {
      const key = ttsApiKey || ''
      const res = await fetchWithAuth(`/api/tts/voices?apiKey=${encodeURIComponent(key)}`)
      if (res.ok) {
        const data = await res.json()
        setVoices(data.voices || [])
        if (data.voices?.length > 0) setSelectedVoice(data.voices[0].id)
      }
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    if (sidebarTab === 'tts') {
      loadVoices()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sidebarTab])

  async function handleAskQuestion() {
    if (!aiQuestion.trim() || !pageText) return
    setAiLoading(true)
    setAiAnswer('')
    try {
      const res = await fetchWithAuth('/api/ai/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pdfId: id,
          question: aiQuestion,
          pageText,
          apiKey: aiApiKey,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setAiAnswer(data.answer)
      } else {
        setAiAnswer(`Error: ${data.error || 'Failed to get answer'}`)
      }
    } catch {
      setAiAnswer('Network error. Please try again.')
    } finally {
      setAiLoading(false)
    }
  }

  async function handleSummarize() {
    if (!pageText) return
    setSummarizing(true)
    setSummary('')
    try {
      const res = await fetchWithAuth('/api/ai/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: pageText, apiKey: aiApiKey }),
      })
      const data = await res.json()
      if (res.ok) {
        setSummary(data.summary)
      } else {
        setSummary(`Error: ${data.error || 'Failed to summarize'}`)
      }
    } catch {
      setSummary('Network error. Please try again.')
    } finally {
      setSummarizing(false)
    }
  }

  async function handleTTS() {
    const text = selectedText || pageText
    if (!text || !selectedVoice) return
    setTtsLoading(true)
    if (audioUrl) URL.revokeObjectURL(audioUrl)
    setAudioUrl('')
    try {
      const res = await fetchWithAuth('/api/tts/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.substring(0, 5000), voiceId: selectedVoice, apiKey: ttsApiKey }),
      })
      if (res.ok) {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        setAudioUrl(url)
        setTimeout(() => audioRef.current?.play(), 100)
      } else {
        const data = await res.json()
        setError(data.error || 'TTS failed')
      }
    } catch {
      setError('TTS request failed')
    } finally {
      setTtsLoading(false)
    }
  }

  async function handleOCR(imageData: string) {
    setOcrLoading(true)
    setOcrText('')
    try {
      const res = await fetchWithAuth('/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdfId: id, page: currentPage, imageData }),
      })
      const data = await res.json()
      if (res.ok) {
        setOcrText(data.text)
      } else {
        setOcrText(`OCR Error: ${data.error}`)
      }
    } catch {
      setOcrText('OCR request failed')
    } finally {
      setOcrLoading(false)
    }
  }

  async function saveHighlight(text: string, rects: DOMRect[], color: string) {
    const rectsData = rects.map(r => ({ x: r.x, y: r.y, width: r.width, height: r.height }))
    try {
      const res = await fetchWithAuth(`/api/pdfs/${id}/highlights`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          page: currentPage,
          text,
          color,
          rects: JSON.stringify(rectsData),
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setHighlights(prev => [...prev, data.highlight])
      }
    } catch {
      // ignore
    }
  }

  async function deleteHighlight(highlightId: string) {
    try {
      await fetchWithAuth(`/api/pdfs/${id}/highlights`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ highlightId }),
      })
      setHighlights(prev => prev.filter(h => h.id !== highlightId))
    } catch {
      // ignore
    }
  }

  function handleTextSelection(text: string, rects: DOMRect[], position: { x: number; y: number }) {
    if (!text.trim()) {
      setShowHighlightPicker(false)
      return
    }
    setSelectedText(text)
    setPendingHighlight({ text, rects })
    setPickerPosition(position)
    setShowHighlightPicker(true)
  }

  function confirmHighlight() {
    if (pendingHighlight) {
      saveHighlight(pendingHighlight.text, pendingHighlight.rects, highlightColor)
    }
    setShowHighlightPicker(false)
    setPendingHighlight(null)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-400">Loading PDF...</p>
        </div>
      </div>
    )
  }

  if (error || !pdfInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error || 'PDF not found'}</p>
          <button onClick={() => router.push('/dashboard')} className="px-4 py-2 bg-primary-600 text-white rounded-lg">
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-gray-900 overflow-hidden">
      {/* Top toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/dashboard')}
            className="text-gray-400 hover:text-white transition"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <h1 className="text-white font-medium text-sm truncate max-w-xs">{pdfInfo.title}</h1>
        </div>

        <div className="flex items-center gap-3">
          {/* Page navigation */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage <= 1}
              className="p-1.5 text-gray-400 hover:text-white disabled:opacity-30 transition"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="flex items-center gap-1 text-sm">
              <input
                type="number"
                value={currentPage}
                min={1}
                max={totalPages || 1}
                onChange={(e) => {
                  const p = parseInt(e.target.value)
                  if (p >= 1 && p <= (totalPages || 1)) handlePageChange(p)
                }}
                className="w-12 text-center bg-gray-700 text-white rounded px-1 py-0.5 text-xs border border-gray-600 focus:outline-none focus:border-primary-500"
              />
              <span className="text-gray-400 text-xs">/ {totalPages}</span>
            </div>
            <button
              onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage >= totalPages}
              className="p-1.5 text-gray-400 hover:text-white disabled:opacity-30 transition"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Zoom controls */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setZoom(z => Math.max(0.5, z - 0.1))}
              className="p-1.5 text-gray-400 hover:text-white transition"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
              </svg>
            </button>
            <span className="text-gray-400 text-xs w-10 text-center">{Math.round(zoom * 100)}%</span>
            <button
              onClick={() => setZoom(z => Math.min(3, z + 0.1))}
              className="p-1.5 text-gray-400 hover:text-white transition"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
              </svg>
            </button>
            <button
              onClick={() => setZoom(1)}
              className="text-xs text-gray-400 hover:text-white px-1"
            >
              Reset
            </button>
          </div>

          <button
            onClick={() => setSidebarOpen(o => !o)}
            className="p-1.5 text-gray-400 hover:text-white transition"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
            </svg>
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* PDF Viewer Area */}
        <div className="flex-1 overflow-auto bg-gray-800 relative" onClick={() => setShowHighlightPicker(false)}>
          <PDFViewer
            pdfId={id}
            currentPage={currentPage}
            zoom={zoom}
            highlights={highlights.filter(h => h.page === currentPage)}
            onPageLoaded={(total) => setTotalPages(total)}
            onTextExtracted={(text) => setPageText(text)}
            onTextSelected={handleTextSelection}
          />

          {/* Highlight color picker popup */}
          {showHighlightPicker && (
            <div
              className="absolute z-50 bg-white rounded-xl shadow-xl p-3 flex items-center gap-2"
              style={{
                left: Math.min(pickerPosition.x, window.innerWidth - 200),
                top: pickerPosition.y + 10,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {['#ffff00', '#90EE90', '#87CEEB', '#FFB6C1', '#DDA0DD'].map(color => (
                <button
                  key={color}
                  onClick={() => setHighlightColor(color)}
                  className="w-6 h-6 rounded-full border-2 transition hover:scale-110"
                  style={{
                    background: color,
                    borderColor: highlightColor === color ? '#333' : 'transparent',
                  }}
                />
              ))}
              <button
                onClick={confirmHighlight}
                className="ml-1 px-3 py-1 bg-primary-600 text-white text-xs rounded-lg hover:bg-primary-700 transition"
              >
                Highlight
              </button>
              <button
                onClick={() => setShowHighlightPicker(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* Sidebar */}
        {sidebarOpen && (
          <div className="w-80 bg-white border-l border-gray-200 flex flex-col overflow-hidden flex-shrink-0">
            {/* Sidebar tabs */}
            <div className="flex border-b border-gray-200">
              {(['ai', 'tts', 'highlights', 'ocr'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setSidebarTab(tab)}
                  className={`flex-1 py-3 text-xs font-medium uppercase tracking-wide transition ${
                    sidebarTab === tab
                      ? 'text-primary-600 border-b-2 border-primary-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab === 'ai' ? 'AI' : tab === 'tts' ? 'TTS' : tab === 'highlights' ? 'Notes' : 'OCR'}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
              {/* AI Tab */}
              {sidebarTab === 'ai' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">OpenRouter API Key</label>
                    <input
                      type="password"
                      value={aiApiKey}
                      onChange={(e) => {
                        setAiApiKey(e.target.value)
                        localStorage.setItem('openrouter_api_key', e.target.value)
                      }}
                      placeholder="sk-or-..."
                      className="w-full text-xs px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Ask a question about this page</label>
                    <textarea
                      value={aiQuestion}
                      onChange={(e) => setAiQuestion(e.target.value)}
                      placeholder="What is the main topic of this page?"
                      rows={3}
                      className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none resize-none"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && e.ctrlKey) handleAskQuestion()
                      }}
                    />
                    <button
                      onClick={handleAskQuestion}
                      disabled={aiLoading || !aiQuestion.trim()}
                      className="w-full mt-2 py-2 px-4 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 text-white text-sm font-medium rounded-lg transition flex items-center justify-center gap-2"
                    >
                      {aiLoading ? (
                        <>
                          <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Asking...
                        </>
                      ) : 'Ask (Ctrl+Enter)'}
                    </button>
                  </div>

                  {aiAnswer && (
                    <div className="p-3 bg-primary-50 rounded-lg">
                      <p className="text-xs font-medium text-primary-700 mb-1">Answer:</p>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{aiAnswer}</p>
                    </div>
                  )}

                  <div className="border-t pt-4">
                    <button
                      onClick={handleSummarize}
                      disabled={summarizing || !pageText}
                      className="w-full py-2 px-4 border border-primary-600 text-primary-600 hover:bg-primary-50 disabled:opacity-50 text-sm font-medium rounded-lg transition flex items-center justify-center gap-2"
                    >
                      {summarizing ? (
                        <>
                          <div className="w-3 h-3 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
                          Summarizing...
                        </>
                      ) : 'Summarize This Page'}
                    </button>

                    {summary && (
                      <div className="mt-3 p-3 bg-green-50 rounded-lg">
                        <p className="text-xs font-medium text-green-700 mb-1">Summary:</p>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{summary}</p>
                      </div>
                    )}
                  </div>

                  {!pageText && (
                    <p className="text-xs text-gray-400 text-center">
                      Navigate to a page to enable AI features
                    </p>
                  )}
                </div>
              )}

              {/* TTS Tab */}
              {sidebarTab === 'tts' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">ElevenLabs API Key</label>
                    <input
                      type="password"
                      value={ttsApiKey}
                      onChange={(e) => {
                        setTtsApiKey(e.target.value)
                        localStorage.setItem('elevenlabs_api_key', e.target.value)
                      }}
                      placeholder="Your ElevenLabs API key"
                      className="w-full text-xs px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                    />
                    <button
                      onClick={() => { setVoices([]); loadVoices() }}
                      className="mt-1 text-xs text-primary-600 hover:text-primary-700"
                    >
                      Load voices
                    </button>
                  </div>

                  {voices.length > 0 && (
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Voice</label>
                      <select
                        value={selectedVoice}
                        onChange={(e) => setSelectedVoice(e.target.value)}
                        className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none bg-white"
                      >
                        {voices.map(v => (
                          <option key={v.id} value={v.id}>{v.name} ({v.category})</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <p className="text-xs text-gray-500 mb-2">
                      {selectedText
                        ? `Speaking selected text (${selectedText.length} chars)`
                        : `Speaking full page text (${pageText.length} chars)`}
                    </p>
                    <button
                      onClick={handleTTS}
                      disabled={ttsLoading || (!pageText && !selectedText) || !selectedVoice}
                      className="w-full py-2 px-4 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 text-white text-sm font-medium rounded-lg transition flex items-center justify-center gap-2"
                    >
                      {ttsLoading ? (
                        <>
                          <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Generating audio...
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072M12 6v12m0 0l-3-3m3 3l3-3M6.343 6.343a8 8 0 000 11.314" />
                          </svg>
                          Speak {selectedText ? 'Selected' : 'Page'}
                        </>
                      )}
                    </button>
                  </div>

                  {audioUrl && (
                    <div className="border rounded-lg p-3 bg-gray-50">
                      <p className="text-xs text-gray-500 mb-2">Audio ready:</p>
                      <audio
                        ref={audioRef}
                        src={audioUrl}
                        controls
                        className="w-full"
                        style={{ height: '36px' }}
                      />
                    </div>
                  )}

                  {voices.length === 0 && (
                    <p className="text-xs text-gray-400 text-center">
                      Enter your ElevenLabs API key and click &quot;Load voices&quot;
                    </p>
                  )}
                </div>
              )}

              {/* Highlights Tab */}
              {sidebarTab === 'highlights' && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">
                    Highlights ({highlights.length})
                  </h3>
                  {highlights.length === 0 ? (
                    <div className="text-center py-8">
                      <svg className="w-10 h-10 text-gray-300 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                      <p className="text-sm text-gray-400">No highlights yet</p>
                      <p className="text-xs text-gray-400 mt-1">Select text in the PDF to highlight it</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {highlights.map((h) => (
                        <div
                          key={h.id}
                          className="p-3 rounded-lg border border-gray-100 hover:border-gray-200 cursor-pointer group"
                          style={{ borderLeftColor: h.color, borderLeftWidth: 3 }}
                          onClick={() => handlePageChange(h.page)}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm text-gray-700 line-clamp-2">{h.text}</p>
                            <button
                              onClick={(e) => { e.stopPropagation(); deleteHighlight(h.id) }}
                              className="text-gray-300 hover:text-red-500 transition opacity-0 group-hover:opacity-100 flex-shrink-0"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                          <p className="text-xs text-gray-400 mt-1">Page {h.page}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* OCR Tab */}
              {sidebarTab === 'ocr' && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-1">OCR - Page {currentPage}</h3>
                    <p className="text-xs text-gray-500 mb-3">
                      Run optical character recognition on the current page to extract text from scanned PDFs.
                    </p>
                    <button
                      onClick={() => {
                        // Request canvas screenshot from PDFViewer via custom event
                        const event = new CustomEvent('request-ocr-screenshot', {
                          detail: { callback: handleOCR }
                        })
                        window.dispatchEvent(event)
                      }}
                      disabled={ocrLoading}
                      className="w-full py-2 px-4 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 text-white text-sm font-medium rounded-lg transition flex items-center justify-center gap-2"
                    >
                      {ocrLoading ? (
                        <>
                          <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Running OCR...
                        </>
                      ) : 'Run OCR on Current Page'}
                    </button>
                  </div>

                  {ocrText && (
                    <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-medium text-gray-500">Extracted Text:</p>
                        <button
                          onClick={() => navigator.clipboard.writeText(ocrText)}
                          className="text-xs text-primary-600 hover:text-primary-700"
                        >
                          Copy
                        </button>
                      </div>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap max-h-64 overflow-y-auto">{ocrText}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
