// @vitest-environment jsdom
/** Scheduled-task store: the in-place edit path and the model catalog projection. */
import { describe, expect, it, vi, type Mock } from 'vitest'
import type { IApiClient } from '@deepseek-ai/dsh-host-apiproxy/client'
import { ScheduledTasksStore } from '../src/client/schedules-store.ts'

const ok = (value: unknown) => ({ result: { ok: true, value } })
const failure = (message: string) => ({ result: { ok: false, error: { message } } })

/** A host client whose mocks stay reachable as values, not as unbound methods. */
function makeApi(overrides: { update?: Mock; models?: Mock } = {}): {
  api: IApiClient
  list: Mock
  update: Mock
  models: Mock
} {
  const list = vi.fn(async () => ok({ tasks: [] }))
  const update = overrides.update ?? vi.fn(async () => ok({ task: {} }))
  const models = overrides.models ?? vi.fn(async () => ok({ groups: [], failures: [] }))
  const api = {
    schedules: { list, update },
    llm: { models },
  } as unknown as IApiClient
  return { api, list, update, models }
}

describe('ScheduledTasksStore', () => {
  it('sends every edited field, including a cleared model pin, then refreshes', async () => {
    const { api, list, update } = makeApi()
    const store = new ScheduledTasksStore(api)

    const saved = await store.updateTask({
      id: 'task_1',
      name: 'Nightly audit',
      prompt: 'Check containers',
      cadenceType: 'interval',
      cadenceValue: '60',
      targetMode: 'new-session',
      provider: '',
      model: '',
    })

    expect(saved).toBe(true)
    expect(update).toHaveBeenCalledWith({
      id: 'task_1',
      name: 'Nightly audit',
      prompt: 'Check containers',
      cadenceType: 'interval',
      cadenceValue: '60',
      targetMode: 'new-session',
      provider: '',
      model: '',
    })
    // The edit repaints from the host's list, not from the optimistic payload.
    expect(list).toHaveBeenCalled()
    expect(store.store.getSnapshot().actionInFlight).toBeNull()
  })

  it('reports a refused edit without refreshing', async () => {
    const { api, list } = makeApi({ update: vi.fn(async () => failure('Scheduled task task_1 not found')) })
    const store = new ScheduledTasksStore(api)

    const saved = await store.updateTask({ id: 'task_1', name: 'Renamed' })

    expect(saved).toBe(false)
    expect(store.store.getSnapshot().error).toBe('Scheduled task task_1 not found')
    expect(list).not.toHaveBeenCalled()
    expect(store.store.getSnapshot().actionInFlight).toBeNull()
  })

  it('flattens the host catalog into pickable provider/model pairs', async () => {
    const { api } = makeApi({
      models: vi.fn(async () => ok({
        groups: [
          { id: 'deepseek-official', name: 'DeepSeek', models: [{ id: 'deepseek-flash', name: 'Flash' }] },
          { id: 'openai', name: 'OpenAI', models: [{ id: 'gpt-5', name: '' }] },
        ],
        failures: [],
      })),
    })
    const store = new ScheduledTasksStore(api)

    expect(await store.listModels()).toEqual([
      { provider: 'deepseek-official', model: 'deepseek-flash', label: 'DeepSeek — Flash' },
      { provider: 'openai', model: 'gpt-5', label: 'OpenAI — gpt-5' },
    ])
  })

  it('answers an unavailable catalog with an empty list rather than throwing', async () => {
    const { api } = makeApi({ models: vi.fn(async () => { throw new Error('offline') }) })
    const store = new ScheduledTasksStore(api)

    expect(await store.listModels()).toEqual([])
  })
})
