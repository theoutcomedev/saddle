/**
 * The active-layout chip in the session header: what the screen is currently
 * arranged for, and the one click that leaves it. It wears the sidebar row's
 * own glyph, because the header also carries the session's agent preset — a
 * different thing entirely (what the assistant may do) — and two unlabelled
 * pills in one row are unreadable.
 *
 * The agent's switches arrive through the `workspaceLayout` session
 * projection, so this chip is also where an agent-applied layout reaches the
 * shell; a person's own switch never round-trips, which is why a differing
 * projection value is always the agent's.
 */

import { useEffect, useRef } from 'react'
import { IconCloseFill14 } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: pulls the ui-conversation SlotMap merge (the header action seat)
// and the `workspaceLayout` SessionProjectionMap merge for useProjection.
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-workspace-modes/client'
import { LayoutGlyph } from './LayoutGlyph.tsx'
import type { LayoutsInjected } from './index.ts'
import { DEFAULT_LAYOUT } from './catalogue.ts'
import { layoutDescriptionKey, layoutNameKey } from './locales.ts'
import css from './LayoutChip.module.css'

/** Props: the session header seat, the layouts face, and this plugin's locale seat. */
export type LayoutChipProps =
  PropsRuntime<'conversation.session.header.actions'>
  & PropsLocale<'layouts'>
  & InjectFace<LayoutsInjected>

/**
 * Render the active layout, or nothing while the default arrangement is in force.
 * @param props - composed slot props.
 * @returns the chip, or null in the default layout.
 */
export function LayoutChip({ useProjection, useLayouts, apply, t }: LayoutChipProps) {
  const requested = useProjection('workspaceLayout')
  const active = useLayouts(state => state.active)
  // A recorded instruction is consumed once, by its sequence: the same layout
  // asked for twice is two instructions, while leaving a layout must not be
  // undone by the instruction that put the person in it.
  const consumed = useRef<number | undefined>(undefined)

  useEffect(() => {
    // Absent means no projection is served here; null means the session has
    // recorded no request yet. Neither is an instruction.
    if (requested === undefined || requested === null || consumed.current === requested.at) return
    consumed.current = requested.at
    apply(requested.layout)
  }, [requested, apply])

  if (active === DEFAULT_LAYOUT) return null
  const name = t(layoutNameKey(active))
  const leave = t('layouts.exit', { name })
  return (
    <span className={css.chip} data-layout={active}>
      <LayoutGlyph size={13} className={css.glyph} />
      <span className={css.name}>{name}</span>
      <button
        type="button"
        className={css.exit}
        aria-label={leave}
        title={t(layoutDescriptionKey(active))}
        onClick={() => { apply(DEFAULT_LAYOUT) }}
      >
        <IconCloseFill14 size={12} />
      </button>
    </span>
  )
}
