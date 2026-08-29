/**
 * Key-encryption-key storage for the credentials provider. The key lives
 * beside the credentials document it protects, so backing up or deleting the
 * two together is one gesture. A key is read from an environment variable when
 * one is present — containers and CI inject the key without a file — and
 * otherwise read from, or created in, the key file.
 *
 * Creation is race-safe: the first caller that finds the file absent generates
 * the key under the file's writer lock, so two processes provisioning one
 * document converge on the same key instead of writing over each other. The
 * file is created owner-only (`0600`) and never broadened.
 * @module @deepseek-ai/dsh-credentials-local/keystore
 */

import { mkdir, readFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { withFileLock, writeFileAtomic } from '@deepseek-ai/dsh-atomic-write'
import { encodeKek, generateKek, parseKek } from './crypto.ts'

/** Basename of the key file, placed beside the credentials document. */
export const KEK_FILENAME = '.credentials.key'
/** Environment variable whose value overrides the key file with a base64url key. */
export const KEK_ENV = 'DSH_CREDENTIALS_KEY'

/** How long a contender waits for the key file's writer lock. */
const KEK_LOCK_WAIT_MS = 30_000

/** Whether a filesystem error means the key file does not exist. */
function isENOENT(error: unknown): boolean {
  return (error as NodeJS.ErrnoException | null)?.code === 'ENOENT'
}

/**
 * Read a key-encryption key from the environment, or `undefined` when the
 * variable is unset or empty. A present value that is not a valid key fails
 * loud rather than falling back to the file: a configured-but-wrong key would
 * otherwise unseal nothing and read as "no credentials stored".
 * @param name - the environment variable holding a base64url-encoded key.
 * @returns the key, or `undefined` when the variable is unset or empty.
 */
export function kekFromEnv(name: string): Buffer | undefined {
  const value = process.env[name]
  if (value === undefined || value.length === 0) return undefined
  return parseKek(value)
}

/**
 * Read a key-encryption key from `filename`, creating it owner-only on first
 * use. An existing file must decode to exactly one key; anything else fails
 * loud so a corrupted key never silently locks every credential out.
 *
 * TODO(credentials-key-permissions): enforce owner-only mode on a pre-existing
 * key file the way the credentials document is, rejecting a key another OS
 * user can read.
 * @param filename - absolute path of the key file.
 * @returns the key the file holds, or the newly generated one.
 */
export async function loadOrCreateKek(filename: string): Promise<Buffer> {
  // The writer lock's `wx` create needs the parent to exist; 0700 because the
  // key file sits beside user-private data.
  await mkdir(dirname(filename), { recursive: true, mode: 0o700 })
  return withFileLock(filename, async () => {
    let text: string | undefined
    try {
      text = await readFile(filename, 'utf8')
    } catch (error) {
      if (!isENOENT(error)) throw error
    }
    if (text === undefined) {
      const kek = generateKek()
      await writeFileAtomic(filename, `${encodeKek(kek)}\n`, { mode: 0o600, dirMode: 0o700 })
      return kek
    }
    return parseKek(text.trim())
  }, { waitMs: KEK_LOCK_WAIT_MS })
}
