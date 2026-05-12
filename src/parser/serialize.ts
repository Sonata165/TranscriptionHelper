import type { Song, ChordMeasure, RhythmMeasure, RhythmSlot } from './types'

function chordMeasureToStr(m: ChordMeasure): string {
  const tokens = m.slots.length > 0 ? m.slots : ['-']
  return tokens.join(' ').padEnd(6)
}

function slotToStr(s: RhythmSlot): string {
  return Array.isArray(s) ? `(${s.join(',')})` : s
}

function rhythmMeasureToStr(m: RhythmMeasure): string {
  const tokens = m.slots.length > 0 ? m.slots.map(slotToStr) : ['-']
  return tokens.join(' ')
}

export function serializeSong(song: Song): string {
  const { meta, sections } = song
  const lines: string[] = []

  lines.push(`title: ${meta.title}`)
  if (meta.originalKey) lines.push(`originalKey: ${meta.originalKey}`)
  if (meta.key)   lines.push(`key: ${meta.key}`)
  if (meta.time)  lines.push(`time: ${meta.time}`)
  if (meta.tempo) lines.push(`tempo: ${meta.tempo}`)

  for (const section of sections) {
    lines.push('')
    lines.push(`[${section.name}]`)
    lines.push('chord:')
    for (const row of section.chords) {
      lines.push('| ' + row.map(chordMeasureToStr).join(' | ') + ' |')
    }

    if (section.lyric?.some(l => l)) {
      lines.push('')
      lines.push('lyric:')
      for (const line of section.lyric) lines.push(line || '-')
    }

    if (section.melody?.some(row => row.some(m => m))) {
      lines.push('')
      lines.push('melody:')
      for (const row of section.melody) {
        lines.push('| ' + row.map(m => (m || '-').padEnd(6)).join(' | ') + ' |')
      }
    }

    if (section.rhythm) {
      lines.push('')
      lines.push('rhythm:')
      for (const row of section.rhythm) {
        lines.push('| ' + row.map(rhythmMeasureToStr).join(' | ') + ' |')
      }
    }
  }

  return lines.join('\n') + '\n'
}
