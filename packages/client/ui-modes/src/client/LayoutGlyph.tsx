/**
 * The layout glyph: three columns in a frame. One component so the sidebar row
 * and the active-layout chip carry the same mark — the chip has to be
 * learnable from the row, or it reads as decoration.
 */

/** Props: the rendered pixel size and an optional class. */
export interface LayoutGlyphProps {
  /** Rendered width and height in px. */
  size?: number | undefined
  /** Optional class from the caller's stylesheet. */
  className?: string | undefined
}

/**
 * Render the layout glyph.
 * @param props - size and class.
 * @returns the svg.
 */
export function LayoutGlyph({ size = 16, className }: LayoutGlyphProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="1.9" y="2.9" width="12.2" height="10.2" rx="1.6" stroke="currentColor" strokeWidth="1.2" />
      <path d="M6.1 2.9V13.1M9.9 2.9V13.1" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  )
}
