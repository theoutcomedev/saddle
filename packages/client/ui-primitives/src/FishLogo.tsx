import type { IconProps } from './icons/props.ts'
import { SaddleLogo } from './SaddleLogo.tsx'

/**
 * Render the brand logo mark (aliased to SaddleLogo for complete backwards compatibility).
 * @param props - IconProps sizing and styling.
 * @returns the logo svg.
 */
export function FishLogo(props: IconProps) {
  return <SaddleLogo {...props} />
}
