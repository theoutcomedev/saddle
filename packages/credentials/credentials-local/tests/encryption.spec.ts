// Provider-level encryption behavior: writes seal at rest and reads decrypt, a
// legacy plaintext document keeps working, and the key-encryption key comes
// from the environment when present or the key file otherwise — a wrong key
// fails the boot loud rather than reading as "no credentials stored".
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { credentialKey, credentialRef } from '@deepseek-ai/dsh-credentials'
import { encodeKek, generateKek, SealedValueError } from '../src/crypto.ts'
import { KEK_ENV } from '../src/keystore.ts'
import { LocalCredentialProvider } from '../src/index.ts'

const KEY = credentialRef('DSH_ENC_KEY')
const RECORD = credentialKey('llm-pi-ai', 'enc-record')

const cleanups: Array<() => Promise<void>> = []

afterEach(async () => {
  vi.unstubAllEnvs()
  while (cleanups.length > 0) await cleanups.pop()!()
})

async function tempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-cred-enc-'))
  cleanups.push(() => rm(dir, { recursive: true, force: true }))
  return dir
}

async function boot(config: ConstructorParameters<typeof LocalCredentialProvider>[1]): Promise<Context> {
  const ctx = new Context()
  const fiber = ctx.plugin(LocalCredentialProvider, config)
  cleanups.push(async () => { await fiber.dispose() })
  await fiber
  return ctx
}

describe('encryption at rest', () => {
  it('seals a reference on write and round-trips it across a re-boot', async () => {
    const dir = await tempDir()
    const path = join(dir, '.credentials.yaml')
    const ctx = await boot({ path, watch: false })
    await ctx.credentials.set(KEY, 'sk-live')
    const stored = await readFile(path, 'utf8')
    expect(stored).toContain('DSH_ENC_KEY: enc:v1:')
    expect(stored).not.toContain('sk-live')

    const reread = await boot({ path, watch: false })
    expect(await reread.credentials.resolve(KEY)).toEqual({ value: 'sk-live', source: 'file' })
  })

  it('seals an api-key record and round-trips it across a re-boot', async () => {
    const dir = await tempDir()
    const path = join(dir, '.credentials.yaml')
    const ctx = await boot({ path, watch: false })
    await ctx.credentials.modifyRecord(RECORD, () => Promise.resolve({ kind: 'api-key', key: 'sk-rec', env: { REGION: 'eu' } }))
    const stored = await readFile(path, 'utf8')
    expect(stored).toContain('kind: api-key')
    expect(stored).not.toContain('sk-rec')
    expect(stored).not.toContain('REGION: eu')

    const reread = await boot({ path, watch: false })
    expect(await reread.credentials.readRecord(RECORD)).toEqual({ kind: 'api-key', key: 'sk-rec', env: { REGION: 'eu' } })
  })

  it('reads a legacy plaintext document unchanged', async () => {
    const dir = await tempDir()
    const path = join(dir, '.credentials.yaml')
    await writeFile(path, 'version: 1\nrefs:\n  DSH_ENC_KEY: legacy-plain\n', { mode: 0o600 })
    const ctx = await boot({ path, watch: false })
    expect(await ctx.credentials.resolve(KEY)).toEqual({ value: 'legacy-plain', source: 'file' })
  })

  it('uses the key from the environment and never creates a key file', async () => {
    vi.stubEnv(KEK_ENV, encodeKek(generateKek()))
    const dir = await tempDir()
    const path = join(dir, '.credentials.yaml')
    const ctx = await boot({ path, watch: false })
    await ctx.credentials.set(KEY, 'sk-env')
    const reread = await boot({ path, watch: false })
    expect(await reread.credentials.resolve(KEY)).toEqual({ value: 'sk-env', source: 'file' })
    await expect(readFile(join(dir, '.credentials.key'), 'utf8')).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('fails the boot loud when the key cannot unseal a stored value', async () => {
    vi.stubEnv(KEK_ENV, encodeKek(generateKek()))
    const dir = await tempDir()
    const path = join(dir, '.credentials.yaml')
    const ctx = await boot({ path, watch: false })
    await ctx.credentials.set(KEY, 'sk-secret')

    vi.stubEnv(KEK_ENV, encodeKek(generateKek()))
    await expect(new Context().plugin(LocalCredentialProvider, { path, watch: false })).rejects.toThrow(SealedValueError)
  })
})
