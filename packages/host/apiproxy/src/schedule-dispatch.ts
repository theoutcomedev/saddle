/**
 * Which scheduled tasks a tick of the scheduler starts.
 */

/** The task fields a tick decides on. */
export interface TickTask {
  /** Stable task id, the key a claim is held under. */
  id: string
  /** Whether the task is currently armed. */
  enabled: boolean
  /** Planned fire time; absent while the task has no next run. */
  nextRunAt?: string | undefined
}

/**
 * Tasks a tick must start: armed, due, and not already claimed by a run that has
 * not yet written its next fire time back.
 *
 * The claim is what keeps a slow dispatch (a cold session, a stalled turn) from
 * being started a second time by the next tick, which still reads the old planned
 * fire time. It lives in memory only, so a restarted host recovers the unfinished
 * task instead of losing it.
 * @param tasks - Tasks as stored at the start of the tick.
 * @param now - Epoch milliseconds of the tick.
 * @param claimedTaskIds - Ids of tasks whose in-flight run has not settled.
 * @returns the tasks to dispatch, in stored order.
 */
export function selectDueTasks<T extends TickTask>(
  tasks: readonly T[],
  now: number,
  claimedTaskIds: ReadonlySet<string>,
): T[] {
  return tasks.filter((task) => {
    if (!task.enabled || task.nextRunAt === undefined) return false
    if (claimedTaskIds.has(task.id)) return false
    return now >= new Date(task.nextRunAt).getTime()
  })
}
