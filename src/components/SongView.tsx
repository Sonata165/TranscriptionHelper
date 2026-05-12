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
  onSplitRow: (sectionIdx: number, rowIdx: number) => void
  onDeleteSection: (sectionIdx: number) => void
  onRenameSection: (sectionIdx: number, name: string) => void
  onMergeUp: (sectionIdx: number) => void
  onMergeDown: (sectionIdx: number) => void
  onTitleChange: (title: string) => void
  onMetaChange: (field: 'key' | 'originalKey' | 'time' | 'tempo', value: string) => void
  onTranspose: (delta: number) => void
  onClearRhythm: (sectionIdx: number, rowIdx: number) => void
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

function SectionTitle({ name, sectionIdx, isFirst, isLast, onRename, onDelete, onMergeUp, onMergeDown }: {
  name: string
  sectionIdx: number
  isFirst: boolean
  isLast: boolean
  onRename: (sectionIdx: number, name: string) => void
  onDelete: (sectionIdx: number) => void
  onMergeUp: (sectionIdx: number) => void
  onMergeDown: (sectionIdx: number) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (editing) inputRef.current?.select() }, [editing])

  function commit() {
    setEditing(false)
    const v = draft.trim() || name
    if (v !== name) onRename(sectionIdx, v)
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
    </div>
  )
}

export function SongView({
  song, showLyric = true, showMelody = false, showRhythm = false,
  onChordChange, onRhythmChange, onLyricChange, onMelodyChange,
  onAddMeasure, onDeleteMeasure, onAddRow, onAddSection, onDeleteRow, onSplitRow,
  onDeleteSection, onRenameSection, onMergeUp, onMergeDown, onTitleChange, onMetaChange, onTranspose,
  onClearRhythm,
}: Props) {
  const { meta, sections } = song
  const [pendingFocusRow, setPendingFocusRow] = useState<{si: number, ri: number, last?: boolean} | null>(null)
  const [pendingMelodyFocus, setPendingMelodyFocus] = useState<{si: number, ri: number, last?: boolean} | null>(null)
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

  return (
    <div className="song-view">
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
          <EditableMeta label="Time Signature" value={meta.time || ''} onChange={v => onMetaChange('time', v)} />
          <EditableMeta label="Tempo" value={String(meta.tempo || '')} onChange={v => onMetaChange('tempo', v)} />
        </div>
      </header>

      <div className="section-add-bar section-prepend-bar no-print" onClick={() => onAddSection(-1)}>
        <div className="section-add-half">
          <span className="section-add-hint">＋ section</span>
        </div>
      </div>

      {sections.map((section, sectionIdx) => (
        <section key={sectionIdx} className="song-section">
          <SectionTitle
            name={section.name}
            sectionIdx={sectionIdx}
            isFirst={sectionIdx === 0}
            isLast={sectionIdx === sections.length - 1}
            onRename={onRenameSection}
            onDelete={onDeleteSection}
            onMergeUp={onMergeUp}
            onMergeDown={onMergeDown}
          />
          <div className="chord-grid">
            {section.chords.map((rowMeasures, rowIdx) => (
              <div key={rowIdx} className="chart-row">
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
    </div>
  )
}
