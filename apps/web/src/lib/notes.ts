// Owner notes (P2-T06): private text per project. Agents read them (never quote them to a client);
// a client cannot read the table. The review reads the newest notes up to MAX_NOTES_CHARS in all.
export const MAX_NOTE_CHARS = 5000;

/** Null when the text is fine to save, else the message to show. */
export function noteProblem(body: string): string | null {
  const t = body.trim();
  if (t === '') return 'Write the note first';
  if (t.length > MAX_NOTE_CHARS) return `A note has at most ${MAX_NOTE_CHARS} characters`;
  return null;
}
