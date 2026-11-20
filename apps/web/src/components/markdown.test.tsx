import { renderToStaticMarkup } from 'react-dom/server';
import Markdown from 'react-markdown';
import { describe, expect, it } from 'vitest';

// The PRD preview and page render owner- and agent-written markdown with react-markdown (P2-T08). It must
// never turn text into live HTML or script links (gate review of 2026-11-20).
describe('markdown rendering of PRD text', () => {
  it('shows raw HTML as text and drops javascript: links', () => {
    const html = renderToStaticMarkup(
      <Markdown>
        {
          '<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>\n\n[click](javascript:alert(1))\n\n- Home'
        }
      </Markdown>,
    );
    // No live tag or attribute: HTML comes out escaped as text, and the link has no javascript: target.
    expect(html).not.toMatch(/<script|<img|<[^>]*onerror=|href="javascript:/i);
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('<li>Home</li>');
  });
});
