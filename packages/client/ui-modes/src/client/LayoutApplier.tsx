/**
 * Applies the remembered layout to the shell, headless. It takes the root
 * overlay seat because that mounts inside the frame the layout store belongs
 * to — the store's inject hook has run by then, so the layout service is
 * wired — and it stays mounted for the life of the shell, which is what makes
 * a reload show the shape this device class left rather than the default one.
 */

import { useEffect } from 'react'
import type { InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: pulls the ui-layout SlotMap merge (the root overlay seat).
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type { LayoutsInjected } from './index.ts'

/** Props: the root standard kit plus this plugin's injected face. */
export type LayoutApplierProps = PropsRuntime<'shell.overlay'> & InjectFace<LayoutsInjected>

/**
 * Render nothing; arrange the shell whenever the remembered layout changes.
 * @param props - composed slot props.
 * @returns null.
 */
export function LayoutApplier({ useLayouts, apply }: LayoutApplierProps) {
  const active = useLayouts(state => state.active)
  useEffect(() => { apply(active) }, [active, apply])
  return null
}
