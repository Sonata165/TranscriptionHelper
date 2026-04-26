import type { RhythmMeasure, RhythmSlot } from '../parser/types'
import './RhythmGrid.css'

const MEASURES_PER_ROW = 4
const SUBDIVISIONS = 8
const CYCLE = ['-', 'B', 'O', 'x'] as const

function nextInCycle(current: string): string {
  const idx = CYCLE.indexOf(current as typeof CYCLE[number])
  return CYCLE[(idx + 1) % CYCLE.length]
}

// --- RhythmRow ---

export interface RhythmRowProps {
  measures: RhythmMeasure[]
  rowIdx: number
  sectionIdx: number
  onRhythmChange: (sectionIdx: number, rowIdx: number, colIdx: number, slotIdx: number, value: RhythmSlot) => void
}

export function RhythmRow({ measures, rowIdx, sectionIdx, onRhythmChange }: RhythmRowProps) {
  const padded = [...measures]
  while (padded.length < MEASURES_PER_ROW) padded.push({ slots: [] })

  function cycleSlot(colIdx: number, slotIdx: number, current: string) {
    onRhythmChange(sectionIdx, rowIdx, colIdx, slotIdx, nextInCycle(current))
  }

  function handleRightClick(colIdx: number, slotIdx: number, current: RhythmSlot) {
    if (typeof current === 'string') {
      // single → 2-split
      onRhythmChange(sectionIdx, rowIdx, colIdx, slotIdx, [current, '-'])
    } else if (current.length === 2) {
      // 2-split → 3-split
      onRhythmChange(sectionIdx, rowIdx, colIdx, slotIdx, [current[0], current[1], '-'])
    } else {
      // 3-split → collapse back to single
      onRhythmChange(sectionIdx, rowIdx, colIdx, slotIdx, current[0])
    }
  }

  function cycleSubSlot(colIdx: number, slotIdx: number, subIdx: number, current: string[]) {
    const updated = [...current] as [string, string] | [string, string, string]
    updated[subIdx] = nextInCycle(updated[subIdx])
    onRhythmChange(sectionIdx, rowIdx, colIdx, slotIdx, updated)
  }

  return (
    <div className="rhythm-row">
      {padded.map((measure, colIdx) => (
        <div key={colIdx} className={`rhythm-measure${measure.slots.length === 0 ? ' empty' : ''}`}>
          {measure.slots.length > 0 && Array.from({ length: SUBDIVISIONS }).map((_, slot) => {
            const s = measure.slots[slot] ?? '-'
            if (Array.isArray(s)) {
              return (
                <div
                  key={slot}
                  className={`rhythm-slot subdivided${slot % 2 === 0 ? ' on-beat' : ''}`}
                  onContextMenu={e => { e.preventDefault(); handleRightClick(colIdx, slot, s) }}
                >
                  {s.map((sym, subIdx) => (
                    <div
                      key={subIdx}
                      className={`rhythm-sub-cell${subIdx < s.length - 1 ? ' has-border' : ''}`}
                      onClick={() => cycleSubSlot(colIdx, slot, subIdx, s)}
                    >
                      {sym !== '-' && <span className={`rsym rsym-${sym}`}>{sym}</span>}
                    </div>
                  ))}
                </div>
              )
            }
            return (
              <div
                key={slot}
                className={`rhythm-slot${slot % 2 === 0 ? ' on-beat' : ''}`}
                onClick={() => cycleSlot(colIdx, slot, s)}
                onContextMenu={e => { e.preventDefault(); handleRightClick(colIdx, slot, s) }}
                title={s === '-' ? 'rest' : s}
              >
                {s !== '-' && <span className={`rsym rsym-${s}`}>{s}</span>}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

// --- RhythmGrid (convenience wrapper) ---

interface GridProps {
  rows: RhythmMeasure[][]
  sectionIdx: number
  onRhythmChange: (sectionIdx: number, rowIdx: number, colIdx: number, slotIdx: number, value: RhythmSlot) => void
}

export function RhythmGrid({ rows, sectionIdx, onRhythmChange }: GridProps) {
  return (
    <div className="rhythm-grid">
      {rows.map((row, rowIdx) => (
        <RhythmRow
          key={rowIdx}
          measures={row}
          rowIdx={rowIdx}
          sectionIdx={sectionIdx}
          onRhythmChange={onRhythmChange}
        />
      ))}
    </div>
  )
}
