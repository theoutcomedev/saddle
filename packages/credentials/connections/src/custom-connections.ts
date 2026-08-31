/**
 * Custom tool connections: a user-defined service the operator adds through
 * the Connections page. Definitions persist to a JSON document under
 * $DSH_HOME and register as normal tool flows on boot, so a custom service
 * survives restarts and shows up with the rest of the catalog. Only api-key
 * tools are supported here (a custom OAuth/device service still needs a
 * deployment-registered app); the field labels let the surface name exactly
 * what to paste.
 * @module @deepseek-ai/dsh-connections/custom-connections
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { Context, Service } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { connectionKey } from './index.ts'
import { registerToolService, type ToolAuthField } from './tool-service.ts'

/** One persisted custom service definition. */
export interface CustomServiceRecord {
  /** Stable lowercase-hyphenated id (credential-key segment). */
  id: string
  /** User-facing service name. */
  label: string
  /** Provider page to obtain the credential. */
  docsUrl: string
  /** The named fields the connect flow asks for. */
  fields: readonly ToolAuthField[]
}

/** A request to add a custom service. */
export interface CustomServiceInput {
  label: string
  docsUrl?: string
  fields?: readonly { label: string }[]
}

/** Config for the custom-connections service. */
export interface CustomConnectionsConfig {
  /** The JSON document holding custom definitions. */
  file: string
}

/** Map the user's raw label to a valid credential-key segment. */
function slugify(label: string): string {
  const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)
  return slug === '' ? 'custom-service' : slug
}

/**
 * Registry + persistence for user-added tool services. Persisted to a JSON
 * document; on boot the catalog calls load() to re-register every stored one.
 */
export class CustomConnectionsService extends Service {
  static inject = ['authorization', 'credentials']

  static Config: z<CustomConnectionsConfig> = z.object({
    file: z.string().required(),
  })

  private readonly records = new Map<string, CustomServiceRecord>()

  constructor(ctx: Context, config: CustomConnectionsConfig) {
    super(ctx, 'customConnections')
    this.spec = config
  }

  private readonly spec: CustomConnectionsConfig
  private loaded = false

  /**
   * Read persisted definitions and register a flow for each. Idempotent:
   * repeated loads do not double-register an already-present service.
   */
  async load(): Promise<void> {
    if (this.loaded) return
    this.loaded = true
    let stored: unknown
    try {
      stored = JSON.parse(await readFile(this.spec.file, 'utf8')) as unknown
    } catch {
      return
    }
    if (stored === null || typeof stored !== 'object' || Array.isArray(stored)) return
    const list = stored as { services?: CustomServiceRecord[] }
    for (const record of list.services ?? []) {
      if (record.id === undefined || record.label === undefined) continue
      this.records.set(record.id, record)
      registerToolService(this.ctx, {
        id: record.id,
        label: record.label,
        docsUrl: record.docsUrl ?? 'https://example.com',
        auth: { method: 'api-key', fields: record.fields },
      })
    }
  }

  /**
   * Add a custom service: persist it, register its flow, and return its key.
   * @param input - the label, optional docs page, and field labels.
   * @returns the credential key (scope/id) of the new service.
   */
  async register(input: CustomServiceInput): Promise<string> {
    await this.load()
    const label = input.label.trim()
    if (label === '') throw new Error('a service name is required')
    const base = slugify(label)
    let id = 'custom-' + base
    let n = 2
    while (this.records.has(id)) id = 'custom-' + base + '-' + (n++)
    const record: CustomServiceRecord = {
      id,
      label,
      docsUrl: input.docsUrl?.trim() || 'https://example.com',
      fields: (input.fields ?? []).filter(field => field.label.trim() !== '').map(field => ({
        id: slugify(field.label),
        label: field.label.trim(),
      })),
    }
    if (record.fields.length === 0) record.fields = [{ id: 'key', label: 'API key' }]
    this.records.set(id, record)
    await this.persist()
    registerToolService(this.ctx, {
      id,
      label: record.label,
      docsUrl: record.docsUrl,
      auth: { method: 'api-key', fields: record.fields },
    })
    return connectionKey({ id, label: record.label })
  }

  /** Every stored custom service, in insertion order. */
  list(): readonly CustomServiceRecord[] {
    return [...this.records.values()]
  }

  private async persist(): Promise<void> {
    await mkdir(dirname(this.spec.file), { recursive: true, mode: 0o700 })
    await writeFile(this.spec.file, JSON.stringify({ services: [...this.records.values()] }, null, 2), { mode: 0o600 })
  }
}

export default CustomConnectionsService
