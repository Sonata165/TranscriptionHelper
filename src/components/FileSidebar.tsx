import { useEffect, useRef, useState } from 'react'
import './FileSidebar.css'

interface Props {
  currentFile: string
  onOpen: (filename: string, content: string) => void
  onSave?: () => void | Promise<void>
}

function displayName(filename: string): string {
  return filename.replace(/\.chart$/, '').replace(/-/g, ' ')
}

function makeFilename(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\u4e00-\u9fff\-_]/g, '') + '.chart'
}

function makeTemplate(title: string): string {
  return `title: ${title.trim()}\n\n[Intro]\nchord:\n| - | - | - | - |\n`
}

export function FileSidebar({ currentFile, onOpen, onSave }: Props) {
  const [files, setFiles] = useState<string[]>([])
  const [loading, setLoading] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  async function fetchList() {
    try {
      const res = await fetch('/api/songs')
      if (res.ok) setFiles(await res.json())
    } catch { /* dev server not available */ }
  }

  useEffect(() => { fetchList() }, [])
  useEffect(() => { if (creating) inputRef.current?.focus() }, [creating])

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

  async function handleDelete(filename: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm(`Delete "${displayName(filename)}"?`)) return
    try {
      await fetch(`/api/delete?file=${encodeURIComponent(filename)}`, { method: 'DELETE' })
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
        {files.map(f => (
          <li
            key={f}
            className={`sidebar-item${f === currentFile ? ' active' : ''}${loading === f ? ' loading' : ''}`}
            onClick={() => handleClick(f)}
          >
            <span className="sidebar-item-name">{displayName(f)}</span>
            <button className="sidebar-delete" onClick={e => handleDelete(f, e)} title="Delete">×</button>
          </li>
        ))}
      </ul>
    </aside>
  )
}
