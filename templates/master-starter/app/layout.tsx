import type { ReactNode } from 'react';
import './globals.css';

export const metadata = { title: 'Site', description: 'A page built from the starter.' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
