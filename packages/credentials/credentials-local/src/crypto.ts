/**
 * Envelope encryption for the secret values the credentials document persists
 * at rest. A document that holds only ciphertext stays inert to anyone who can
 * read its bytes but not its key: each entry is sealed under its own random
 * data key, and that data key is wrapped by a single key-encryption key the
 * owner controls.
 *
 * The sealed layout is versioned and self-describing. One entry's data key is
 * independent of every other entry's, so rotating the key-encryption key
 * re-wraps data keys without re-encrypting any entry, and losing one data key
 * exposes one entry rather than the whole document.
 *
 * This module owns only the sealing arithmetic. It never touches the
 * filesystem or the key-encryption key's own storage: the provider that adopts
 * it owns where the key lives, how it is created, and how sealed values are
 * distinguished from legacy plaintext on disk.
 * @module @deepseek-ai/dsh-credentials-local/crypto
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

/** Size in bytes of both the key-encryption key and each data key. */
const KEY_BYTES = 32
/** GCM nonce size in bytes. */
const NONCE_BYTES = 12
/** GCM authentication-tag size in bytes. */
const TAG_BYTES = 16
/** Byte width of the wrapped data-key envelope: wrap nonce, key, and tag. */
const WRAP_BYTES = NONCE_BYTES + KEY_BYTES + TAG_BYTES
/** Versioned prefix every sealed value carries. */
const SEAL_PREFIX = 'enc:v1:'

/** The ciphertext layout this module reads and writes. */
const CIPHER = 'aes-256-gcm'

/**
 * A value could not be unsealed: the wrong key-encryption key, tampered bytes,
 * a truncated or foreign value, or anything else the authenticated cipher
 * refuses. The provider maps this to a loud diagnostic that never quotes the
 * bytes it was handed.
 */
export class SealedValueError extends Error {
  /** Stable discriminator callers match instead of reading the message. */
  readonly code = 'SEALED_VALUE'
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'SealedValueError'
  }
}

/**
 * Reject a key-encryption key of any length other than {@link KEY_BYTES}, before
 * the cipher would. A caller passing a truncated or oversized key has a
 * configuration bug, and the earlier that fails the clearer the diagnosis.
 * @param kek - the key to check.
 * @throws TypeError when the key is not {@link KEY_BYTES} bytes.
 */
function assertKek(kek: Buffer): void {
  if (kek.length !== KEY_BYTES) {
    throw new TypeError(`credential key must be ${KEY_BYTES} bytes, got ${kek.length}`)
  }
}

/**
 * Encrypt plaintext under a key with a fresh random nonce.
 * @param key - the AES-256-GCM key.
 * @param plaintext - the bytes to encrypt.
 * @returns the nonce, ciphertext, and authentication tag as separate buffers.
 */
function encryptGcm(key: Buffer, plaintext: Buffer): {
  nonce: Buffer
  ciphertext: Buffer
  tag: Buffer
} {
  const nonce = randomBytes(NONCE_BYTES)
  const cipher = createCipheriv(CIPHER, key, nonce)
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()])
  return { nonce, ciphertext, tag: cipher.getAuthTag() }
}

/**
 * Decrypt and authenticate ciphertext under a key.
 * @param key - the AES-256-GCM key.
 * @param nonce - the nonce the ciphertext was sealed with.
 * @param ciphertext - the encrypted bytes.
 * @param tag - the authentication tag to verify.
 * @returns the plaintext bytes.
 * @throws SealedValueError when the tag does not authenticate the ciphertext.
 */
function decryptGcm(key: Buffer, nonce: Buffer, ciphertext: Buffer, tag: Buffer): Buffer {
  const decipher = createDecipheriv(CIPHER, key, nonce)
  decipher.setAuthTag(tag)
  try {
    return Buffer.concat([decipher.update(ciphertext), decipher.final()])
  } catch (error) {
    throw new SealedValueError('sealed value failed authentication', { cause: error })
  }
}

/**
 * Generate a random {@link KEY_BYTES}-byte key-encryption key.
 * @returns the new key.
 */
export function generateKek(): Buffer {
  return randomBytes(KEY_BYTES)
}

/**
 * Encode a key-encryption key as URL-safe base64 for storage in a file or
 * environment variable.
 * @param kek - the key to encode.
 * @returns the encoded key.
 */
export function encodeKek(kek: Buffer): string {
  assertKek(kek)
  return kek.toString('base64url')
}

/**
 * Decode a stored or environment-supplied key-encryption key.
 * @param encoded - the URL-safe base64 key.
 * @returns the decoded key.
 * @throws TypeError when the value does not decode to exactly {@link KEY_BYTES} bytes.
 */
export function parseKek(encoded: string): Buffer {
  const kek = Buffer.from(encoded, 'base64url')
  if (kek.length !== KEY_BYTES) {
    throw new TypeError(`credential key must decode to ${KEY_BYTES} bytes, got ${kek.length}`)
  }
  return kek
}

/**
 * Whether a stored value is already a sealed credential. The provider reads
 * this before choosing to seal on write or to unseal on read, so a legacy
 * plaintext value and a sealed one can coexist during migration.
 * @param value - the stored value.
 * @returns true when the value carries the sealed-value prefix.
 */
export function isSealed(value: string): boolean {
  return value.startsWith(SEAL_PREFIX)
}

/**
 * Seal one secret value under a key-encryption key.
 * @param plaintext - the non-empty secret to seal.
 * @param kek - the {@link KEY_BYTES}-byte key-encryption key.
 * @returns the versioned, self-describing sealed value.
 */
export function seal(plaintext: string, kek: Buffer): string {
  assertKek(kek)
  const dek = randomBytes(KEY_BYTES)
  const wrap = encryptGcm(kek, dek)
  const body = encryptGcm(dek, Buffer.from(plaintext, 'utf8'))
  const blob = Buffer.concat([wrap.nonce, wrap.ciphertext, wrap.tag, body.nonce, body.ciphertext, body.tag])
  return SEAL_PREFIX + blob.toString('base64url')
}

/**
 * Unseal one sealed value under the key-encryption key that wrapped it.
 * @param sealed - the versioned sealed value.
 * @param kek - the {@link KEY_BYTES}-byte key-encryption key.
 * @returns the plaintext the value was sealed from.
 * @throws SealedValueError when the value is not sealed, is truncated, or fails authentication.
 */
export function open(sealed: string, kek: Buffer): string {
  assertKek(kek)
  if (!isSealed(sealed)) {
    throw new SealedValueError('value is not a sealed credential')
  }
  const blob = Buffer.from(sealed.slice(SEAL_PREFIX.length), 'base64url')
  if (blob.length < WRAP_BYTES + NONCE_BYTES + TAG_BYTES) {
    throw new SealedValueError('sealed value is truncated')
  }
  const wrapNonce = blob.subarray(0, NONCE_BYTES)
  const wrapCipher = blob.subarray(NONCE_BYTES, NONCE_BYTES + KEY_BYTES)
  const wrapTag = blob.subarray(NONCE_BYTES + KEY_BYTES, WRAP_BYTES)
  const dek = decryptGcm(kek, wrapNonce, wrapCipher, wrapTag)
  const body = blob.subarray(WRAP_BYTES)
  const nonce = body.subarray(0, NONCE_BYTES)
  const ciphertext = body.subarray(NONCE_BYTES, body.length - TAG_BYTES)
  const tag = body.subarray(body.length - TAG_BYTES)
  return decryptGcm(dek, nonce, ciphertext, tag).toString('utf8')
}
