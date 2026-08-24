import type { IconProps } from './icons/props.ts'

export interface SaddleLogoProps extends IconProps {
  /** Whether to render the luxury amber/gold gradient; defaults to true. */
  colored?: boolean | undefined
}

/**
 * Render the sovereign Saddle logo mark with luxury amber/gold gradient or monochrome fill.
 * @param props - SaddleLogoProps sizing, class, and color mode.
 * @returns the logo svg.
 */
export function SaddleLogo({ size = 24, className, colored = true }: SaddleLogoProps) {
  const gradientId = 'saddle-amber-gold-grad'
  return (
    <svg
      width={size}
      height={size}
      className={className}
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
    >
      {colored ? (
        <defs>
          <linearGradient id={gradientId} x1="6" y1="8" x2="42" y2="40" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#F59E0B" />
            <stop offset="50%" stopColor="#EAB308" />
            <stop offset="100%" stopColor="#D97706" />
          </linearGradient>
        </defs>
      ) : null}
      <path
        d="M9 17C12.5 13 17.5 12.5 22.5 15.5C26.8 18 30.5 18.8 35 16.5C39.2 14.2 41.5 12.5 42.8 11.5C43.5 10.9 44.5 11.6 44.2 12.5C42.5 17.5 39 23 34 25.2C30 27 26.5 25.2 23 23C18.8 20.5 15.2 20 11 22.8C9.2 24 7.8 23.5 7.2 21.8C6.6 20 6.8 18.2 9 17Z"
        fill={colored ? `url(#${gradientId})` : 'currentColor'}
      />
      <path
        d="M22 23.5V35C22 37.8 24.2 40 27 40C29.8 40 32 37.8 32 35V24.5C30.5 25.2 29 25.5 27.5 25.2C25.5 24.8 23.8 24.2 22 23.5ZM25 35C25 36.1 25.9 37 27 37C28.1 37 29 36.1 29 35V27.5C28.3 27.7 27.6 27.8 27 27.7C26.3 27.6 25.7 27.3 25 26.8V35Z"
        fill={colored ? `url(#${gradientId})` : 'currentColor'}
      />
    </svg>
  )
}
