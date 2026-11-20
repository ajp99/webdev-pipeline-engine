import type { ReactNode } from 'react';

/**
 * A factual claim the client must confirm before launch (years in business, prices, results). It renders
 * normally; the release script strips the marker once the client has confirmed (spec 09).
 */
export function Claim({ children }: { children: ReactNode }) {
  return <span data-claim="">{children}</span>;
}
