/** Result of a notepad save. */
export interface NotepadSaveResult {
  readonly ok: boolean
}

/** Notepad content snapshot returned by the load Remote. */
export interface NotepadSnapshot {
  readonly content: string
}
