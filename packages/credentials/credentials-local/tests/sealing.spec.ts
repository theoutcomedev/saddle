// Sealing-layer behavior: sealed values decrypt to their plaintext on read,
// legacy plaintext passes through untouched, and an api-key record seals only
// its key and env values while a grant record stays verbatim.
import { describe, expect, it } from 'vitest'
import type { ApiKeyRecord, CredentialRecord } from '@deepseek-ai/dsh-credentials'
import { generateKek, isSealed, open, seal } from '../src/crypto.ts'
import { openRecords, openRefs, sealApiKeyRecord } from '../src/sealing.ts'

const kek = generateKek()

describe('openRefs', () => {
  it('decrypts sealed values and passes plaintext through', () => {
    const refs = new Map<string, string>([
      ['DSH_SEAL_A', seal('secret-a', kek)],
      ['DSH_SEAL_B', 'plain-b'],
    ])
    const opened = openRefs(refs, kek)
    expect(opened.get('DSH_SEAL_A')).toBe('secret-a')
    expect(opened.get('DSH_SEAL_B')).toBe('plain-b')
  })

  it('returns an empty map for an empty map', () => {
    expect(openRefs(new Map(), kek).size).toBe(0)
  })
})

describe('openRecords', () => {
  it('decrypts api-key key and env, keeps grants verbatim, and preserves absent fields', () => {
    const sealedToken = seal('t', kek)
    const records = new Map<string, CredentialRecord>([
      ['p/with-key', { kind: 'api-key', key: seal('sk-key', kek) }],
      ['p/with-env', { kind: 'api-key', env: { REGION: seal('eu', kek) } }],
      ['p/plain', { kind: 'api-key', key: 'plain-key', env: { REGION: 'plain-region' } }],
      ['p/ambient', { kind: 'api-key' }],
      ['p/grant', { kind: 'grant', payload: { token: sealedToken } }],
    ])
    const opened = openRecords(records, kek)
    expect(opened.get('p/with-key')).toEqual({ kind: 'api-key', key: 'sk-key' })
    expect(opened.get('p/with-env')).toEqual({ kind: 'api-key', env: { REGION: 'eu' } })
    expect(opened.get('p/plain')).toEqual({ kind: 'api-key', key: 'plain-key', env: { REGION: 'plain-region' } })
    expect(opened.get('p/ambient')).toEqual({ kind: 'api-key' })
    expect(opened.get('p/grant')).toEqual({ kind: 'grant', payload: { token: sealedToken } })
  })

  it('returns an empty map for an empty map', () => {
    expect(openRecords(new Map(), kek).size).toBe(0)
  })
})

describe('sealApiKeyRecord', () => {
  it('seals key and env while each round-trips under the key', () => {
    const stored = sealApiKeyRecord({ kind: 'api-key', key: 'sk', env: { REGION: 'eu' } }, kek)
    expect(stored.kind).toBe('api-key')
    expect(isSealed(stored.key as string)).toBe(true)
    expect(open(stored.key as string, kek)).toBe('sk')
    expect(isSealed(stored.env?.REGION as string)).toBe(true)
    expect(open(stored.env?.REGION as string, kek)).toBe('eu')
  })

  it('seals only the fields that are present', () => {
    expect(sealApiKeyRecord({ kind: 'api-key', key: 'sk' }, kek)).not.toHaveProperty('env')
    expect(sealApiKeyRecord({ kind: 'api-key', env: { REGION: 'eu' } }, kek)).not.toHaveProperty('key')
    expect(sealApiKeyRecord({ kind: 'api-key' } satisfies ApiKeyRecord, kek)).toEqual({ kind: 'api-key' })
  })
})
