'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/** Reloads the server data of the page every few seconds while something is still running. */
export function AutoRefresh({ seconds = 5 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), seconds * 1000);
    return () => clearInterval(t);
  }, [router, seconds]);
  return null;
}
