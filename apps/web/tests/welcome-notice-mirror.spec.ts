// @vitest-environment node
/**
 * Drift guard for the mirrored welcome-notice constants in scaffold.ts.
 *
 * The host-side e2e graph cannot import the browser package that owns these
 * values, so scaffold.ts mirrors them as source text. The client compares the
 * stored acknowledgement to the shipped version for exact equality, which makes
 * a stale mirror a silent lane break: the notice stops being pre-acknowledged,
 * its modal mask covers the app, and every recorded click lands on the mask.
 *
 * Both files are read as text: importing the scaffold here would pull its whole
 * workspace graph into the apps/web typecheck face.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/** The onboarding copy module that owns these values. */
const CLIENT = join(process.cwd(), 'packages/client/ui-settings-models/src/onboarding-copy.ts')
/** The host-side mirror under test. */
const MIRROR = join(process.cwd(), 'apps/web/tests/scaffold.ts')

/**
 * Read the string a module assigns to a constant.
 * @param text - module source text.
 * @param name - exported constant name.
 * @returns the assigned literal, or undefined when the name is not a plain string.
 */
function assignedString(text: string, name: string): string | undefined {
  return new RegExp(`${name}\\s*=\\s*'([^']*)'`).exec(text)?.[1]
}

/**
 * Read one `key: 'value'` pair out of an object literal.
 * @param text - module source text.
 * @param key - property name.
 * @returns the assigned literal, or undefined when absent.
 */
function propertyString(text: string, key: string): string | undefined {
  return new RegExp(`${key}:\\s*'([^']*)'`).exec(text)?.[1]
}

describe('welcome notice mirror', () => {
  const client = readFileSync(CLIENT, 'utf8')
  const mirror = readFileSync(MIRROR, 'utf8')

  it('mirrors the namespace, the ack field, and the shipped version', () => {
    for (const name of [
      'WELCOME_NOTICE_SETTINGS_NAMESPACE', 'WELCOME_NOTICE_ACK_FIELD', 'WELCOME_NOTICE_VERSION',
    ]) {
      const shipped = assignedString(client, name)
      expect(shipped, `client declares ${name}`).toBeDefined()
      expect(assignedString(mirror, name), `mirror matches ${name}`).toBe(shipped)
    }
  })

  it('mirrors the copy the onboarding scenario asserts', () => {
    for (const key of ['title', 'body', 'continueLabel']) {
      const shipped = propertyString(client, key)
      expect(shipped, `client declares ${key}`).toBeDefined()
      expect(propertyString(mirror, key), `mirror matches ${key}`).toBe(shipped)
    }
  })
})
