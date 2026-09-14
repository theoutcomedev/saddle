// Proves the model-facing surface through the REAL Loader and the real tool
// runtime: the description names every mode the catalogue accepts, a call
// writes exactly one `workspace/mode` event carrying the mode it reported, an
// id outside the catalogue is refused at the boundary, and a caller with no
// owning session is refused rather than silently no-opped.
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import Include from '@deepseek-ai/cordis-plugin-include'
import { CallId } from '@deepseek-ai/dsh-llm'
import { Session, SessionId } from '@deepseek-ai/dsh-session'
import AgentRegistry, { Inbox } from '@deepseek-ai/dsh-agent'
import type { Agent } from '@deepseek-ai/dsh-agent'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import * as WorkspaceModes from '@deepseek-ai/dsh-workspace-modes'
import { WORKSPACE_MODES, WORKSPACE_MODE_PURPOSES } from '../src/catalogue.ts'

let root: string | undefined
let context: Context | undefined

afterEach(async () => {
  await context?.fiber.dispose()
  context = undefined
  if (root !== undefined) await rm(root, { recursive: true, force: true })
  root = undefined
})

function agent(ctx: Context): Agent {
  const scope = ctx.plugin(() => {})
  const id = SessionId('workspace-mode-agent')
  const session = Session.create(id)
  const value: Agent = {
    id, options: {}, session, inbox: new Inbox(session, { inserted: () => {}, discarded: () => {}, claimed: () => {} }),
    status: 'idle', ctx: scope.ctx,
    followup: () => {}, steer: () => {}, inject: () => {}, send: () => {}, cancel() {},
    runMaintenance: task => task(new AbortController().signal),
    whenIdle: () => Promise.resolve(),
  }
  ctx.agents.register(value)
  return value
}

function resultText(result: { content: { type: string; text?: string }[] }): string {
  return result.content.filter(block => block.type === 'text').map(block => block.text).join('')
}

/**
 * Boot a cordis.yml composing the tool runtime and this package.
 * @returns the booted context.
 */
async function boot(): Promise<Context> {
  root = await mkdtemp(join(tmpdir(), 'dsh-workspace-modes-loader-'))
  const configPath = join(root, 'cordis.yml')
  await writeFile(configPath, [
    "- name: '@deepseek-ai/dsh-agent'",
    "- name: '@deepseek-ai/dsh-system-prompt'",
    "- name: '@deepseek-ai/dsh-tools'",
    "- name: '@deepseek-ai/dsh-workspace-modes'",
    '',
  ].join('\n'))

  const ctx = new Context()
  context = ctx
  ctx.baseUrl = pathToFileURL(root).href + '/'
  await ctx.plugin(Loader)
  ctx.loader.builtins.include = Include
  const modules = new Map<string, unknown>([
    ['@deepseek-ai/dsh-agent', AgentRegistry],
    ['@deepseek-ai/dsh-system-prompt', SystemPrompt],
    ['@deepseek-ai/dsh-tools', ToolRuntime],
    ['@deepseek-ai/dsh-workspace-modes', WorkspaceModes],
  ])
  ctx.loader.internal = {
    version: 'v2',
    async import(specifier: string) {
      if (!modules.has(specifier)) throw new Error(`unexpected Loader import: ${specifier}`)
      return modules.get(specifier)
    },
  } as unknown as NonNullable<typeof ctx.loader.internal>
  await ctx.loader.create({ name: 'cordis:include', config: { path: pathToFileURL(configPath).href } })
  await ctx.loader.await()
  return ctx
}

describe('set_workspace_mode through real Loader composition', () => {
  it('describes every mode the catalogue accepts', async () => {
    const ctx = await boot()
    const description = ctx.tools.schemas().find(s => s.name === 'set_workspace_mode')?.description ?? ''
    for (const mode of WORKSPACE_MODES) {
      expect(description).toContain(`- ${mode}: ${WORKSPACE_MODE_PURPOSES[mode]}`)
    }
  }, 30_000)

  it('writes one workspace/mode event carrying the mode it reported', async () => {
    const ctx = await boot()
    const owner = agent(ctx)
    const result = await ctx.tools.execute({
      signal: new AbortController().signal,
      callId: CallId('set-mode-zen'),
      name: 'set_workspace_mode',
      arguments: { mode: 'zen' },
      agent: owner,
    })
    expect(result.isError).toBe(false)
    expect(resultText(result)).toContain('Workspace mode set to zen')
    const recorded = owner.session.events.filter(event => event.type === 'workspace/mode')
    expect(recorded).toHaveLength(1)
    expect(recorded[0]?.data).toEqual({ mode: 'zen' })
  }, 30_000)

  it('refuses an id outside the catalogue', async () => {
    const ctx = await boot()
    const owner = agent(ctx)
    const result = await ctx.tools.execute({
      signal: new AbortController().signal,
      callId: CallId('set-mode-bogus'),
      name: 'set_workspace_mode',
      arguments: { mode: 'cinema' },
      agent: owner,
    })
    expect(result.isError).toBe(true)
    expect(owner.session.events.some(event => event.type === 'workspace/mode')).toBe(false)
  }, 30_000)

  it('refuses a caller with no owning session', async () => {
    const ctx = await boot()
    const result = await ctx.tools.execute({
      signal: new AbortController().signal,
      callId: CallId('set-mode-ownerless'),
      name: 'set_workspace_mode',
      arguments: { mode: 'focus' },
    })
    expect(result.isError).toBe(true)
    expect(resultText(result)).toContain('requires an owning agent session')
  }, 30_000)
})
