import type { Song, SongMeta, Section, ChordMeasure, RhythmMeasure, RhythmSlot } from './types'

// Parse a chord row line like "| Cm7 | F7 | Bbmaj7 | - |" → array of measures
function parseChordLine(line: string): ChordMeasure[] {
  const parts = line.split('|').map(s => s.trim()).filter((_, i, arr) => i > 0 && i < arr.length - 1)
  return parts.map(part => {
    const slots = part.trim().split(/\s+/).filter(Boolean)
    return { slots: slots.length > 0 ? slots : ['-'] }
  })
}

// Parse a rhythm slot token — "(B,O)" → ["B","O"], "(B,O,x)" → ["B","O","x"], "B" → "B"
function parseRhythmSlot(token: string): RhythmSlot {
  const m3 = token.match(/^\(([BOx\-]),([BOx\-]),([BOx\-])\)$/)
  if (m3) return [m3[1], m3[2], m3[3]]
  const m2 = token.match(/^\(([BOx\-]),([BOx\-])\)$/)
  if (m2) return [m2[1], m2[2]]
  return token
}

// Parse a rhythm row line like "| B - O - (B,O) - |" → array of measures
function parseRhythmLine(line: string): RhythmMeasure[] {
  const parts = line.split('|').map(s => s.trim()).filter((_, i, arr) => i > 0 && i < arr.length - 1)
  return parts.map(part => {
    const tokens = part.trim().split(/\s+/).filter(Boolean)
    const slots: RhythmSlot[] = tokens.length > 0 ? tokens.map(parseRhythmSlot) : ['-']
    return { slots }
  })
}

type BlockType = 'chord' | 'lyric' | 'melody' | 'rhythm' | null

export function parseSong(text: string): Song {
  const lines = text.split('\n')
  const meta: SongMeta = { title: 'Untitled' }
  const sections: Section[] = []
  let currentSection: Section | null = null
  let currentBlock: BlockType = null

  for (const raw of lines) {
    const line = raw.trimEnd()
    if (line.trim() === '') continue

    // Meta key: value (before any section)
    if (!currentSection && line.includes(':') && !line.startsWith('[')) {
      const colonIdx = line.indexOf(':')
      const key = line.slice(0, colonIdx).trim().toLowerCase()
      const value = line.slice(colonIdx + 1).trim()
      if (key === 'title') meta.title = value
      else if (key === 'originalkey') meta.originalKey = value
      else if (key === 'key') meta.key = value
      else if (key === 'time') meta.time = value
      else if (key === 'tempo') meta.tempo = parseInt(value, 10)
      continue
    }

    // Section header [Name]
    if (line.match(/^\[.+\]$/)) {
      currentSection = { name: line.slice(1, -1), chords: [] }
      sections.push(currentSection)
      currentBlock = null
      continue
    }

    if (!currentSection) continue

    // Block type declarations
    if (line.trim() === 'chord:')  { currentBlock = 'chord';  continue }
    if (line.trim() === 'lyric:')  { currentBlock = 'lyric';  continue }
    if (line.trim() === 'melody:') { currentBlock = 'melody'; continue }
    if (line.trim() === 'rhythm:') { currentBlock = 'rhythm'; continue }

    // Grid lines — each | ... | line becomes one row
    if (line.trim().startsWith('|')) {
      if (currentBlock === 'chord' || currentBlock === null) {
        currentSection.chords.push(parseChordLine(line))
      } else if (currentBlock === 'rhythm') {
        if (!currentSection.rhythm) currentSection.rhythm = []
        currentSection.rhythm.push(parseRhythmLine(line))
      }
      continue
    }

    // Text lines for lyric / melody  ('-' means intentionally empty row)
    if (currentBlock === 'lyric') {
      if (!currentSection.lyric) currentSection.lyric = []
      currentSection.lyric.push(line.trim() === '-' ? '' : line.trim())
      continue
    }
    if (currentBlock === 'melody') {
      if (!currentSection.melody) currentSection.melody = []
      currentSection.melody.push(line.trim() === '-' ? '' : line.trim())
      continue
    }
  }

  return { meta, sections }
}
