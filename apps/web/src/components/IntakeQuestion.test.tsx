import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { TemplateQuestion } from '@wpe/shared';
import { IntakeQuestion } from './IntakeQuestion';

const render = (q: unknown, value: unknown = null, disabled = false, fileCount = 0) =>
  renderToStaticMarkup(
    <IntakeQuestion
      q={q as TemplateQuestion}
      value={value as never}
      fileCount={fileCount}
      disabled={disabled}
    />,
  );
// Values of the inputs that render as checked, whatever the attribute order.
const checkedValues = (html: string) =>
  [...html.matchAll(/<input[^>]*>/g)]
    .map((m) => m[0])
    .filter((tag) => tag.includes('checked=""'))
    .map((tag) => /value="([^"]*)"/.exec(tag)?.[1] ?? tag);
const base = { id: 'x', label: 'Question', required: false };

describe('IntakeQuestion', () => {
  it('marks a required question and keeps the saved text', () => {
    const html = render({ ...base, type: 'short_text', required: true }, 'Acme');
    expect(html).toContain('*');
    expect(html).toContain('value="Acme"');
    expect(html).toContain('name="q_x"');
  });

  it('does not mark an optional question', () => {
    expect(render({ ...base, type: 'short_text' })).not.toContain('*');
  });

  it('disables every input of a locked round', () => {
    expect(render({ ...base, type: 'long_text' }, 'a', true)).toMatch(/<fieldset[^>]*disabled=""/);
    expect(render({ ...base, type: 'long_text' }, 'a', false)).not.toMatch(
      /<fieldset[^>]*disabled/,
    );
  });

  it('checks the saved radio and checkbox options', () => {
    const options = [
      { value: 'a', label: 'A' },
      { value: 'b', label: 'B' },
    ];
    const single = render({ ...base, type: 'single_choice', options }, 'b');
    expect(checkedValues(single)).toEqual(['b']);
    const multi = render({ ...base, type: 'multiple_choice', options, max_selections: 1 }, ['a']);
    expect(checkedValues(multi)).toEqual(['a']);
    expect(multi).toContain('Pick up to 1');
  });

  it('shows one row per allowed link, with notes only when asked for', () => {
    const q = { ...base, type: 'links', max_links: 3, note_per_link: true };
    const html = render(q, [{ url: 'https://example.com', note: 'nice' }]);
    expect(html.match(/name="q_x_url_\d"/g)).toHaveLength(3);
    expect(html).toContain('value="https://example.com"');
    expect(html.match(/name="q_x_note_\d"/g)).toHaveLength(3);
    const plain = render({ ...q, note_per_link: false });
    expect(plain).not.toContain('q_x_note_');
  });

  it('shows the "none" choice only where the template allows it, and the file count', () => {
    const q = { ...base, type: 'file_upload', accept: ['png'], max_files: 1, max_mb: 5 };
    expect(
      checkedValues(render({ ...q, none_allowed: true }, { none: true }, false, 2)),
    ).toHaveLength(1);
    expect(render({ ...q, none_allowed: true }, null, false, 2)).toContain('2 files added');
    expect(render({ ...q, none_allowed: false })).not.toContain('q_x_none');
  });
});
