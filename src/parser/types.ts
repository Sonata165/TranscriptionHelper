export interface SongMeta {
  title: string
  originalKey?: string  // original key, preserved during transposition
  key?: string          // current display key
  time?: string         // e.g. "4/4"
  tempo?: number
}

// One measure in the chord grid. slots.length === beatsPerMeasure (default 4)
// "-" means sustain previous chord
export interface ChordMeasure {
  slots: string[]
}

// A rhythm slot is either a single symbol, a 2-way subdivision, or a 3-way subdivision
export type RhythmSlot = string | [string, string] | [string, string, string]

// One measure in the rhythm grid. slots.length === rhythmSubdivisions (default 8)
// Each slot is one of "B", "O", "x", "-", or a [string, string] subdivision
export interface RhythmMeasure {
  slots: RhythmSlot[]
}

export interface Section {
  name: string
  chords: ChordMeasure[][]   // each sub-array is one row as written in the file
  lyric?: string[]           // one string per row, loosely aligned to chord rows
  melody?: string[][]        // parallel to chords rows; melody[row][measure] = digit string
  rhythm?: RhythmMeasure[][] // parallel to chords rows
  notes?: string             // free-form rehearsal notes
}

export interface Song {
  meta: SongMeta
  sections: Section[]
}
