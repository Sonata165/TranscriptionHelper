import { useState, useRef, useEffect } from 'react'
import type { Song, RhythmSlot } from './parser/types'
import { parseSong } from './parser/parse'
import { serializeSong } from './parser/serialize'
import { SongView } from './components/SongView'
import { FileSidebar } from './components/FileSidebar'
import autumnLeavesRaw from '../songs/autumn-leaves.chart?raw'
import './styles/global.css'

export default function App() {
  const [initialSong] = useState<Song>(() => parseSong(autumnLeavesRaw))
  const [showLyric, setShowLyric] = useState(() => initialSong.sections.some(s => s.lyric?.some(l => l)))
  const [showMelody, setShowMelody] = useState(() => {
    const hasLyric = initialSong.sections.some(s => s.lyric?.some(l => l))
    const hasMelody = initialSong.sections.some(s => s.melody?.some(row => row.some(m => m)))
    return !hasLyric && hasMelody
  })
  const [showRhythm, setShowRhythm] = useState(false)
  const [song, setSong] = useState<Song>(initialSong)
  const [currentFile, setCurrentFile] = useState('autumn-leaves.chart')
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const fileHandleRef = useRef<FileSystemFileHandle | null>(null)
  const dirHandleRef = useRef<FileSystemDirectoryHandle | null>(null)
  const filePathRef = useRef<string>('songs/autumn-leaves.chart')
  const saveSongRef = useRef<() => void>(() => {})
  const suppressSaveRef = useRef(false)
  const historyRef = useRef<Song[]>([])
  const MAX_HISTORY = 50

  function updateSong(updater: (prev: Song) => Song) {
    setSong(prev => {
      historyRef.current.push(structuredClone(prev))
      if (historyRef.current.length > MAX_HISTORY) historyRef.current.shift()
      return updater(prev)
    })
  }

  function undo() {
    const prev = historyRef.current.pop()
    if (prev) setSong(prev)
  }

  useEffect(() => {
    const last = localStorage.getItem('transcribe-last-file')
    if (!last) return
    fetch(`/api/load?file=${encodeURIComponent(last)}`)
      .then(res => res.ok ? res.text() : null)
      .then(text => { if (text) loadFromText(last, text) })
      .catch(() => {})
  }, [])

  function onChordChange(sectionIdx: number, rowIdx: number, colIdx: number, slotIdx: number, value: string) {
    updateSong(prev => {
      const next = structuredClone(prev)
      const measure = next.sections[sectionIdx].chords[rowIdx][colIdx]
      while (measure.slots.length <= slotIdx) measure.slots.push('-')
      measure.slots[slotIdx] = value
      return next
    })
  }

  function onRhythmChange(sectionIdx: number, rowIdx: number, colIdx: number, slotIdx: number, value: RhythmSlot) {
    updateSong(prev => {
      const next = structuredClone(prev)
      const section = next.sections[sectionIdx]
      if (!section.rhythm) {
        section.rhythm = section.chords.map(row =>
          Array.from({ length: row.length }, () => ({ slots: Array(8).fill('-') }))
        )
      }
      if (!section.rhythm[rowIdx]) {
        section.rhythm[rowIdx] = Array.from(
          { length: section.chords[rowIdx].length },
          () => ({ slots: Array(8).fill('-') })
        )
      }
      section.rhythm[rowIdx][colIdx].slots[slotIdx] = value
      return next
    })
  }

  function onLyricChange(sectionIdx: number, lineIdx: number, value: string) {
    updateSong(prev => {
      const next = structuredClone(prev)
      const sec = next.sections[sectionIdx]
      if (!sec.lyric) sec.lyric = []
      while (sec.lyric.length <= lineIdx) sec.lyric.push('')
      sec.lyric[lineIdx] = value
      return next
    })
  }

  function onMelodyChange(sectionIdx: number, rowIdx: number, colIdx: number, value: string) {
    updateSong(prev => {
      const next = structuredClone(prev)
      const sec = next.sections[sectionIdx]
      if (!sec.melody) sec.melody = []
      while (sec.melody.length <= rowIdx) sec.melody.push([])
      const row = sec.melody[rowIdx]
      while (row.length <= colIdx) row.push('')
      row[colIdx] = value
      return next
    })
  }

  function onAddMeasure(sectionIdx: number, rowIdx: number) {
    updateSong(prev => {
      const next = structuredClone(prev)
      const section = next.sections[sectionIdx]
      section.chords[rowIdx].push({ slots: ['-'] })
      if (section.rhythm?.[rowIdx]) {
        const rr = section.rhythm[rowIdx]
        const last = rr[rr.length - 1] ?? { slots: Array(8).fill('-') }
        rr.push(structuredClone(last))
      }
      if (section.melody?.[rowIdx]) {
        section.melody[rowIdx].push('')
      }
      return next
    })
  }

  function onDeleteMeasure(sectionIdx: number, rowIdx: number, colIdx: number) {
    updateSong(prev => {
      const next = structuredClone(prev)
      const section = next.sections[sectionIdx]
      section.chords[rowIdx].splice(colIdx, 1)
      section.rhythm?.[rowIdx]?.splice(colIdx, 1)
      section.melody?.[rowIdx]?.splice(colIdx, 1)
      return next
    })
  }

  function onDeleteSection(sectionIdx: number) {
    updateSong(prev => {
      const next = structuredClone(prev)
      next.sections.splice(sectionIdx, 1)
      return next
    })
  }

  function onMergeUp(sectionIdx: number) {
    if (sectionIdx === 0) return
    updateSong(prev => {
      const next = structuredClone(prev)
      const above = next.sections[sectionIdx - 1]
      const curr  = next.sections[sectionIdx]
      above.chords = [...above.chords, ...curr.chords]
      if (above.rhythm || curr.rhythm)
        above.rhythm = [...(above.rhythm ?? []), ...(curr.rhythm ?? [])]
      if (above.lyric || curr.lyric)
        above.lyric = [...(above.lyric ?? []), ...(curr.lyric ?? [])]
      if (above.melody || curr.melody)
        above.melody = [...(above.melody ?? []), ...(curr.melody ?? [])]
      next.sections.splice(sectionIdx, 1)
      return next
    })
  }

  function getKeyAccidental(key: string): 'sharp' | 'flat' {
    if (!key) return 'sharp'
    const normalized = key.replace(/♯/g, '#').replace(/♭/g, 'b')
    if (normalized.includes('b')) return 'flat'
    if (normalized.includes('#')) return 'sharp'
    const root = normalized[0]
    const sharpRoots = ['C', 'G', 'D', 'A', 'E', 'B']
    return sharpRoots.includes(root) ? 'sharp' : 'flat'
  }

  function transposeChord(chord: string, semitones: number, targetKey: string = ''): string {
    if (chord === '-') return '-'
    const SEMITONES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
    const NOTES_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
    const NOTES_FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']
    const NOTES = getKeyAccidental(targetKey) === 'sharp' ? NOTES_SHARP : NOTES_FLAT
    const match = chord.match(/^([A-G])(#|b)?/)
    if (!match) return chord
    const root = match[1], acc = match[2] || '', quality = chord.slice(match[0].length)
    let note = SEMITONES[root] + (acc === '#' ? 1 : acc === 'b' ? -1 : 0)
    note = (note + semitones + 120) % 12
    return NOTES[note] + quality
  }

  function transposeKey(key: string, delta: number): string {
    const SEMITONES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
    const NOTES_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
    const NOTES_FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']
    const NOTES = delta > 0 ? NOTES_SHARP : NOTES_FLAT
    const match = key.match(/^([A-G])(#|b)?/)
    if (!match) return key
    const root = match[1], acc = match[2] || '', quality = key.slice(match[0].length)
    let note = SEMITONES[root] + (acc === '#' ? 1 : acc === 'b' ? -1 : 0)
    note = (note + delta + 120) % 12
    return NOTES[note] + quality
  }

  function onTranspose(delta: number) {
    updateSong(prev => {
      const next = structuredClone(prev)
      if (!next.meta.originalKey && next.meta.key) {
        next.meta.originalKey = next.meta.key
      }
      const newKey = next.meta.key ? transposeKey(next.meta.key, delta) : ''
      next.meta.key = newKey
      for (const section of next.sections) {
        if (section.key) section.key = transposeKey(section.key, delta)
        const sectionKey = section.key || newKey
        for (const row of section.chords) {
          for (const measure of row) {
            measure.slots = measure.slots.map(slot => transposeChord(slot, delta, sectionKey))
          }
        }
      }
      return next
    })
  }

  function onSectionTranspose(sectionIdx: number, delta: number) {
    updateSong(prev => {
      const next = structuredClone(prev)
      const section = next.sections[sectionIdx]
      const currentKey = section.key || next.meta.key || ''
      const newKey = currentKey ? transposeKey(currentKey, delta) : ''
      section.key = newKey || undefined
      for (const row of section.chords) {
        for (const measure of row) {
          measure.slots = measure.slots.map(slot => transposeChord(slot, delta, newKey))
        }
      }
      return next
    })
  }

  function onSectionKeyChange(sectionIdx: number, value: string) {
    updateSong(prev => {
      const next = structuredClone(prev)
      next.sections[sectionIdx].key = value || undefined
      return next
    })
  }

  function onMergeDown(sectionIdx: number) {
    updateSong(prev => {
      const next = structuredClone(prev)
      if (sectionIdx >= next.sections.length - 1) return next
      const curr  = next.sections[sectionIdx]
      const below = next.sections[sectionIdx + 1]
      below.chords = [...curr.chords, ...below.chords]
      if (curr.rhythm || below.rhythm)
        below.rhythm = [...(curr.rhythm ?? []), ...(below.rhythm ?? [])]
      if (curr.lyric || below.lyric)
        below.lyric = [...(curr.lyric ?? []), ...(below.lyric ?? [])]
      if (curr.melody || below.melody)
        below.melody = [...(curr.melody ?? []), ...(below.melody ?? [])]
      next.sections.splice(sectionIdx, 1)
      return next
    })
  }

  function onRenameSection(sectionIdx: number, name: string) {
    updateSong(prev => {
      const next = structuredClone(prev)
      next.sections[sectionIdx].name = name
      return next
    })
  }

  function onNotesChange(sectionIdx: number, value: string) {
    updateSong(prev => {
      const next = structuredClone(prev)
      next.sections[sectionIdx].notes = value || undefined
      return next
    })
  }

  function onAddRow(sectionIdx: number) {
    updateSong(prev => {
      const next = structuredClone(prev)
      const section = next.sections[sectionIdx]
      section.chords.push([{ slots: ['-'] }, { slots: ['-'] }, { slots: ['-'] }, { slots: ['-'] }])
      if (section.rhythm) {
        const last = section.rhythm[section.rhythm.length - 1]
        section.rhythm.push(last ? structuredClone(last) : [{ slots: Array(8).fill('-') }])
      }
      return next
    })
  }

  function onAddSection(afterIdx: number) {
    updateSong(prev => {
      const next = structuredClone(prev)
      const insertAt = afterIdx < 0 ? 0 : afterIdx + 1
      next.sections.splice(insertAt, 0, { name: 'New Section', chords: [[{ slots: ['-'] }, { slots: ['-'] }, { slots: ['-'] }, { slots: ['-'] }]] })
      return next
    })
  }

  function onSplitRow(sectionIdx: number, rowIdx: number) {
    if (rowIdx === 0) return
    updateSong(prev => {
      const next = structuredClone(prev)
      const sec = next.sections[sectionIdx]
      const newSec = {
        name: 'New Section',
        chords: sec.chords.splice(rowIdx),
        rhythm: sec.rhythm ? sec.rhythm.splice(rowIdx) : undefined,
        lyric:  sec.lyric  ? sec.lyric.splice(rowIdx)  : undefined,
        melody: sec.melody ? sec.melody.splice(rowIdx) : undefined,
      }
      next.sections.splice(sectionIdx + 1, 0, newSec)
      return next
    })
  }

  function onDeleteRow(sectionIdx: number, rowIdx: number) {
    updateSong(prev => {
      const next = structuredClone(prev)
      const section = next.sections[sectionIdx]
      section.chords.splice(rowIdx, 1)
      section.rhythm?.splice(rowIdx, 1)
      section.lyric?.splice(rowIdx, 1)
      section.melody?.splice(rowIdx, 1)
      return next
    })
  }

  function onDuplicateRow(sectionIdx: number, rowIdx: number) {
    updateSong(prev => {
      const next = structuredClone(prev)
      const section = next.sections[sectionIdx]
      const chordsCopy = structuredClone(section.chords[rowIdx])
      section.chords.splice(rowIdx + 1, 0, chordsCopy)
      if (section.rhythm?.[rowIdx]) {
        section.rhythm.splice(rowIdx + 1, 0, structuredClone(section.rhythm[rowIdx]))
      }
      if (section.lyric?.[rowIdx] !== undefined) {
        if (!section.lyric) section.lyric = []
        section.lyric.splice(rowIdx + 1, 0, section.lyric[rowIdx] ?? '')
      }
      if (section.melody?.[rowIdx]) {
        if (!section.melody) section.melody = []
        section.melody.splice(rowIdx + 1, 0, structuredClone(section.melody[rowIdx]))
      }
      return next
    })
  }

  function onDuplicateSection(sectionIdx: number) {
    updateSong(prev => {
      const next = structuredClone(prev)
      const copy = structuredClone(next.sections[sectionIdx])
      copy.name = copy.name + ' Copy'
      next.sections.splice(sectionIdx + 1, 0, copy)
      return next
    })
  }

  function onMoveSection(fromIdx: number, toIdx: number) {
    if (fromIdx === toIdx) return
    updateSong(prev => {
      const next = structuredClone(prev)
      const [moved] = next.sections.splice(fromIdx, 1)
      next.sections.splice(toIdx, 0, moved)
      return next
    })
  }

  function onMoveRow(sectionIdx: number, fromIdx: number, toIdx: number) {
    if (fromIdx === toIdx) return
    updateSong(prev => {
      const next = structuredClone(prev)
      const sec = next.sections[sectionIdx]
      const [movedChord] = sec.chords.splice(fromIdx, 1)
      sec.chords.splice(toIdx, 0, movedChord)
      if (sec.rhythm) { const [r] = sec.rhythm.splice(fromIdx, 1); sec.rhythm.splice(toIdx, 0, r) }
      if (sec.lyric) { const [l] = sec.lyric.splice(fromIdx, 1); sec.lyric.splice(toIdx, 0, l) }
      if (sec.melody) { const [m] = sec.melody.splice(fromIdx, 1); sec.melody.splice(toIdx, 0, m) }
      return next
    })
  }

  function onClearRhythm(sectionIdx: number, rowIdx: number) {
    updateSong(prev => {
      const next = structuredClone(prev)
      const section = next.sections[sectionIdx]
      if (!section.rhythm) {
        section.rhythm = section.chords.map(row =>
          Array.from({ length: row.length }, () => ({ slots: Array(8).fill('-') }))
        )
      }
      if (!section.rhythm[rowIdx]) {
        section.rhythm[rowIdx] = Array.from(
          { length: section.chords[rowIdx].length },
          () => ({ slots: Array(8).fill('-') })
        )
      }
      for (const measure of section.rhythm[rowIdx]) {
        measure.slots = Array(8).fill('-')
      }
      return next
    })
  }

  function downloadFallback(text: string, filename: string) {
    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = filename; a.click()
    URL.revokeObjectURL(url)
  }

  async function writeToHandle(handle: FileSystemFileHandle, text: string) {
    const writable = await handle.createWritable()
    await writable.write(text)
    await writable.close()
    dirHandleRef.current = await (handle as any).getParent?.() ?? null
  }

  function normalizeRhythm(song: Song): Song {
    const next = structuredClone(song)
    const DEFAULT_RHYTHM = Array(8).fill('-')
    for (const section of next.sections) {
      if (!section.rhythm) continue
      for (let rowIdx = 0; rowIdx < section.chords.length; rowIdx++) {
        const chordCount = section.chords[rowIdx].length
        if (!section.rhythm[rowIdx]) section.rhythm[rowIdx] = []
        const rr = section.rhythm[rowIdx]
        if (rr.length > chordCount) rr.splice(chordCount)
        while (rr.length < chordCount) {
          const last = rr[rr.length - 1] ?? { slots: DEFAULT_RHYTHM }
          rr.push(structuredClone(last))
        }
      }
      section.rhythm.splice(section.chords.length)
    }
    return next
  }

  function autoShowLyricMelody(song: Song) {
    const hasLyric = song.sections.some(s => s.lyric?.some(l => l))
    const hasMelody = song.sections.some(s => s.melody?.some(row => row.some(m => m)))
    if (hasLyric) {
      setShowLyric(true)
      setShowMelody(false)
    } else if (hasMelody) {
      setShowLyric(false)
      setShowMelody(true)
    } else {
      setShowLyric(false)
      setShowMelody(false)
    }
  }

  function loadFromText(filename: string, text: string) {
    localStorage.setItem('transcribe-last-file', filename)
    filePathRef.current = `songs/${filename}`
    fileHandleRef.current = null
    setCurrentFile(filename)
    const parsed = normalizeRhythm(parseSong(text))
    setSong(parsed)
    historyRef.current = []
    autoShowLyricMelody(parsed)
  }

  async function openSong() {
    if (!('showOpenFilePicker' in window)) return
    try {
      const [handle] = await (window as any).showOpenFilePicker({
        startIn: dirHandleRef.current ?? 'documents',
        types: [{ description: 'Chart file', accept: { 'text/plain': ['.chart'] } }],
      })
      const file = await handle.getFile()
      const text = await file.text()
      fileHandleRef.current = handle
      dirHandleRef.current = await (handle as any).getParent?.() ?? null
      loadFromText(handle.name, text)
    } catch { /* cancelled */ }
  }

  async function saveSong() {
    const text = serializeSong(song)
    try {
      const res = await fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: filePathRef.current, content: text }),
      })
      if (res.ok) return
    } catch { /* dev server unavailable */ }
    if (fileHandleRef.current) await writeToHandle(fileHandleRef.current, text)
  }
  saveSongRef.current = saveSong

  useEffect(() => {
    const handler = () => { if (!suppressSaveRef.current) saveSongRef.current() }
    window.addEventListener('blur', handler)
    return () => window.removeEventListener('blur', handler)
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        saveSongRef.current()
        setSaveMessage('Saved')
        setTimeout(() => setSaveMessage(null), 1500)
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        const el = document.activeElement
        if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return
        e.preventDefault()
        undo()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  async function refreshSong() {
    try {
      const res = await fetch(`/api/load?file=${encodeURIComponent(currentFile)}`)
      if (res.ok) { loadFromText(currentFile, await res.text()); return }
    } catch { /* dev server unavailable */ }
    if (fileHandleRef.current) {
      const file = await fileHandleRef.current.getFile()
      loadFromText(currentFile, await file.text())
    }
  }

  async function saveAsSong() {
    const text = serializeSong(song)
    const filename = song.meta.title.toLowerCase().replace(/\s+/g, '-') + '.chart'
    if (!('showSaveFilePicker' in window)) { downloadFallback(text, filename); return }
    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: filename,
        startIn: dirHandleRef.current ?? 'documents',
        types: [{ description: 'Chart file', accept: { 'text/plain': ['.chart'] } }],
      })
      fileHandleRef.current = handle
      await writeToHandle(handle, text)
      filePathRef.current = `songs/${handle.name}`
      setCurrentFile(handle.name)
    } catch { /* cancelled */ }
  }

  async function exportChords() {
    const lines: string[] = []
    lines.push(song.meta.title)
    if (song.meta.key) lines.push(`Key: ${song.meta.key}`)
    if (song.meta.time) lines.push(`Time: ${song.meta.time}`)
    if (song.meta.tempo) lines.push(`Tempo: ${song.meta.tempo}`)
    lines.push('')
    for (const section of song.sections) {
      lines.push(`[${section.name}]`)
      for (const row of section.chords) {
        const measures = row.map(m => {
          const tokens = m.slots.length > 0 ? m.slots : ['-']
          return tokens.join(' ').padEnd(6)
        })
        lines.push('| ' + measures.join(' | ') + ' |')
      }
      lines.push('')
    }
    const text = lines.join('\n')
    const filename = song.meta.title.toLowerCase().replace(/\s+/g, '-') + '-chords.txt'
    if (!('showSaveFilePicker' in window)) { downloadFallback(text, filename); return }
    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: filename,
        startIn: dirHandleRef.current ?? 'documents',
        types: [{ description: 'Text file', accept: { 'text/plain': ['.txt'] } }],
      })
      const writable = await handle.createWritable()
      await writable.write(text)
      await writable.close()
    } catch { /* cancelled */ }
  }

  async function exportChordsAndLyrics() {
    const lines: string[] = []
    lines.push(song.meta.title)
    if (song.meta.key) lines.push(`Key: ${song.meta.key}`)
    if (song.meta.tempo) lines.push(`Tempo: ${song.meta.tempo}`)
    lines.push('')
    for (const section of song.sections) {
      lines.push(`[${section.name}]`)
      for (let rowIdx = 0; rowIdx < section.chords.length; rowIdx++) {
        const row = section.chords[rowIdx]
        const measures = row.map(m => {
          const tokens = m.slots.length > 0 ? m.slots : ['-']
          return tokens.join(' ').padEnd(6)
        })
        lines.push('| ' + measures.join(' | ') + ' |')
        const lyric = section.lyric?.[rowIdx]
        if (lyric) lines.push(lyric)
      }
      lines.push('')
    }
    const text = lines.join('\n')
    const filename = song.meta.title.toLowerCase().replace(/\s+/g, '-') + '-chords-lyrics.txt'
    if (!('showSaveFilePicker' in window)) { downloadFallback(text, filename); return }
    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: filename,
        startIn: dirHandleRef.current ?? 'documents',
        types: [{ description: 'Text file', accept: { 'text/plain': ['.txt'] } }],
      })
      const writable = await handle.createWritable()
      await writable.write(text)
      await writable.close()
    } catch { /* cancelled */ }
  }

  async function exportChordsAndMelody() {
    const lines: string[] = []
    lines.push(song.meta.title)
    if (song.meta.key) lines.push(`Key: ${song.meta.key}`)
    if (song.meta.time) lines.push(`Time: ${song.meta.time}`)
    if (song.meta.tempo) lines.push(`Tempo: ${song.meta.tempo}`)
    lines.push('')
    for (const section of song.sections) {
      lines.push(`[${section.name}]`)
      for (let rowIdx = 0; rowIdx < section.chords.length; rowIdx++) {
        const row = section.chords[rowIdx]
        const measures = row.map(m => {
          const tokens = m.slots.length > 0 ? m.slots : ['-']
          return tokens.join(' ').padEnd(6)
        })
        lines.push('| ' + measures.join(' | ') + ' |')
        const melodyRow = section.melody?.[rowIdx]
        const melodyStr = melodyRow?.filter(m => m).join(' ') ?? ''
        if (melodyStr) lines.push(melodyStr)
      }
      lines.push('')
    }
    const text = lines.join('\n')
    const filename = song.meta.title.toLowerCase().replace(/\s+/g, '-') + '-chords-melody.txt'
    if (!('showSaveFilePicker' in window)) { downloadFallback(text, filename); return }
    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: filename,
        startIn: dirHandleRef.current ?? 'documents',
        types: [{ description: 'Text file', accept: { 'text/plain': ['.txt'] } }],
      })
      const writable = await handle.createWritable()
      await writable.write(text)
      await writable.close()
    } catch { /* cancelled */ }
  }

  function generateLeadSheet(): string {
    const lines: string[] = []
    lines.push(song.meta.title)
    if (song.meta.key) lines.push(`Key: ${song.meta.key}`)
    if (song.meta.tempo) lines.push(`Tempo: ${song.meta.tempo}`)
    lines.push('')
    for (const section of song.sections) {
      const label = section.key ? `[${section.name}] (${section.key})` : `[${section.name}]`
      lines.push(label)
      for (let rowIdx = 0; rowIdx < section.chords.length; rowIdx++) {
        const row = section.chords[rowIdx]
        const measures = row.map(m => {
          const tokens = m.slots.length > 0 ? m.slots : ['-']
          return tokens.join(' ').padEnd(6)
        })
        let line = '| ' + measures.join(' | ') + ' |'
        const lyric = showLyric ? (section.lyric?.[rowIdx] || '') : ''
        const melodyRow = showMelody ? section.melody?.[rowIdx] : undefined
        const melodyStr = melodyRow?.filter(m => m).join(' ') ?? ''
        const sideText = lyric || melodyStr
        if (sideText) {
          const pad = Math.max(0, 40 - line.length)
          line += ' '.repeat(pad + 4) + sideText
        }
        lines.push(line)
      }
      lines.push('')
    }
    return lines.join('\n')
  }

  async function exportLeadSheet() {
    const text = generateLeadSheet()
    const filename = song.meta.title.toLowerCase().replace(/\s+/g, '-') + '-lead-sheet.txt'
    if (!('showSaveFilePicker' in window)) { downloadFallback(text, filename); return }
    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: filename,
        startIn: dirHandleRef.current ?? 'documents',
        types: [{ description: 'Text file', accept: { 'text/plain': ['.txt'] } }],
      })
      const writable = await handle.createWritable()
      await writable.write(text)
      await writable.close()
    } catch { /* cancelled */ }
  }

  return (
    <div className="app">
      {saveMessage && <div className="save-toast">{saveMessage}</div>}
      <nav className="toolbar no-print">
        <label><input type="checkbox" checked={showLyric} onChange={e => setShowLyric(e.target.checked)} /> Lyric</label>
        <label><input type="checkbox" checked={showMelody} onChange={e => setShowMelody(e.target.checked)} /> Melody</label>
        <label><input type="checkbox" checked={showRhythm} onChange={e => setShowRhythm(e.target.checked)} /> Rhythm</label>
        <button onClick={undo}>Undo</button>
        <button onClick={openSong}>Open</button>
        <button onClick={saveSong}>Save</button>
        <button onClick={saveAsSong}>Save As</button>
        <button onClick={refreshSong}>Refresh</button>
        <button onClick={() => window.print()}>Print / PDF</button>
        <button onClick={exportChords}>Export Chord</button>
        <button onClick={exportChordsAndLyrics}>Export Chord + Lyrics</button>
        <button onClick={exportChordsAndMelody}>Export Chord + Melody</button>
        <button onClick={exportLeadSheet}>Export Lead Sheet</button>
      </nav>
      <div className="app-body">
        <FileSidebar
          currentFile={currentFile}
          onOpen={(filename, content) => loadFromText(filename, content)}
          onSave={saveSong}
          onSuppressSave={(suppress) => { suppressSaveRef.current = suppress }}
        />
        <main className="app-main">
          <SongView
            song={song}
            showLyric={showLyric}
            showMelody={showMelody}
            showRhythm={showRhythm}
            onChordChange={onChordChange}
            onRhythmChange={onRhythmChange}
            onLyricChange={onLyricChange}
            onMelodyChange={onMelodyChange}
            onAddMeasure={onAddMeasure}
            onDeleteMeasure={onDeleteMeasure}
            onAddRow={onAddRow}
            onAddSection={onAddSection}
            onDeleteRow={onDeleteRow}
            onDuplicateRow={onDuplicateRow}
            onSplitRow={onSplitRow}
            onDeleteSection={onDeleteSection}
            onDuplicateSection={onDuplicateSection}
            onRenameSection={onRenameSection}
            onNotesChange={onNotesChange}
            onMergeUp={onMergeUp}
            onMergeDown={onMergeDown}
            onTitleChange={title => updateSong(prev => { const next = structuredClone(prev); next.meta.title = title; return next })}
            onMetaChange={(field, value) => updateSong(prev => {
              const next = structuredClone(prev)
              if (field === 'key') next.meta.key = value || undefined
              else if (field === 'originalKey') next.meta.originalKey = value || undefined
              else if (field === 'time') next.meta.time = value || undefined
              else if (field === 'tempo') next.meta.tempo = value ? parseInt(value, 10) : undefined
              return next
            })}
            onTranspose={onTranspose}
            onClearRhythm={onClearRhythm}
            onMoveSection={onMoveSection}
            onMoveRow={onMoveRow}
            onSectionTranspose={onSectionTranspose}
            onSectionKeyChange={onSectionKeyChange}
          />
        </main>
      </div>
    </div>
  )
}
