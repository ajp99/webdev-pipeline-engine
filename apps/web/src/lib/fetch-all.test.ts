import { describe, expect, it } from 'vitest';
import { fetchAll, PAGE } from './fetch-all';

describe('fetchAll', () => {
  it('keeps asking for pages until one is short', async () => {
    const rows = Array.from({ length: PAGE * 2 + 5 }, (_, i) => i);
    const asked: [number, number][] = [];
    const all = await fetchAll(async (from, to) => {
      asked.push([from, to]);
      return { data: rows.slice(from, to + 1), error: null };
    });
    expect(all).toHaveLength(PAGE * 2 + 5);
    expect(asked).toEqual([
      [0, PAGE - 1],
      [PAGE, PAGE * 2 - 1],
      [PAGE * 2, PAGE * 3 - 1],
    ]);
  });
  it('throws the database error', async () => {
    await expect(
      fetchAll(async () => ({ data: null, error: { message: 'boom' } })),
    ).rejects.toThrow('boom');
  });
});
