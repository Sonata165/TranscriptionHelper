import { useState, useEffect, useRef } from 'react'
import type { ChordMeasure } from '../parser/types'
import './ChordGrid.css'

const MEASURES_PER_ROW = 4
const BEATS_PER_MEASURE = 4

// Normalise for storage: m7b5 → o/, maj7 → M7
function normalizeChord(raw: string): string {
  return raw
    .replace(/m7b5/gi, 'o/')
    .replace(/maj7/gi, 'M7')
    .trim() || '-'
}

// Format for display: o/ → ø, b accidentals → ♭, # → ♯
function formatChord(chord: string): string {
  return chord
    .replace(/o\//g, 'ø')
    .replace(/m7b5/gi, 'ø')          // catch un-normalised input too
    .replace(/([A-G])b/g, '$1♭')     // root accidentals: Bb → B♭
    .replace(/b(?=[0-9])/g, '♭')     // quality accidentals: b5 → ♭5
    .replace(/#/g, '♯')
}

// --- ChordSlot ---

function ChordSlot({ chord, onChange, shouldFocus, onFocused, onTabNext, onShiftTabPrev }: {
  chord: string
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
      setDraft(chord === '-' ? '' : chord)
      setEditing(true)
      onFocused?.()
    }
  }, [shouldFocus]) // eslint-disable-line react-hooks/exhaustive-deps

  function commit() {
    setEditing(false)
    const normalised = normalizeChord(draft)
    if (normalised !== chord) onChange(normalised)
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        className="chord-slot-input"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={() => {
          const normalised = normalizeChord(draft)
          if (normalised !== chord) onChange(normalised)
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

  const isSustain = chord === '-'
  return (
    <div
      className={`chord-slot${isSustain ? ' sustain' : ' has-chord'}`}
      onClick={() => { setDraft(isSustain ? '' : chord); setEditing(true) }}
    >
      {!isSustain && formatChord(chord)}
    </div>
  )
}

// --- ChordRow ---

export interface ChordRowProps {
  measures: ChordMeasure[]
  rowIdx: number
  sectionIdx: number
  onChordChange: (sectionIdx: number, rowIdx: number, colIdx: number, slotIdx: number, value: string) => void
  onAddMeasure: (sectionIdx: number, rowIdx: number) => void
  onDeleteMeasure: (sectionIdx: number, rowIdx: number, colIdx: number) => void
  onTabOut?: () => void
  shouldFocusFirst?: boolean
  onFocusedFirst?: () => void
  onShiftTabOut?: () => void
  shouldFocusLast?: boolean
  onFocusedLast?: () => void
}

export function ChordRow({ measures, rowIdx, sectionIdx, onChordChange, onAddMeasure, onDeleteMeasure, onTabOut, shouldFocusFirst, onFocusedFirst, onShiftTabOut, shouldFocusLast, onFocusedLast }: ChordRowProps) {
  const padded = [...measures]
  while (padded.length < MEASURES_PER_ROW) padded.push({ slots: [] })

  const [pendingFocus, setPendingFocus] = useState<string | null>(null)

  useEffect(() => {
    if (shouldFocusFirst) { setPendingFocus('0-0'); onFocusedFirst?.() }
  }, [shouldFocusFirst]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (shouldFocusLast) {
      const lastCol = measures.length - 1
      setPendingFocus(`${lastCol}-${BEATS_PER_MEASURE - 1}`)
      onFocusedLast?.()
    }
  }, [shouldFocusLast]) // eslint-disable-line react-hooks/exhaustive-deps

  function tabNext(colIdx: number, beat: number) {
    const nextBeat = beat + 1
    if (nextBeat < BEATS_PER_MEASURE) {
      setPendingFocus(`${colIdx}-${nextBeat}`)
    } else {
      let nextCol = colIdx + 1
      while (nextCol < measures.length && measures[nextCol].slots.length === 0) nextCol++
      if (nextCol < measures.length) setPendingFocus(`${nextCol}-0`)
      else onTabOut?.()
    }
  }

  function tabPrev(colIdx: number, beat: number) {
    const prevBeat = beat - 1
    if (prevBeat >= 0) {
      setPendingFocus(`${colIdx}-${prevBeat}`)
    } else {
      let prevCol = colIdx - 1
      while (prevCol >= 0 && measures[prevCol].slots.length === 0) prevCol--
      if (prevCol >= 0) setPendingFocus(`${prevCol}-${BEATS_PER_MEASURE - 1}`)
      else onShiftTabOut?.()
    }
  }

  return (
    <div className="chord-row">
      {padded.map((measure, colIdx) => {
        const isEmpty = measure.slots.length === 0
        // Only the slot immediately after the last real bar is "addable"
        const isAddable = isEmpty && colIdx === measures.length
        return (
          <div
            key={colIdx}
            className={`chord-measure${isEmpty ? ' empty' : ''}${isAddable ? ' addable' : ''}`}
            onClick={isAddable ? () => onAddMeasure(sectionIdx, rowIdx) : undefined}
          >
            {isAddable && <span className="add-bar-hint">+</span>}
            {!isEmpty && (
              <>
                <button
                  type="button"
                  className="delete-bar"
                  onClick={e => { e.stopPropagation(); onDeleteMeasure(sectionIdx, rowIdx, colIdx) }}
                >×</button>
                {Array.from({ length: BEATS_PER_MEASURE }).map((_, beat) => (
                  <ChordSlot
                    key={beat}
                    chord={measure.slots[beat] ?? '-'}
                    onChange={v => onChordChange(sectionIdx, rowIdx, colIdx, beat, v)}
                    shouldFocus={pendingFocus === `${colIdx}-${beat}`}
                    onFocused={() => setPendingFocus(null)}
                    onTabNext={() => tabNext(colIdx, beat)}
                    onShiftTabPrev={() => tabPrev(colIdx, beat)}
                  />
                ))}
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}

// --- ChordGrid (convenience wrapper) ---

interface GridProps {
  rows: ChordMeasure[][]
  sectionIdx: number
  onChordChange: (sectionIdx: number, rowIdx: number, colIdx: number, slotIdx: number, value: string) => void
  onAddMeasure: (sectionIdx: number, rowIdx: number) => void
  onDeleteMeasure: (sectionIdx: number, rowIdx: number, colIdx: number) => void
}

export function ChordGrid({ rows, sectionIdx, onChordChange, onAddMeasure, onDeleteMeasure }: GridProps) {
  return (
    <div className="chord-grid">
      {rows.map((row, rowIdx) => (
        <ChordRow
          key={rowIdx}
          measures={row}
          rowIdx={rowIdx}
          sectionIdx={sectionIdx}
          onChordChange={onChordChange}
          onAddMeasure={onAddMeasure}
          onDeleteMeasure={onDeleteMeasure}
        />
      ))}
    </div>
  )
}
