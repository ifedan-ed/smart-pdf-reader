'use client'

import { useEffect, useRef, useCallback, useState } from 'react'

interface HighlightData {
  id: string
  page: number
  text: string
  color: string
  rects: string
}

interface PDFViewerProps {
  pdfId: string
  currentPage: number
  zoom: number
  highlights: HighlightData[]
  onPageLoaded: (totalPages: number) => void
  onTextExtracted: (text: string) => void
  onTextSelected: (text: string, rects: DOMRect[], position: { x: number; y: number }) => void
}

export default function PDFViewer({
  pdfId,
  currentPage,
  zoom,
  highlights,
  onPageLoaded,
  onTextExtracted,
  onTextSelected,
}: PDFViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const textLayerRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfDocRef = useRef<any>(null)
  const renderTaskRef = useRef<{ cancel: () => void } | null>(null)
  const [renderError, setRenderError] = useState('')
  const [pageWidth, setPageWidth] = useState(0)
  const [pageHeight, setPageHeight] = useState(0)

  const loadAndRenderPage = useCallback(async () => {
    if (!canvasRef.current) return

    try {
      const pdfjsLib = await import('pdfjs-dist')
      pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf-worker.min.mjs'

      const token = localStorage.getItem('token')
      const pdfUrl = `/api/pdfs/${pdfId}/file`

      if (!pdfDocRef.current) {
        const loadingTask = pdfjsLib.getDocument({
          url: pdfUrl,
          httpHeaders: { Authorization: `Bearer ${token}` },
        })
        pdfDocRef.current = await loadingTask.promise
        onPageLoaded(pdfDocRef.current.numPages)
      }

      const page = await pdfDocRef.current.getPage(currentPage)
      const viewport = page.getViewport({ scale: zoom })

      const canvas = canvasRef.current
      const context = canvas.getContext('2d')
      if (!context) return

      canvas.width = viewport.width
      canvas.height = viewport.height
      setPageWidth(viewport.width)
      setPageHeight(viewport.height)

      // Cancel previous render task
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel()
      }

      const renderContext = {
        canvasContext: context,
        viewport,
      }

      const renderTask = page.render(renderContext)
      renderTaskRef.current = renderTask

      await renderTask.promise

      // Render text layer
      if (textLayerRef.current) {
        textLayerRef.current.innerHTML = ''
        textLayerRef.current.style.width = `${viewport.width}px`
        textLayerRef.current.style.height = `${viewport.height}px`

        const textContent = await page.getTextContent()

        // Extract plain text for AI/TTS
        const fullText = textContent.items
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((item: any) => item.str || '')
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim()
        onTextExtracted(fullText)

        // Render text spans for selection
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        textContent.items.forEach((item: any) => {
          if (!item.str) return
          const span = document.createElement('span')

          const tx = pdfjsLib.Util.transform(
            pdfjsLib.Util.transform(viewport.transform, item.transform),
            [1, 0, 0, -1, 0, 0]
          )

          const style = span.style
          style.left = `${tx[4]}px`
          style.top = `${tx[5]}px`
          style.fontSize = `${Math.sqrt(tx[2] * tx[2] + tx[3] * tx[3])}px`
          style.fontFamily = item.fontName || 'sans-serif'
          style.transform = `scaleX(${item.width ? (item.width * viewport.scale) / (span.offsetWidth || 1) : 1})`
          style.transformOrigin = 'left top'

          span.textContent = item.str
          textLayerRef.current!.appendChild(span)
        })
      }
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'name' in err && (err as { name: string }).name === 'RenderingCancelledException') {
        return
      }
      console.error('PDF render error:', err)
      setRenderError('Failed to render PDF page')
    }
  }, [pdfId, currentPage, zoom, onPageLoaded, onTextExtracted])

  useEffect(() => {
    pdfDocRef.current = null
    setRenderError('')
  }, [pdfId])

  useEffect(() => {
    loadAndRenderPage()
  }, [loadAndRenderPage])

  // Listen for OCR screenshot request
  useEffect(() => {
    function handleOcrRequest(e: Event) {
      const customEvent = e as CustomEvent
      if (!canvasRef.current) return
      const imageData = canvasRef.current.toDataURL('image/png')
      customEvent.detail.callback(imageData)
    }
    window.addEventListener('request-ocr-screenshot', handleOcrRequest)
    return () => window.removeEventListener('request-ocr-screenshot', handleOcrRequest)
  }, [])

  function handleMouseUp(e: React.MouseEvent) {
    const selection = window.getSelection()
    if (!selection || selection.isCollapsed) return
    const text = selection.toString().trim()
    if (!text) return

    const range = selection.getRangeAt(0)
    const rawRects = Array.from(range.getClientRects())
    const containerBounds = containerRef.current?.getBoundingClientRect()

    const rects = containerBounds
      ? rawRects.map(r => new DOMRect(
          r.x - containerBounds.x,
          r.y - containerBounds.y,
          r.width,
          r.height
        ))
      : rawRects

    onTextSelected(text, rects as DOMRect[], { x: e.clientX, y: e.clientY })
  }

  return (
    <div className="flex items-start justify-center p-8 min-h-full">
      {renderError ? (
        <div className="text-red-400 text-center mt-8">
          <p>{renderError}</p>
          <button
            onClick={() => { setRenderError(''); loadAndRenderPage() }}
            className="mt-2 text-sm text-primary-400 hover:text-primary-300"
          >
            Retry
          </button>
        </div>
      ) : (
        <div
          ref={containerRef}
          className="relative shadow-2xl"
          style={{ width: pageWidth || 'auto', height: pageHeight || 'auto' }}
          onMouseUp={handleMouseUp}
        >
          <canvas ref={canvasRef} className="block" />

          {/* Text layer for selection */}
          <div
            ref={textLayerRef}
            className="textLayer absolute inset-0 select-text"
            style={{ position: 'absolute', top: 0, left: 0 }}
          />

          {/* Highlight overlays */}
          {highlights.map((highlight) => {
            let rects: { x: number; y: number; width: number; height: number }[] = []
            try {
              rects = JSON.parse(highlight.rects)
            } catch {
              return null
            }
            return rects.map((rect, i) => (
              <div
                key={`${highlight.id}-${i}`}
                className="highlight-overlay pointer-events-none"
                style={{
                  position: 'absolute',
                  left: rect.x,
                  top: rect.y,
                  width: rect.width,
                  height: rect.height,
                  backgroundColor: highlight.color,
                  opacity: 0.4,
                  zIndex: 5,
                }}
              />
            ))
          })}
        </div>
      )}
    </div>
  )
}
