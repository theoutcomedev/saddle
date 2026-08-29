// Key-encryption-key storage behavior: a key file is created owner-only on
// first use, re-read unchanged afterwards, and rejected when it is not a key.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { encodeKek, generateKek } from '../src/crypto.ts'
import { KEK_ENV, kekFromEnv, loadOrCreateKek } from '../src/keystore.ts'

const cleanups: Array<() => Promise<void>> = []

afterEach(async () => {
  vi.unstubAllEnvs()
  while (cleanups.length > 0) await cleanups.pop()!()
})

async function tempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-cred-kek-'))
  cleanups.push(() => rm(dir, { recursive: true, force: true }))
  return dir
}

describe('loadOrCreateKek', () => {
  it('creates an owner-only key file on first use', async () => {
    const dir = await tempDir()
    const keyFile = join(dir, '.credentials.key')
    const kek = await loadOrCreateKek(keyFile)
    expect(kek).toHaveLength(32)
    expect(await readFile(keyFile, 'utf8')).toBe(`${encodeKek(kek)}\n`)
    expect((await stat(keyFile)).mode & 0o777).toBe(0o600)
  })

  it('returns the same key on a later read', async () => {
    const dir = await tempDir()
    const keyFile = join(dir, '.credentials.key')
    const first = await loadOrCreateKek(keyFile)
    expect(await loadOrCreateKek(keyFile)).toEqual(first)
  })

  it('rethrows a read failure other than absence', async () => {
    const dir = await tempDir()
    const keyFile = join(dir, '.credentials.key')
    // A directory at the key path makes readFile fail with EISDIR, not ENOENT.
    await mkdir(keyFile)
    await expect(loadOrCreateKek(keyFile)).rejects.toMatchObject({ code: 'EISDIR' })
  })

  it('rejects a file that does not decode to one key', async () => {
    const dir = await tempDir()
    const keyFile = join(dir, '.credentials.key')
    await writeFile(keyFile, 'not-a-key\n', { mode: 0o600 })
    await expect(loadOrCreateKek(keyFile)).rejects.toThrow(TypeError)
  })
})

describe('kekFromEnv', () => {
  it('returns undefined when the variable is unset', () => {
    vi.stubEnv(KEK_ENV, undefined)
    expect(kekFromEnv(KEK_ENV)).toBeUndefined()
  })

  it('returns undefined when the variable is empty', () => {
    vi.stubEnv(KEK_ENV, '')
    expect(kekFromEnv(KEK_ENV)).toBeUndefined()
  })

  it('parses a valid variable', () => {
    const kek = generateKek()
    vi.stubEnv(KEK_ENV, encodeKek(kek))
    expect(kekFromEnv(KEK_ENV)).toEqual(kek)
  })

  it('rejects a malformed variable', () => {
    vi.stubEnv(KEK_ENV, 'short')
    expect(() => kekFromEnv(KEK_ENV)).toThrow(TypeError)
  })
})
