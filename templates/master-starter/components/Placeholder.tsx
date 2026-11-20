/** A clearly marked stand-in for a photo the client has not supplied yet, with descriptive alt text. */
export function Placeholder({ alt, ratio = '16 / 9' }: { alt: string; ratio?: string }) {
  return (
    <div
      role="img"
      aria-label={alt}
      style={{ aspectRatio: ratio }}
      className="flex w-full items-center justify-center rounded-lg border-2 border-dashed border-[var(--color-muted)] bg-[var(--color-surface)] p-4 text-center text-sm text-[var(--color-muted)]"
    >
      <span>Placeholder image: {alt}</span>
    </div>
  );
}
