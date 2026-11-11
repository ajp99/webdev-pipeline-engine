import { describe, expect, it } from 'vitest';
import { MAX_NOTE_CHARS, noteProblem } from './notes';

describe('noteProblem', () => {
  it('accepts a normal note and one at the limit', () => {
    expect(noteProblem('Client replies slowly')).toBeNull();
    expect(noteProblem('x'.repeat(MAX_NOTE_CHARS))).toBeNull();
  });
  it('refuses an empty note and one over the limit', () => {
    expect(noteProblem('   ')).toMatch(/first/);
    expect(noteProblem('x'.repeat(MAX_NOTE_CHARS + 1))).toMatch(/at most/);
  });
});
