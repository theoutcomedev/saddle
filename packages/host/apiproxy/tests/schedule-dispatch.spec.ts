/**
 * The scheduler tick must start each due task once, even when the previous run is
 * still in flight, and must pick the task up again if that dispatch never completed.
 */

import { describe, expect, it } from 'vitest'
import { selectDueTasks, type TickTask } from '../src/schedule-dispatch.ts'

/** Reference instant for the tick, 2026-01-15T12:00:00Z. */
const NOW = Date.UTC(2026, 0, 15, 12, 0, 0)

/** An armed task that was due a second before the tick. */
function task(overrides: Partial<TickTask> & { id: string }): TickTask {
  return { enabled: true, nextRunAt: new Date(NOW - 1000).toISOString(), ...overrides }
}

describe('selectDueTasks', () => {
  it('selects armed tasks whose planned fire time has arrived', () => {
    const due = task({ id: 'due' })
    const future = task({ id: 'future', nextRunAt: new Date(NOW + 60_000).toISOString() })
    expect(selectDueTasks([due, future], NOW, new Set()).map(entry => entry.id)).toEqual(['due'])
  })

  it('selects a task at its planned instant', () => {
    const exact = task({ id: 'exact', nextRunAt: new Date(NOW).toISOString() })
    expect(selectDueTasks([exact], NOW, new Set()).map(entry => entry.id)).toEqual(['exact'])
  })

  it('skips paused tasks and tasks with no planned fire', () => {
    const paused = task({ id: 'paused', enabled: false })
    const unscheduled = task({ id: 'unscheduled', nextRunAt: undefined })
    expect(selectDueTasks([paused, unscheduled], NOW, new Set())).toEqual([])
  })

  it('leaves an unreadable planned fire time alone', () => {
    const broken = task({ id: 'broken', nextRunAt: 'not-a-date' })
    expect(selectDueTasks([broken], NOW, new Set())).toEqual([])
  })

  it('does not start a task whose previous run is still in flight', () => {
    const running = task({ id: 'running' })
    const idle = task({ id: 'idle' })
    expect(selectDueTasks([running, idle], NOW, new Set(['running'])).map(entry => entry.id)).toEqual(['idle'])
  })

  it('starts a due task again after its claim is released', () => {
    const due = task({ id: 'due' })
    expect(selectDueTasks([due], NOW, new Set(['due']))).toEqual([])
    expect(selectDueTasks([due], NOW, new Set()).map(entry => entry.id)).toEqual(['due'])
  })
})
