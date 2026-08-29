/**
 * Transformations between the plaintext a caller reads and the sealed values
 * the credentials document persists at rest. The provider keeps plaintext in
 * memory and seals only at the render boundary, so a legacy plaintext document
 * and a sealed one read identically while every new write is sealed.
 *
 * A value without the sealed-value prefix is a legacy plaintext value and
 * passes through unchanged on read — the lazy-migration half of the seam. A
 * grant record is opaque to the seam, so its payload is never interpreted or
 * sealed here; only the `api-key` record's `key` and `env` values are.
 * @module @deepseek-ai/dsh-credentials-local/sealing
 */

import type { ApiKeyRecord, CredentialRecord } from '@deepseek-ai/dsh-credentials'
import { isSealed, open, seal } from './crypto.ts'

/** Decrypt one stored value when it is sealed, or pass a legacy value through. */
function openValue(value: string, kek: Buffer): string {
  return isSealed(value) ? open(value, kek) : value
}

/**
 * Decrypt every sealed reference value in place of its plaintext, leaving
 * legacy plaintext values untouched.
 * @param refs - the parsed reference entries.
 * @param kek - the key-encryption key.
 * @returns a map whose values are all plaintext.
 */
export function openRefs(refs: Map<string, string>, kek: Buffer): Map<string, string> {
  const opened = new Map<string, string>()
  for (const [ref, value] of refs) opened.set(ref, openValue(value, kek))
  return opened
}

/**
 * Decrypt the `key` and `env` values of every stored `api-key` record, leaving
 * `grant` records verbatim — their payload is the owner's own format.
 * @param records - the parsed records.
 * @param kek - the key-encryption key.
 * @returns a map whose `api-key` records carry plaintext values.
 */
export function openRecords(records: Map<string, CredentialRecord>, kek: Buffer): Map<string, CredentialRecord> {
  const opened = new Map<string, CredentialRecord>()
  for (const [key, record] of records) {
    opened.set(key, record.kind === 'api-key' ? openApiKey(record, kek) : record)
  }
  return opened
}

/** One `api-key` record with its `key` and `env` values decrypted. */
function openApiKey(record: ApiKeyRecord, kek: Buffer): ApiKeyRecord {
  const env = record.env
  return {
    kind: 'api-key',
    ...record.key === undefined ? {} : { key: openValue(record.key, kek) },
    ...env === undefined ? {} : {
      env: Object.fromEntries(Object.entries(env).map(([name, value]) => [name, openValue(value, kek)])),
    },
  }
}

/**
 * Seal one `api-key` record for the render boundary: its `key` and `env` values
 * become sealed values while the caller's plaintext copy is unchanged.
 * @param record - the plaintext record a mutation returned.
 * @param kek - the key-encryption key.
 * @returns the record as it is persisted.
 */
export function sealApiKeyRecord(record: ApiKeyRecord, kek: Buffer): ApiKeyRecord {
  const env = record.env
  return {
    kind: 'api-key',
    ...record.key === undefined ? {} : { key: seal(record.key, kek) },
    ...env === undefined ? {} : {
      env: Object.fromEntries(Object.entries(env).map(([name, value]) => [name, seal(value, kek)])),
    },
  }
}
