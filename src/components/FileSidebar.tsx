import { useEffect, useRef, useState } from 'react'
import './FileSidebar.css'

interface Props {
  currentFile: string
  currentTitle?: string
  onOpen: (filename: string, content: string) => void
  onSave?: () => void | Promise<void>
  onSuppressSave?: (suppress: boolean) => void
}

interface SongEntry { filename: string; title: string }

function makeFilename(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\u4e00-\u9fff\-_]/g, '') + '.chart'
}

function makeTemplate(title: string): string {
  return `title: ${title.trim()}\n\n[Intro]\nchord:\n| - | - | - | - |\n`
}

export function FileSidebar({ currentFile, currentTitle, onOpen, onSave, onSuppressSave }: Props) {
  const [files, setFiles] = useState<SongEntry[]>([])
  const [loading, setLoading] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  async function fetchList(): Promise<SongEntry[] | null> {
    try {
      const res = await fetch('/api/songs')
      if (res.ok) {
        const list: SongEntry[] = await res.json()
        setFiles(list)
        return list
      }
    } catch { /* dev server not available */ }
    return null
  }

  useEffect(() => { fetchList() }, [])
  useEffect(() => { if (creating) inputRef.current?.focus() }, [creating])

  useEffect(() => {
    if (!currentTitle) return
    setFiles(prev => prev.map(f => f.filename === currentFile ? { ...f, title: currentTitle } : f))
  }, [currentTitle, currentFile])

  async function handleClick(filename: string) {
    if (filename === currentFile) return
    await onSave?.()
    setLoading(filename)
    try {
      const res = await fetch(`/api/load?file=${encodeURIComponent(filename)}`)
      if (res.ok) onOpen(filename, await res.text())
    } finally {
      setLoading(null)
    }
  }

  async function handleDelete(filename: string, title: string, e: React.MouseEvent) {
    e.stopPropagation()
    onSuppressSave?.(true)
    try {
      if (!confirm(`Delete "${title}"?`)) return
      const res = await fetch(`/api/delete?file=${encodeURIComponent(filename)}`, { method: 'DELETE' })
      if (!res.ok) return
      const updated = await fetchList()
      if (filename === currentFile && updated && updated.length > 0) {
        const next = updated[0]
        const loadRes = await fetch(`/api/load?file=${encodeURIComponent(next.filename)}`)
        if (loadRes.ok) onOpen(next.filename, await loadRes.text())
      }
    } catch { /* server unavailable */ } finally {
      onSuppressSave?.(false)
    }
  }

  async function handleDuplicate(filename: string, title: string, e: React.MouseEvent) {
    e.stopPropagation()
    try {
      const res = await fetch(`/api/load?file=${encodeURIComponent(filename)}`)
      if (!res.ok) return
      const content = await res.text()
      const copyTitle = title + ' copy'
      const copyName = makeFilename(copyTitle)
      const copyContent = content.replace(/^(title:\s*).+/m, `$1${copyTitle}`)
      await fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: `songs/${copyName}`, content: copyContent }),
      })
      await fetchList()
    } catch { /* server unavailable */ }
  }

  async function handleCreate() {
    const title = newName.trim()
    if (!title) { setCreating(false); return }
    const filename = makeFilename(title)
    const content = makeTemplate(title)
    try {
      const res = await fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: `songs/${filename}`, content }),
      })
      if (res.ok) {
        await fetchList()
        onOpen(filename, content)
      }
    } catch { /* server unavailable */ }
    setCreating(false)
    setNewName('')
  }

  return (
    <aside className="file-sidebar no-print">
      <div className="sidebar-header">
        Songs
        <button className="sidebar-refresh" onClick={fetchList} title="Refresh">↺</button>
      </div>
      <ul className="sidebar-list">
        <li className="sidebar-item sidebar-new" onClick={() => { if (!creating) { setNewName(''); setCreating(true) } }}>
          {creating ? (
            <input
              ref={inputRef}
              className="sidebar-new-input"
              value={newName}
              placeholder="Song title…"
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleCreate()
                if (e.key === 'Escape') { setCreating(false); setNewName('') }
              }}
              onBlur={() => { setCreating(false); setNewName('') }}
              onClick={e => e.stopPropagation()}
            />
          ) : (
            <span className="sidebar-new-label">＋ New song</span>
          )}
        </li>
        {files.map(({ filename, title }) => (
          <li
            key={filename}
            className={`sidebar-item${filename === currentFile ? ' active' : ''}${loading === filename ? ' loading' : ''}`}
            onClick={() => handleClick(filename)}
          >
            <span className="sidebar-item-name">{title}</span>
            <button className="sidebar-duplicate" onClick={e => handleDuplicate(filename, title, e)} title="Duplicate">⧉</button>
            <button className="sidebar-delete" onClick={e => handleDelete(filename, title, e)} title="Delete">×</button>
          </li>
        ))}
      </ul>
    </aside>
  )
}
