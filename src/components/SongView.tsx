import { useState, useEffect, useRef } from 'react'
import type { Song, RhythmSlot } from '../parser/types'
import { ChordRow } from './ChordGrid'
import { RhythmRow } from './RhythmGrid'
import './SongView.css'

function EditableLine({ value, className, onChange }: {
  value: string
  className: string
  onChange: (v: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (editing) inputRef.current?.select() }, [editing])

  function commit() {
    setEditing(false)
    if (draft !== value) onChange(draft)
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        className={`${className} editable-line-input`}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={() => {
          if (draft !== value) onChange(draft)
          if (document.hasFocus()) setEditing(false)
        }}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); commit() }
          if (e.key === 'Escape') setEditing(false)
        }}
      />
    )
  }

  return (
    <p
      className={`${className} editable-line${value === '' ? ' empty-line' : ''}`}
      onClick={() => { setDraft(value); setEditing(true) }}
    >
      {value || <span className="line-placeholder">…</span>}
    </p>
  )
}

function MelodySlot({ value, onChange, shouldFocus, onFocused, onTabNext, onShiftTabPrev }: {
  value: string
  onChange: (v: string) => void
  shouldFocus?: boolean
  onFocused?: () => void
  onTabNext?: () => void
  onShiftTabPrev?: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (editing) inputRef.current?.select() }, [editing])

  useEffect(() => {
    if (shouldFocus) {
      setDraft(value)
      setEditing(true)
      onFocused?.()
    }
  }, [shouldFocus]) // eslint-disable-line react-hooks/exhaustive-deps

  function normalize(s: string): string {
    return s.trim().replace(/\s{2,}/g, ' ')
  }

  function commit() {
    setEditing(false)
    const normalised = normalize(draft)
    if (normalised !== value) onChange(normalised)
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        className="melody-slot-input"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={() => {
          const normalised = normalize(draft)
          if (normalised !== value) onChange(normalised)
          if (document.hasFocus()) setEditing(false)
        }}
        onKeyDown={e => {
          if (e.key === 'Tab' && !e.shiftKey) { e.preventDefault(); commit(); onTabNext?.() }
          if (e.key === 'Tab' && e.shiftKey) { e.preventDefault(); commit(); onShiftTabPrev?.() }
          if (e.key === 'Enter') { e.preventDefault(); commit() }
          if (e.key === 'Escape') setEditing(false)
        }}
      />
    )
  }

  return (
    <div
      className={`melody-slot${value === '' ? ' melody-empty' : ''}`}
      onClick={() => { setDraft(value); setEditing(true) }}
    >
      {value || <span className="melody-placeholder">…</span>}
    </div>
  )
}

function MelodyRow({ measures, measureCount, sectionIdx, rowIdx, onMelodyChange, onTabOut, onShiftTabOut, shouldFocusFirst, onFocusedFirst, shouldFocusLast, onFocusedLast }: {
  measures: string[]
  measureCount: number
  sectionIdx: number
  rowIdx: number
  onMelodyChange: (sectionIdx: number, rowIdx: number, colIdx: number, value: string) => void
  onTabOut?: () => void
  onShiftTabOut?: () => void
  shouldFocusFirst?: boolean
  onFocusedFirst?: () => void
  shouldFocusLast?: boolean
  onFocusedLast?: () => void
}) {
  const MEASURES_PER_ROW = 4
  const [pendingFocus, setPendingFocus] = useState<number | null>(null)

  useEffect(() => {
    if (shouldFocusFirst) { setPendingFocus(0); onFocusedFirst?.() }
  }, [shouldFocusFirst]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (shouldFocusLast) { setPendingFocus(measureCount - 1); onFocusedLast?.() }
  }, [shouldFocusLast]) // eslint-disable-line react-hooks/exhaustive-deps

  const padded = Array.from({ length: MEASURES_PER_ROW }, (_, i) =>
    i < measureCount ? (measures[i] ?? '') : null
  )

  function tabNext(colIdx: number) {
    let next = colIdx + 1
    while (next < measureCount && padded[next] === null) next++
    if (next < measureCount) setPendingFocus(next)
    else onTabOut?.()
  }

  function tabPrev(colIdx: number) {
    let prev = colIdx - 1
    while (prev >= 0 && padded[prev] === null) prev--
    if (prev >= 0) setPendingFocus(prev)
    else onShiftTabOut?.()
  }

  return (
    <div className="melody-row">
      {padded.map((val, colIdx) => {
        if (val === null) return <div key={colIdx} className="melody-measure empty" />
        return (
          <MelodySlot
            key={colIdx}
            value={val}
            onChange={v => onMelodyChange(sectionIdx, rowIdx, colIdx, v)}
            shouldFocus={pendingFocus === colIdx}
            onFocused={() => setPendingFocus(null)}
            onTabNext={() => tabNext(colIdx)}
            onShiftTabPrev={() => tabPrev(colIdx)}
          />
        )
      })}
    </div>
  )
}

interface Props {
  song: Song
  showLyric?: boolean
  showMelody?: boolean
  showRhythm?: boolean
  onChordChange: (sectionIdx: number, rowIdx: number, colIdx: number, slotIdx: number, value: string) => void
  onRhythmChange: (sectionIdx: number, rowIdx: number, colIdx: number, slotIdx: number, value: RhythmSlot) => void
  onLyricChange: (sectionIdx: number, lineIdx: number, value: string) => void
  onMelodyChange: (sectionIdx: number, rowIdx: number, colIdx: number, value: string) => void
  onAddMeasure: (sectionIdx: number, rowIdx: number) => void
  onDeleteMeasure: (sectionIdx: number, rowIdx: number, colIdx: number) => void
  onAddRow: (sectionIdx: number) => void
  onAddSection: (afterIdx: number) => void
  onDeleteRow: (sectionIdx: number, rowIdx: number) => void
  onDuplicateRow: (sectionIdx: number, rowIdx: number) => void
  onSplitRow: (sectionIdx: number, rowIdx: number) => void
  onDeleteSection: (sectionIdx: number) => void
  onDuplicateSection: (sectionIdx: number) => void
  onRenameSection: (sectionIdx: number, name: string) => void
  onNotesChange: (sectionIdx: number, value: string) => void
  onMergeUp: (sectionIdx: number) => void
  onMergeDown: (sectionIdx: number) => void
  onTitleChange: (title: string) => void
  onMetaChange: (field: 'key' | 'originalKey' | 'time' | 'tempo', value: string) => void
  onTranspose: (delta: number) => void
  onClearRhythm: (sectionIdx: number, rowIdx: number) => void
  onMoveSection: (fromIdx: number, toIdx: number) => void
  onMoveRow: (sectionIdx: number, fromIdx: number, toIdx: number) => void
  onSectionTranspose: (sectionIdx: number, delta: number) => void
  onSectionKeyChange: (sectionIdx: number, value: string) => void
}

function EditableMeta({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => { if (editing) inputRef.current?.select() }, [editing])
  function commit() {
    setEditing(false)
    if (draft !== value) onChange(draft)
  }
  return editing ? (
    <input
      ref={inputRef}
      className="song-meta-input"
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={() => {
        if (draft !== value) onChange(draft)
        if (document.hasFocus()) setEditing(false)
      }}
      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commit() }; if (e.key === 'Escape') setEditing(false) }}
    />
  ) : (
    <span className="song-meta-field" onClick={() => { setDraft(value); setEditing(true) }}>{label}: {value || '—'}</span>
  )
}

function SectionTitle({ name, notes, sectionKey, sectionIdx, isFirst, isLast, onRename, onDelete, onDuplicate, onMergeUp, onMergeDown, onNotesChange, onDragStart, onDragEnd, onTranspose, onKeyChange }: {
  name: string
  notes: string
  sectionKey: string
  sectionIdx: number
  isFirst: boolean
  isLast: boolean
  onRename: (sectionIdx: number, name: string) => void
  onDelete: (sectionIdx: number) => void
  onDuplicate: (sectionIdx: number) => void
  onMergeUp: (sectionIdx: number) => void
  onMergeDown: (sectionIdx: number) => void
  onNotesChange: (sectionIdx: number, value: string) => void
  onDragStart: () => void
  onDragEnd: () => void
  onTranspose: (sectionIdx: number, delta: number) => void
  onKeyChange: (sectionIdx: number, value: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const [editingNotes, setEditingNotes] = useState(false)
  const [notesDraft, setNotesDraft] = useState('')
  const notesInputRef = useRef<HTMLInputElement>(null)
  const [editingKey, setEditingKey] = useState(false)
  const [keyDraft, setKeyDraft] = useState('')
  const keyInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (editing) inputRef.current?.select() }, [editing])
  useEffect(() => { if (editingNotes) notesInputRef.current?.focus() }, [editingNotes])
  useEffect(() => { if (editingKey) keyInputRef.current?.select() }, [editingKey])

  function commit() {
    setEditing(false)
    const v = draft.trim() || name
    if (v !== name) onRename(sectionIdx, v)
  }

  function commitNotes() {
    setEditingNotes(false)
    if (notesDraft !== notes) onNotesChange(sectionIdx, notesDraft)
  }

  function commitKey() {
    setEditingKey(false)
    if (keyDraft !== sectionKey) onKeyChange(sectionIdx, keyDraft)
  }

  return (
    <div className="section-title-row">
      {editing ? (
        <input
          ref={inputRef}
          className="section-name section-name-input"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={() => {
            const v = draft.trim() || name
            if (v !== name) onRename(sectionIdx, v)
            if (document.hasFocus()) setEditing(false)
          }}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); commit() }
            if (e.key === 'Escape') setEditing(false)
          }}
        />
      ) : (
        <h2 className="section-name" onClick={() => { setDraft(name); setEditing(true) }}>{name}</h2>
      )}
      <div className="section-key-group">
        <button className="transpose-btn section-transpose-btn no-print" onClick={() => onTranspose(sectionIdx, -1)} title="Transpose section down">−</button>
        {editingKey ? (
          <input
            ref={keyInputRef}
            className="section-key-input"
            value={keyDraft}
            onChange={e => setKeyDraft(e.target.value)}
            onBlur={() => {
              if (keyDraft !== sectionKey) onKeyChange(sectionIdx, keyDraft)
              if (document.hasFocus()) setEditingKey(false)
            }}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); commitKey() }
              if (e.key === 'Escape') setEditingKey(false)
            }}
          />
        ) : (
          <span
            className={`section-key${sectionKey ? '' : ' section-key-empty'}`}
            onClick={() => { setKeyDraft(sectionKey); setEditingKey(true) }}
          >
            {sectionKey || '—'}
          </span>
        )}
        <button className="transpose-btn section-transpose-btn no-print" onClick={() => onTranspose(sectionIdx, 1)} title="Transpose section up">+</button>
      </div>
      <button
        type="button"
        className="delete-section no-print"
        title="Delete section"
        onClick={() => onDelete(sectionIdx)}
      >−</button>
      {!isFirst && (
        <button type="button" className="delete-section no-print" title="Merge up" onClick={() => onMergeUp(sectionIdx)}>↑</button>
      )}
      {!isLast && (
        <button type="button" className="delete-section no-print" title="Merge down" onClick={() => onMergeDown(sectionIdx)}>↓</button>
      )}
      <button type="button" className="delete-section no-print" title="Duplicate section" onClick={() => onDuplicate(sectionIdx)}>⧉</button>
      <span
        className="section-drag-handle no-print"
        title="Drag to reorder"
        draggable
        onDragStart={e => {
          e.dataTransfer.effectAllowed = 'move'
          onDragStart()
        }}
        onDragEnd={onDragEnd}
      >⠿</span>
      {editingNotes ? (
        <input
          ref={notesInputRef}
          className="section-notes-input"
          value={notesDraft}
          onChange={e => setNotesDraft(e.target.value)}
          onBlur={() => {
            if (notesDraft !== notes) onNotesChange(sectionIdx, notesDraft)
            if (document.hasFocus()) setEditingNotes(false)
          }}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); commitNotes() }
            if (e.key === 'Escape') setEditingNotes(false)
          }}
        />
      ) : (
        <span
          className={`section-notes${notes ? '' : ' section-notes-empty'}`}
          onClick={() => { setNotesDraft(notes); setEditingNotes(true) }}
        >
          {notes || '…'}
        </span>
      )}
    </div>
  )
}

export function SongView({
  song, showLyric = true, showMelody = false, showRhythm = false,
  onChordChange, onRhythmChange, onLyricChange, onMelodyChange,
  onAddMeasure, onDeleteMeasure, onAddRow, onAddSection, onDeleteRow, onDuplicateRow, onSplitRow,
  onDeleteSection, onDuplicateSection, onRenameSection, onNotesChange, onMergeUp, onMergeDown, onTitleChange, onMetaChange, onTranspose,
  onClearRhythm, onMoveSection, onMoveRow, onSectionTranspose, onSectionKeyChange,
}: Props) {
  const { meta, sections } = song
  const [pendingFocusRow, setPendingFocusRow] = useState<{si: number, ri: number, last?: boolean} | null>(null)
  const [pendingMelodyFocus, setPendingMelodyFocus] = useState<{si: number, ri: number, last?: boolean} | null>(null)
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [dropIdx, setDropIdx] = useState<number | null>(null)
  const [rowDrag, setRowDrag] = useState<{si: number, ri: number} | null>(null)
  const [rowDropIdx, setRowDropIdx] = useState<number | null>(null)
  const [plainView, setPlainView] = useState(false)

  useEffect(() => {
    if (!plainView) return
    function handler(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      const amount = window.innerHeight * 0.85
      if (e.key === 'ArrowRight') { e.preventDefault(); window.scrollBy({ top: amount, behavior: 'smooth' }) }
      if (e.key === 'ArrowLeft') { e.preventDefault(); window.scrollBy({ top: -amount, behavior: 'smooth' }) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [plainView])

  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const titleInputRef = useRef<HTMLInputElement>(null)
  useEffect(() => { if (editingTitle) titleInputRef.current?.select() }, [editingTitle])
  function commitTitle() {
    setEditingTitle(false)
    const v = titleDraft.trim() || meta.title
    if (v !== meta.title) onTitleChange(v)
  }

  function tabToNextRow(si: number, ri: number) {
    if (ri + 1 < sections[si].chords.length) {
      setPendingFocusRow({ si, ri: ri + 1 })
    } else if (si + 1 < sections.length) {
      setPendingFocusRow({ si: si + 1, ri: 0 })
    } else {
      const newRowIdx = sections[si].chords.length
      onAddRow(si)
      setPendingFocusRow({ si, ri: newRowIdx })
    }
  }

  function tabToPrevRow(si: number, ri: number) {
    if (ri - 1 >= 0) {
      setPendingFocusRow({ si, ri: ri - 1, last: true })
    } else if (si - 1 >= 0) {
      const prevLen = sections[si - 1].chords.length
      setPendingFocusRow({ si: si - 1, ri: prevLen - 1, last: true })
    }
  }

  function melodyTabToNextRow(si: number, ri: number) {
    if (ri + 1 < sections[si].chords.length) {
      setPendingMelodyFocus({ si, ri: ri + 1 })
    } else if (si + 1 < sections.length) {
      setPendingMelodyFocus({ si: si + 1, ri: 0 })
    }
  }

  function melodyTabToPrevRow(si: number, ri: number) {
    if (ri - 1 >= 0) {
      setPendingMelodyFocus({ si, ri: ri - 1, last: true })
    } else if (si - 1 >= 0) {
      const prevLen = sections[si - 1].chords.length
      setPendingMelodyFocus({ si: si - 1, ri: prevLen - 1, last: true })
    }
  }

  function renderPlainView() {
    const elements: React.ReactNode[] = []
    let key = 0
    function addLine(node: React.ReactNode, className?: string) { elements.push(<div key={key++} className={className}>{node}</div>) }
    function addBlank() { elements.push(<div key={key++}>&nbsp;</div>) }

    addLine(<b>{meta.title}</b>)
    if (meta.key) addLine(`Key: ${meta.key}`)
    if (meta.tempo) addLine(`Tempo: ${meta.tempo}`)
    addBlank()
    for (const section of sections) {
      const label = section.key ? `[${section.name}] (${section.key})` : `[${section.name}]`
      addLine(<b>{label}</b>)
      for (let rowIdx = 0; rowIdx < section.chords.length; rowIdx++) {
        const row = section.chords[rowIdx]
        const measures = row.map(m => {
          const tokens = m.slots.length > 0 ? m.slots : ['-']
          return tokens.join(' ').padEnd(6)
        })
        const chordParts: React.ReactNode[] = []
        chordParts.push('| ')
        measures.forEach((m, i) => {
          if (i > 0) chordParts.push(' | ')
          chordParts.push(<b key={i}>{m}</b>)
        })
        chordParts.push(' |')
        const lyric = showLyric ? (section.lyric?.[rowIdx] || '') : ''
        const melodyRow = showMelody ? section.melody?.[rowIdx] : undefined
        const melodyStr = melodyRow?.filter(m => m).join(' ') ?? ''
        const sideText = lyric || melodyStr
        const sideClass = lyric ? 'plain-lyric-col' : 'plain-melody-col'
        if (sideText) {
          addLine(
            <>
              <span className="plain-chord-col">{chordParts}</span>
              <span className={sideClass}>{sideText}</span>
            </>,
            'plain-chord-lyric-row'
          )
        } else {
          addLine(<>{chordParts}</>)
        }
      }
      addBlank()
    }
    return elements
  }

  return (
    <div className="song-view">
      <div className="switch-view-bar no-print">
        {plainView && <span className="view-hint">← → to scroll</span>}
        <button
          className="switch-view-btn"
          onClick={() => setPlainView(v => !v)}
        >{plainView ? 'Edit View' : 'Compact View'}</button>
      </div>
      {plainView ? (
        <div className="plain-view">{renderPlainView()}</div>
      ) : (<>
      <header className="song-header">
        {editingTitle ? (
          <input
            ref={titleInputRef}
            className="song-title song-title-input"
            value={titleDraft}
            onChange={e => setTitleDraft(e.target.value)}
            onBlur={() => {
              const v = titleDraft.trim() || meta.title
              if (v !== meta.title) onTitleChange(v)
              if (document.hasFocus()) setEditingTitle(false)
            }}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); commitTitle() }
              if (e.key === 'Escape') setEditingTitle(false)
            }}
          />
        ) : (
          <h1 className="song-title" onClick={() => { setTitleDraft(meta.title); setEditingTitle(true) }}>{meta.title}</h1>
        )}
        <div className="song-meta">
          <EditableMeta label="Original Key" value={meta.originalKey || ''} onChange={v => onMetaChange('originalKey', v)} />
          <div className="song-meta-key-group">
            <button className="transpose-btn" onClick={() => onTranspose(-1)} title="Transpose down">−</button>
            <EditableMeta label="Display Key" value={meta.key || ''} onChange={v => onMetaChange('key', v)} />
            <button className="transpose-btn" onClick={() => onTranspose(1)} title="Transpose up">+</button>
          </div>
          <EditableMeta label="Tempo" value={String(meta.tempo || '')} onChange={v => onMetaChange('tempo', v)} />
        </div>
      </header>

      <div className="section-add-bar section-prepend-bar no-print" onClick={() => onAddSection(-1)}>
        <div className="section-add-half">
          <span className="section-add-hint">＋ section</span>
        </div>
      </div>

      {sections.map((section, sectionIdx) => (
        <section
          key={sectionIdx}
          className={`song-section${dropIdx === sectionIdx && dragIdx !== null && dragIdx !== sectionIdx ? ' section-drop-target' : ''}`}
          onDragOver={e => {
            if (dragIdx === null) return
            e.preventDefault()
            setDropIdx(sectionIdx)
          }}
          onDragLeave={() => { if (dropIdx === sectionIdx) setDropIdx(null) }}
          onDrop={e => {
            e.preventDefault()
            if (dragIdx !== null && dragIdx !== sectionIdx) onMoveSection(dragIdx, sectionIdx)
            setDragIdx(null)
            setDropIdx(null)
          }}
        >
          <SectionTitle
            name={section.name}
            notes={section.notes || ''}
            sectionKey={section.key || ''}
            sectionIdx={sectionIdx}
            isFirst={sectionIdx === 0}
            isLast={sectionIdx === sections.length - 1}
            onRename={onRenameSection}
            onDelete={onDeleteSection}
            onDuplicate={onDuplicateSection}
            onMergeUp={onMergeUp}
            onMergeDown={onMergeDown}
            onNotesChange={onNotesChange}
            onDragStart={() => setDragIdx(sectionIdx)}
            onDragEnd={() => { setDragIdx(null); setDropIdx(null) }}
            onTranspose={onSectionTranspose}
            onKeyChange={onSectionKeyChange}
          />
          <div className="chord-grid">
            {section.chords.map((rowMeasures, rowIdx) => (
              <div
                key={rowIdx}
                className={`chart-row${rowDrag?.si === sectionIdx && rowDropIdx === rowIdx && rowDrag.ri !== rowIdx ? ' row-drop-target' : ''}`}
                onDragOver={e => {
                  if (!rowDrag || rowDrag.si !== sectionIdx) return
                  e.preventDefault()
                  e.stopPropagation()
                  setRowDropIdx(rowIdx)
                }}
                onDragLeave={e => {
                  if (!rowDrag) return
                  e.stopPropagation()
                  if (rowDropIdx === rowIdx) setRowDropIdx(null)
                }}
                onDrop={e => {
                  if (!rowDrag) return
                  e.preventDefault()
                  e.stopPropagation()
                  if (rowDrag.si === sectionIdx && rowDrag.ri !== rowIdx) {
                    onMoveRow(sectionIdx, rowDrag.ri, rowIdx)
                  }
                  setRowDrag(null)
                  setRowDropIdx(null)
                }}
              >
                <div className="chart-row-content">
                  <ChordRow
                    measures={rowMeasures}
                    rowIdx={rowIdx}
                    sectionIdx={sectionIdx}
                    onChordChange={onChordChange}
                    onAddMeasure={onAddMeasure}
                    onDeleteMeasure={onDeleteMeasure}
                    onTabOut={() => tabToNextRow(sectionIdx, rowIdx)}
                    shouldFocusFirst={pendingFocusRow?.si === sectionIdx && pendingFocusRow?.ri === rowIdx && !pendingFocusRow?.last}
                    onFocusedFirst={() => setPendingFocusRow(null)}
                    onShiftTabOut={() => tabToPrevRow(sectionIdx, rowIdx)}
                    shouldFocusLast={pendingFocusRow?.si === sectionIdx && pendingFocusRow?.ri === rowIdx && !!pendingFocusRow?.last}
                    onFocusedLast={() => setPendingFocusRow(null)}
                  />
                  {showRhythm && (
                    <RhythmRow
                      measures={section.rhythm?.[rowIdx] || Array(section.chords[rowIdx].length).fill({ slots: Array(8).fill('-') })}
                      rowIdx={rowIdx}
                      sectionIdx={sectionIdx}
                      onRhythmChange={onRhythmChange}
                    />
                  )}
                  {showLyric && (
                    <EditableLine
                      value={section.lyric?.[rowIdx] ?? ''}
                      className="lyric-line"
                      onChange={v => onLyricChange(sectionIdx, rowIdx, v)}
                    />
                  )}
                  {showMelody && (
                    <MelodyRow
                      measures={section.melody?.[rowIdx] ?? []}
                      measureCount={rowMeasures.length}
                      sectionIdx={sectionIdx}
                      rowIdx={rowIdx}
                      onMelodyChange={onMelodyChange}
                      onTabOut={() => melodyTabToNextRow(sectionIdx, rowIdx)}
                      onShiftTabOut={() => melodyTabToPrevRow(sectionIdx, rowIdx)}
                      shouldFocusFirst={pendingMelodyFocus?.si === sectionIdx && pendingMelodyFocus?.ri === rowIdx && !pendingMelodyFocus?.last}
                      onFocusedFirst={() => setPendingMelodyFocus(null)}
                      shouldFocusLast={pendingMelodyFocus?.si === sectionIdx && pendingMelodyFocus?.ri === rowIdx && !!pendingMelodyFocus?.last}
                      onFocusedLast={() => setPendingMelodyFocus(null)}
                    />
                  )}
                </div>
                <div className="delete-row-zone no-print">
                  <button
                    type="button"
                    className="delete-row"
                    title="Delete row"
                    onClick={() => onDeleteRow(sectionIdx, rowIdx)}
                  >−</button>
                  {rowIdx > 0 && (
                    <button
                      type="button"
                      className="delete-row split-row"
                      title="Split section here"
                      onClick={() => onSplitRow(sectionIdx, rowIdx)}
                    >÷</button>
                  )}
                  <button
                    type="button"
                    className="delete-row duplicate-row"
                    title="Duplicate row"
                    onClick={() => onDuplicateRow(sectionIdx, rowIdx)}
                  >⧉</button>
                  <span
                    className="row-drag-handle"
                    title="Drag to reorder"
                    draggable
                    onDragStart={e => {
                      e.stopPropagation()
                      e.dataTransfer.effectAllowed = 'move'
                      setRowDrag({ si: sectionIdx, ri: rowIdx })
                    }}
                    onDragEnd={() => { setRowDrag(null); setRowDropIdx(null) }}
                  >⠿</span>
                  {showRhythm && (
                    <button
                      type="button"
                      className="delete-row clear-rhythm"
                      title="Clear rhythm"
                      onClick={() => onClearRhythm(sectionIdx, rowIdx)}
                    >◯</button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="section-add-bar no-print">
            <div className="section-add-half" onClick={() => onAddRow(sectionIdx)}>
              <span className="section-add-hint">＋ row</span>
            </div>
            <div className="section-add-half" onClick={() => onAddSection(sectionIdx)}>
              <span className="section-add-hint">＋ section</span>
            </div>
          </div>
        </section>
      ))}
    </>)}
    </div>
  )
}
