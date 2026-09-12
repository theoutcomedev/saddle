/**
 * Cadence math for persistent scheduled tasks: the schedule must stay on its
 * own grid, and cron fields must be read in the task's configured time zone.
 */

import { describe, expect, it } from 'vitest'
import { computeNextRun, computeNextRunAfterDispatch } from '../src/schedule-cadence.ts'

/** Five minutes, the interval most of these cases are written against. */
const FIVE_MINUTES = 300_000

/** 2026-01-15T00:00:00Z, a Thursday (16:00 the previous day in Los Angeles). */
const MIDNIGHT_UTC = Date.UTC(2026, 0, 15, 0, 0, 0)

describe('computeNextRun', () => {
  it('adds the configured interval to the reference time', () => {
    expect(computeNextRun('interval', '5', MIDNIGHT_UTC)).toBe(MIDNIGHT_UTC + FIVE_MINUTES)
  })

  it('floors an unusable interval at the 30-minute default and never below a minute', () => {
    expect(computeNextRun('interval', '0', 0)).toBe(30 * 60_000)
    expect(computeNextRun('interval', 'not-a-number', 0)).toBe(30 * 60_000)
    expect(computeNextRun('interval', '-5', 0)).toBe(60_000)
  })

  it('never reuses a one-off time that has already passed', () => {
    expect(computeNextRun('once', '2026-01-16T09:00:00.000Z', MIDNIGHT_UTC)).toBe(Date.UTC(2026, 0, 16, 9, 0, 0))
    expect(computeNextRun('once', '2026-01-14T09:00:00.000Z', MIDNIGHT_UTC)).toBeUndefined()
    expect(computeNextRun('once', '30', MIDNIGHT_UTC)).toBe(MIDNIGHT_UTC + 30 * 60_000)
    expect(computeNextRun('once', 'nonsense', MIDNIGHT_UTC)).toBeUndefined()
  })

  it('reads cron fields in the configured time zone', () => {
    expect(computeNextRun('cron', '0 9 * * *', MIDNIGHT_UTC, 'America/Los_Angeles')).toBe(Date.UTC(2026, 0, 15, 17, 0, 0))
    expect(computeNextRun('cron', '0 9 * * *', MIDNIGHT_UTC)).toBe(Date.UTC(2026, 0, 15, 9, 0, 0))
  })

  it('falls back to UTC when the stored zone is not a known zone', () => {
    expect(computeNextRun('cron', '0 9 * * *', MIDNIGHT_UTC, 'Not/AZone')).toBe(Date.UTC(2026, 0, 15, 9, 0, 0))
  })

  it('matches wildcards, steps, lists, ranges and numeric weekdays', () => {
    expect(computeNextRun('cron', '*/30 * * * *', MIDNIGHT_UTC)).toBe(MIDNIGHT_UTC + 30 * 60_000)
    expect(computeNextRun('cron', '0,45 * * * *', MIDNIGHT_UTC)).toBe(MIDNIGHT_UTC + 45 * 60_000)
    expect(computeNextRun('cron', '0 10-11 * * *', MIDNIGHT_UTC)).toBe(Date.UTC(2026, 0, 15, 10, 0, 0))
    expect(computeNextRun('cron', '0 9 ? * *', MIDNIGHT_UTC)).toBe(Date.UTC(2026, 0, 15, 9, 0, 0))
    // '1' is Monday, so the next Monday 09:00 in Los Angeles (Jan 19) is the
    // answer, not Thursday.
    expect(computeNextRun('cron', '0 9 * * 1', MIDNIGHT_UTC, 'America/Los_Angeles')).toBe(Date.UTC(2026, 0, 19, 17, 0, 0))
    // Names are the same field as the numbers they stand for, in lists and ranges.
    expect(computeNextRun('cron', '0 9 * * Mon', MIDNIGHT_UTC, 'America/Los_Angeles')).toBe(Date.UTC(2026, 0, 19, 17, 0, 0))
    expect(computeNextRun('cron', '0 9 * * SAT,SUN', MIDNIGHT_UTC, 'America/Los_Angeles')).toBe(Date.UTC(2026, 0, 17, 17, 0, 0))
    expect(computeNextRun('cron', '0 9 * * MON-FRI', MIDNIGHT_UTC, 'America/Los_Angeles')).toBe(Date.UTC(2026, 0, 15, 17, 0, 0))
    expect(computeNextRun('cron', '0 9 * * mon', MIDNIGHT_UTC, 'America/Los_Angeles')).toBe(Date.UTC(2026, 0, 19, 17, 0, 0))
    // An unknown token still matches nothing, so the search gives up as before.
    expect(computeNextRun('cron', '0 9 * * XYZ', MIDNIGHT_UTC)).toBe(MIDNIGHT_UTC + 24 * 60 * 60 * 1000)
  })

  it('gives up after 31 days when a cron expression can never match', () => {
    expect(computeNextRun('cron', '0 0 31 2 *', MIDNIGHT_UTC)).toBe(MIDNIGHT_UTC + 24 * 60 * 60 * 1000)
    expect(computeNextRun('cron', '*/0 * * * *', MIDNIGHT_UTC)).toBe(MIDNIGHT_UTC + 24 * 60 * 60 * 1000)
    expect(computeNextRun('cron', 'x-y * * * *', MIDNIGHT_UTC)).toBe(MIDNIGHT_UTC + 24 * 60 * 60 * 1000)
  })

  it('falls back to an hourly cadence for a malformed stored expression', () => {
    expect(computeNextRun('cron', '0 9', MIDNIGHT_UTC)).toBe(MIDNIGHT_UTC + 60 * 60 * 1000)
  })
})

describe('computeNextRunAfterDispatch', () => {
  it('anchors an interval cadence to the fire that just ran, not to the dispatch moment', () => {
    const scheduled = MIDNIGHT_UTC
    const dispatchedAt = scheduled + 12_000
    expect(computeNextRunAfterDispatch('interval', '5', scheduled, dispatchedAt)).toBe(scheduled + FIVE_MINUTES)
  })

  it('does not let per-tick lag accumulate across cycles', () => {
    let scheduled = MIDNIGHT_UTC
    for (let cycle = 0; cycle < 3; cycle++) {
      scheduled = computeNextRunAfterDispatch('interval', '5', scheduled, scheduled + 29_000) ?? scheduled
    }
    expect(scheduled).toBe(MIDNIGHT_UTC + 3 * FIVE_MINUTES)
  })

  it('skips occurrences missed while the run or the host was busy', () => {
    const scheduled = MIDNIGHT_UTC
    const next = computeNextRunAfterDispatch('interval', '5', scheduled, scheduled + 12 * 60_000) ?? 0
    expect(next).toBe(scheduled + 15 * 60_000)
    expect(next > scheduled + 12 * 60_000).toBe(true)
  })

  it('falls back to the dispatch moment without a planned fire to anchor to', () => {
    expect(computeNextRunAfterDispatch('interval', '5', undefined, MIDNIGHT_UTC)).toBe(MIDNIGHT_UTC + FIVE_MINUTES)
    expect(computeNextRunAfterDispatch('interval', '5', Number.NaN, MIDNIGHT_UTC)).toBe(MIDNIGHT_UTC + FIVE_MINUTES)
  })

  it('keeps the configured time zone of a cron task after a failed run', () => {
    const scheduled = MIDNIGHT_UTC - 24 * 60 * 60 * 1000
    const failedAt = MIDNIGHT_UTC
    expect(
      computeNextRunAfterDispatch('cron', '0 9 * * *', scheduled, failedAt, 'America/Los_Angeles'),
    ).toBe(Date.UTC(2026, 0, 15, 17, 0, 0))
  })

  it('re-derives a cron cadence from the dispatch moment rather than a stale anchor', () => {
    const scheduled = MIDNIGHT_UTC - 30 * 24 * 60 * 60 * 1000
    const next = computeNextRunAfterDispatch('cron', '0 9 * * *', scheduled, MIDNIGHT_UTC, 'America/Los_Angeles')
    expect(next).toBe(Date.UTC(2026, 0, 15, 17, 0, 0))
  })

  it('leaves a one-off task without a next fire', () => {
    expect(computeNextRunAfterDispatch('once', '2026-01-15T00:00:00.000Z', MIDNIGHT_UTC, MIDNIGHT_UTC)).toBeUndefined()
  })
})
