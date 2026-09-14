/**
 * The active-mode chip in the session header: what the screen is currently
 * arranged for, and the one click that leaves it. The agent's switches arrive
 * through the `workspaceMode` session projection, so the chip is also where an
 * agent-applied mode reaches the shell — a person's own switch never
 * round-trips, which is why a differing projection value is always the
 * agent's.
 */

import { useEffect, useRef } from 'react'
import { IconCloseFill14 } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: pulls the ui-conversation SlotMap merge (the header action seat)
// and the `workspaceMode` SessionProjectionMap merge for useProjection.
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-workspace-modes/client'
import type { ModesInjected } from './index.ts'
import { DEFAULT_MODE } from './catalogue.ts'
import { modeDescriptionKey, modeNameKey } from './locales.ts'
import css from './ModeChip.module.css'

/** Props: the session header seat, the modes face, and this plugin's locale seat. */
export type ModeChipProps =
  PropsRuntime<'conversation.session.header.actions'>
  & PropsLocale<'modes'>
  & InjectFace<ModesInjected>

/**
 * Render the active mode, or nothing while the plain arrangement is in force.
 * @param props - composed slot props.
 * @returns the chip, or null in the default mode.
 */
export function ModeChip({ useProjection, useModes, apply, t }: ModeChipProps) {
  const requested = useProjection('workspaceMode')
  const active = useModes(state => state.active)
  // A recorded instruction is consumed once, by its sequence: the same mode
  // asked for twice is two instructions, while leaving a mode must not be
  // undone by the instruction that put the person in it.
  const consumed = useRef<number | undefined>(undefined)

  useEffect(() => {
    // Absent means no projection is served here; null means the session has
    // recorded no request yet. Neither is an instruction.
    if (requested === undefined || requested === null || consumed.current === requested.at) return
    consumed.current = requested.at
    apply(requested.mode)
  }, [requested, apply])

  if (active === DEFAULT_MODE) return null
  const name = t(modeNameKey(active))
  const leave = t('modes.exit', { name })
  return (
    <span className={css.chip} data-mode={active}>
      <span className={css.mark} aria-hidden="true" />
      <span className={css.name}>{name}</span>
      <button
        type="button"
        className={css.exit}
        aria-label={leave}
        title={t(modeDescriptionKey(active))}
        onClick={() => { apply(DEFAULT_MODE) }}
      >
        <IconCloseFill14 size={12} />
      </button>
    </span>
  )
}
