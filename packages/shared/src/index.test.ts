import { describe, expect, it } from 'vitest';
import { STAGES } from './index';

describe('STAGES', () => {
  it('lists the nine stages in pipeline order', () => {
    expect(STAGES).toHaveLength(9);
    expect(STAGES[0]).toBe('intake');
    expect(STAGES[8]).toBe('closed');
  });
});
