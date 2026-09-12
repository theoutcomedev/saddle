/**
 * Cadence math for persistent scheduled tasks: the next fire time of a task,
 * evaluated in the task's own time zone.
 *
 * A task's schedule is derived from the planned fire time, never from the moment
 * a run happened to be dispatched, so tick jitter cannot accumulate into a late
 * cadence.
 */

/** Cadence kinds a scheduled task stores (interval minutes, a one-off time, or 5-field cron). */
export type CadenceType = 'cron' | 'interval' | 'once'

/** Weekday initials as `Intl` reports them, mapped to the cron day-of-week numbering. */
const WEEKDAYS: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
}

/** How far a cron search looks ahead before giving up (31 days of minutes). */
const CRON_SEARCH_MINUTES = 44_640

/**
 * Interval cadence in milliseconds.
 * @param cadenceValue - Configured interval in minutes; an unparsable value falls back to 30, and the result never drops below one minute.
 * @returns the interval as a positive millisecond count.
 */
function intervalMs(cadenceValue: string): number {
  return Math.max(1, parseInt(cadenceValue, 10) || 30) * 60_000
}

/**
 * Whether one cron field admits a value, supporting wildcards, steps, lists and ranges.
 * @param value - Evaluated minute, hour, day, month or weekday number.
 * @param part - Raw cron field text.
 * @returns true when the field admits the value.
 */
function matchesCronPart(value: number, part: string): boolean {
  if (part === '*' || part === '?') return true
  if (part.startsWith('*/')) {
    const step = parseInt(part.slice(2), 10)
    return step > 0 && value % step === 0
  }
  if (part.includes(',')) {
    return part.split(',').some(p => matchesCronPart(value, p.trim()))
  }
  if (part.includes('-')) {
    const hyphenIdx = part.indexOf('-')
    const start = parseInt(part.slice(0, hyphenIdx), 10)
    const end = parseInt(part.slice(hyphenIdx + 1), 10)
    return !isNaN(start) && !isNaN(end) && value >= start && value <= end
  }
  return parseInt(part, 10) === value
}

/**
 * Next fire time of a cron cadence: the first matching minute after the search start,
 * read in the client's time zone (UTC when absent or unrecognized).
 *
 * A malformed expression resolves one hour ahead; an expression that cannot match
 * within 31 days resolves one day ahead.
 * @param cadenceValue - Five-field cron expression.
 * @param fromTime - Epoch milliseconds the search starts from.
 * @param clientTimeZone - IANA zone the cron fields are evaluated in.
 * @returns the matching minute in epoch milliseconds.
 */
function nextCronRun(cadenceValue: string, fromTime: number, clientTimeZone?: string | undefined): number {
  const parts = cadenceValue.trim().split(/\s+/)
  if (parts.length < 5) return fromTime + 60 * 60 * 1000
  const [minPart = '*', hourPart = '*', domPart = '*', monthPart = '*', dowPart = '*'] = parts
  const start = new Date(fromTime + 60_000)
  start.setSeconds(0, 0)

  let tzFormatter: Intl.DateTimeFormat | undefined
  if (clientTimeZone) {
    try {
      tzFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: clientTimeZone,
        minute: 'numeric',
        hour: 'numeric',
        hour12: false,
        day: 'numeric',
        month: 'numeric',
        weekday: 'short',
      })
    } catch {
      tzFormatter = undefined
    }
  }

  for (let i = 0; i < CRON_SEARCH_MINUTES; i++) {
    const current = new Date(start.getTime() + i * 60_000)
    let minute = current.getUTCMinutes()
    let hour = current.getUTCHours()
    let day = current.getUTCDate()
    let month = current.getUTCMonth() + 1
    let dow = current.getUTCDay()

    if (tzFormatter) {
      for (const p of tzFormatter.formatToParts(current)) {
        if (p.type === 'minute') minute = parseInt(p.value, 10)
        else if (p.type === 'hour') hour = parseInt(p.value, 10) % 24
        else if (p.type === 'day') day = parseInt(p.value, 10)
        else if (p.type === 'month') month = parseInt(p.value, 10)
        else if (p.type === 'weekday') dow = WEEKDAYS[p.value] ?? dow
      }
    }

    if (
      matchesCronPart(minute, minPart)
      && matchesCronPart(hour, hourPart)
      && matchesCronPart(day, domPart)
      && matchesCronPart(month, monthPart)
      && matchesCronPart(dow, dowPart)
    ) {
      return current.getTime()
    }
  }
  return fromTime + 24 * 60 * 60 * 1000
}

/**
 * Next fire time of a cadence evaluated from the given moment.
 * @param cadenceType - Cadence kind being scheduled.
 * @param cadenceValue - Interval minutes, an ISO timestamp (or minutes from now) for a one-off, or a cron expression.
 * @param fromTime - Epoch milliseconds the schedule is derived from.
 * @param clientTimeZone - IANA zone cron fields are read in.
 * @returns the next fire time in epoch milliseconds, or undefined when a one-off cadence has already passed.
 */
export function computeNextRun(
  cadenceType: CadenceType,
  cadenceValue: string,
  fromTime: number,
  clientTimeZone?: string | undefined,
): number | undefined {
  switch (cadenceType) {
    case 'interval':
      return fromTime + intervalMs(cadenceValue)
    case 'once': {
      const parsed = Date.parse(cadenceValue)
      if (!Number.isNaN(parsed)) return parsed > fromTime ? parsed : undefined
      const mins = parseInt(cadenceValue, 10)
      return !Number.isNaN(mins) && mins > 0 ? fromTime + mins * 60_000 : undefined
    }
    case 'cron':
      return nextCronRun(cadenceValue, fromTime, clientTimeZone)
  }
}

/**
 * Next fire time of a task that just dispatched, anchored to the fire it was
 * scheduled for rather than to the dispatch moment, so the up-to-one-tick lag of
 * each run cannot accumulate into a late cadence. Occurrences missed while the run
 * was in flight, or while the host was down, are skipped instead of replayed back
 * to back.
 * @param cadenceType - Cadence kind the task runs on.
 * @param cadenceValue - Interval minutes, an ISO timestamp (or minutes from now) for a one-off, or a cron expression.
 * @param previousScheduledAt - Epoch milliseconds of the fire the task is completing, when it had one.
 * @param now - Epoch milliseconds of the dispatch.
 * @param clientTimeZone - IANA zone cron fields are read in.
 * @returns the next fire time in epoch milliseconds, or undefined when the task does not run again.
 */
export function computeNextRunAfterDispatch(
  cadenceType: CadenceType,
  cadenceValue: string,
  previousScheduledAt: number | undefined,
  now: number,
  clientTimeZone?: string | undefined,
): number | undefined {
  if (cadenceType !== 'interval' || previousScheduledAt === undefined || Number.isNaN(previousScheduledAt)) {
    return computeNextRun(cadenceType, cadenceValue, now, clientTimeZone)
  }
  const interval = intervalMs(cadenceValue)
  const elapsed = now - previousScheduledAt
  const skipped = elapsed > 0 ? Math.floor(elapsed / interval) : 0
  return previousScheduledAt + (skipped + 1) * interval
}
