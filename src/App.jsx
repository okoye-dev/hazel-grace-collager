import { useEffect, useMemo, useRef, useState } from 'react'
import { generatePdf, pageCount } from './lib/pdf.js'

let nextId = 1

const PAGE_RATIO = { a4: 210 / 297, letter: 215.9 / 279.4 }

export default function App() {
  const [items, setItems] = useState([]) // {id, file, url, name}
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(null)
  const dragIndex = useRef(null)

  const [opts, setOpts] = useState({
    pageFormat: 'a4',
    orientation: 'portrait',
    cols: 3,
    rows: 4,
    marginMm: 10,
    gapMm: 4,
    cutLines: true,
    dpi: 300,
  })

  // Revoke object URLs when items are removed/unmounted.
  useEffect(() => {
    return () => items.forEach((it) => URL.revokeObjectURL(it.url))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function addFiles(fileList) {
    const incoming = Array.from(fileList).filter((f) => f.type.startsWith('image/'))
    const mapped = incoming.map((file) => ({
      id: nextId++,
      file,
      url: URL.createObjectURL(file),
      name: file.name,
    }))
    setItems((prev) => [...prev, ...mapped])
  }

  function removeItem(id) {
    setItems((prev) => {
      const target = prev.find((it) => it.id === id)
      if (target) URL.revokeObjectURL(target.url)
      return prev.filter((it) => it.id !== id)
    })
  }

  function clearAll() {
    items.forEach((it) => URL.revokeObjectURL(it.url))
    setItems([])
  }

  function reorder(from, to) {
    if (from === to || from == null || to == null) return
    setItems((prev) => {
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
  }

  function setOpt(key, value) {
    setOpts((prev) => ({ ...prev, [key]: value }))
  }

  async function handleGenerate() {
    if (!items.length || busy) return
    setBusy(true)
    setProgress({ done: 0, total: items.length })
    try {
      const doc = await generatePdf(items, {
        ...opts,
        onProgress: (done, total) => setProgress({ done, total }),
      })
      doc.save('collage.pdf')
    } catch (err) {
      console.error(err)
      alert('Could not generate the PDF: ' + (err?.message || err))
    } finally {
      setBusy(false)
      setProgress(null)
    }
  }

  const perPage = opts.cols * opts.rows
  const pages = pageCount(items.length, opts.cols, opts.rows)

  return (
    <div className="app">
      <header>
        <h1>A Silly Lover's Collage Maker</h1>
        <p className="sub">
          This tool was made with a lot of love, and a lot of hope.
          Hope that you will see how much I want to love you, Hazel Grace.<br/>
          How much I will.
        </p>
      </header>

      <section className="controls">
        <div className="field">
          <label>Page</label>
          <select
            value={opts.pageFormat}
            onChange={(e) => setOpt('pageFormat', e.target.value)}
          >
            <option value="a4">A4</option>
            <option value="letter">Letter</option>
          </select>
        </div>
        <div className="field">
          <label>Orientation</label>
          <select
            value={opts.orientation}
            onChange={(e) => setOpt('orientation', e.target.value)}
          >
            <option value="portrait">Portrait</option>
            <option value="landscape">Landscape</option>
          </select>
        </div>
        <div className="field">
          <label>Columns</label>
          <input
            type="number"
            min="1"
            max="8"
            value={opts.cols}
            onChange={(e) => setOpt('cols', clampInt(e.target.value, 1, 8, 3))}
          />
        </div>
        <div className="field">
          <label>Rows</label>
          <input
            type="number"
            min="1"
            max="8"
            value={opts.rows}
            onChange={(e) => setOpt('rows', clampInt(e.target.value, 1, 8, 4))}
          />
        </div>
        <div className="field">
          <label>Margin (mm)</label>
          <input
            type="number"
            min="0"
            max="40"
            value={opts.marginMm}
            onChange={(e) => setOpt('marginMm', clampInt(e.target.value, 0, 40, 10))}
          />
        </div>
        <div className="field">
          <label>Gap (mm)</label>
          <input
            type="number"
            min="0"
            max="40"
            value={opts.gapMm}
            onChange={(e) => setOpt('gapMm', clampInt(e.target.value, 0, 40, 4))}
          />
        </div>
        <div className="field">
          <label>Quality (DPI)</label>
          <select
            value={opts.dpi}
            onChange={(e) => setOpt('dpi', Number(e.target.value))}
          >
            <option value={150}>150 (smaller file)</option>
            <option value={300}>300 (print)</option>
            <option value={450}>450 (max)</option>
          </select>
        </div>
        <div className="field checkbox">
          <label>
            <input
              type="checkbox"
              checked={opts.cutLines}
              onChange={(e) => setOpt('cutLines', e.target.checked)}
            />
            Cut guide lines
          </label>
        </div>
      </section>

      <Dropzone onFiles={addFiles} />

      <div className="bar">
        <span>
          {items.length} image{items.length === 1 ? '' : 's'} · {perPage}/page ·{' '}
          {pages} page{pages === 1 ? '' : 's'}
        </span>
        <div className="bar-actions">
          {items.length > 0 && (
            <button className="ghost" onClick={clearAll} disabled={busy}>
              Clear all
            </button>
          )}
          <button className="primary" onClick={handleGenerate} disabled={!items.length || busy}>
            {busy && progress
              ? `Rendering ${progress.done}/${progress.total}…`
              : 'Download PDF'}
          </button>
        </div>
      </div>

      {items.length > 0 && (
        <Preview
          items={items}
          opts={opts}
          onRemove={removeItem}
          onDragStart={(i) => (dragIndex.current = i)}
          onDrop={(i) => {
            reorder(dragIndex.current, i)
            dragIndex.current = null
          }}
        />
      )}
    </div>
  )
}

function Dropzone({ onFiles }) {
  const [over, setOver] = useState(false)
  const inputRef = useRef(null)
  return (
    <div
      className={'dropzone' + (over ? ' over' : '')}
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        if (e.dataTransfer.files?.length) onFiles(e.dataTransfer.files)
      }}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files?.length) onFiles(e.target.files)
          e.target.value = ''
        }}
      />
      <strong>Click to choose images</strong>
      <span>or drag &amp; drop them here</span>
    </div>
  )
}

function Preview({ items, opts, onRemove, onDragStart, onDrop }) {
  // Mirror the PDF page layout on screen using the same contain logic.
  const ratio = (PAGE_RATIO[opts.pageFormat] || PAGE_RATIO.a4)
  const pageAspect = opts.orientation === 'landscape' ? 1 / ratio : ratio

  const pages = useMemo(() => {
    const perPage = opts.cols * opts.rows
    const chunks = []
    for (let i = 0; i < items.length; i += perPage) {
      chunks.push(items.slice(i, i + perPage))
    }
    return chunks
  }, [items, opts.cols, opts.rows])

  return (
    <div className="pages">
      {pages.map((pageItems, p) => (
        <div className="page-wrap" key={p}>
          <div className="page-label">Page {p + 1}</div>
          <div
            className="page"
            style={{
              aspectRatio: pageAspect,
              padding: `${pct(opts.marginMm, opts)}%`,
            }}
          >
            <div
              className="grid"
              style={{
                gridTemplateColumns: `repeat(${opts.cols}, 1fr)`,
                gridTemplateRows: `repeat(${opts.rows}, 1fr)`,
                gap: `${pct(opts.gapMm, opts)}%`,
              }}
            >
              {pageItems.map((it) => {
                const globalIndex = items.indexOf(it)
                return (
                  <div
                    className="cell"
                    key={it.id}
                    draggable
                    onDragStart={() => onDragStart(globalIndex)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => onDrop(globalIndex)}
                  >
                    <img
                      src={it.url}
                      alt={it.name}
                      style={{ outline: opts.cutLines ? '1px solid #b0b0b0' : 'none' }}
                    />
                    <button
                      className="remove"
                      title="Remove"
                      onClick={() => onRemove(it.id)}
                    >
                      ×
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// Percentage of page width (preview only) for margin/gap, so the on-screen
// page roughly matches the printed proportions.
function pct(mm, opts) {
  const widthMm = opts.pageFormat === 'letter' ? 215.9 : 210
  const w = opts.orientation === 'landscape' ? (widthMm === 210 ? 297 : 279.4) : widthMm
  return (mm / w) * 100
}

function clampInt(value, min, max, fallback) {
  const n = parseInt(value, 10)
  if (Number.isNaN(n)) return fallback
  return Math.min(max, Math.max(min, n))
}
