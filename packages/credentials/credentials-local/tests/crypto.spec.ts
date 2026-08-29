// Envelope-encryption behavior: a sealed value hides its plaintext, round-trips
// under the wrapping key, and refuses anything but the exact key and bytes it
// was sealed with.
import { describe, expect, it } from 'vitest'
import {
  encodeKek,
  generateKek,
  isSealed,
  open,
  parseKek,
  seal,
  SealedValueError,
} from '../src/crypto.ts'

/** Flip every bit of the final byte, which is part of the authentication tag. */
function tamperLastByte(sealed: string): string {
  const blob = Buffer.from(sealed.slice('enc:v1:'.length), 'base64url')
  // A sealed value decodes to the wrap envelope plus a body, never empty.
  const last = blob.length - 1
  blob[last] = blob[last]! ^ 0xff
  return 'enc:v1:' + blob.toString('base64url')
}

describe('seal / open', () => {
  const kek = generateKek()

  it('round-trips a secret under its wrapping key', () => {
    const sealed = seal('sk-live-123', kek)
    expect(isSealed(sealed)).toBe(true)
    expect(open(sealed, kek)).toBe('sk-live-123')
  })

  it('hides the plaintext and never returns the input', () => {
    const sealed = seal('sk-live-123', kek)
    expect(sealed.startsWith('enc:v1:')).toBe(true)
    expect(sealed).not.toContain('sk-live-123')
  })

  it('seals the same value to different ciphertexts each time', () => {
    expect(seal('sk-live-123', kek)).not.toBe(seal('sk-live-123', kek))
  })

  it('round-trips empty and multi-byte plaintext', () => {
    expect(open(seal('', kek), kek)).toBe('')
    expect(open(seal('🔑 sk-live-123 🔑', kek), kek)).toBe('🔑 sk-live-123 🔑')
  })

  it('refuses a different key-encryption key', () => {
    const sealed = seal('sk-live-123', kek)
    expect(() => open(sealed, generateKek())).toThrow(SealedValueError)
  })

  it('refuses tampered ciphertext', () => {
    const sealed = seal('sk-live-123', kek)
    expect(() => open(tamperLastByte(sealed), kek)).toThrow(SealedValueError)
  })

  it('refuses a truncated value', () => {
    expect(() => open('enc:v1:AAAA', kek)).toThrow(SealedValueError)
  })

  it('refuses a value that is not sealed', () => {
    expect(() => open('sk-live-123', kek)).toThrow(SealedValueError)
  })

  it('rejects a wrong-sized key-encryption key', () => {
    expect(() => seal('sk-live-123', Buffer.alloc(16))).toThrow(TypeError)
    expect(() => open('enc:v1:AAAA', Buffer.alloc(16))).toThrow(TypeError)
  })
})

describe('key-encryption keys', () => {
  it('round-trips through base64url encoding', () => {
    const kek = generateKek()
    expect(parseKek(encodeKek(kek))).toEqual(kek)
  })

  it('generates distinct keys', () => {
    expect(generateKek()).not.toEqual(generateKek())
  })

  it('rejects an encoding of the wrong length', () => {
    expect(() => parseKek('c2hvcnQ')).toThrow(TypeError)
  })

  it('rejects a malformed encoding', () => {
    expect(() => parseKek('!!!not-base64url!!!')).toThrow(TypeError)
  })
})

describe('isSealed', () => {
  it('recognizes only the versioned prefix', () => {
    expect(isSealed('enc:v1:AAAA')).toBe(true)
    expect(isSealed('sk-live-123')).toBe(false)
    expect(isSealed('enc:v2:AAAA')).toBe(false)
  })
})

describe('SealedValueError', () => {
  it('carries its stable discriminator', () => {
    expect(new SealedValueError('x').code).toBe('SEALED_VALUE')
  })
})
