/**
 * App store + notepad persistence for the "My Apps" sidebar surface.
 * @module @deepseek-ai/dsh-host-app-store
 */

import type { Context } from '@deepseek-ai/cordis'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { dshHomePath } from '@deepseek-ai/dsh-home-paths'
import type {} from 'zod'
import type { NotepadSaveResult, NotepadSnapshot } from './types.ts'

export type * from './types.ts'

/** Note filename under the profile apps directory. */
const NOTE_FILE = '.notepad.txt'

/** Remote-only service exposing the app-store notepad persistence. */
export class AppStoreGateway extends TypertRemoteService {
  constructor(ctx: Context) {
    super(ctx, 'appStore')
  }

  private notePath(): string {
    return dshHomePath('apps', NOTE_FILE)
  }

  @Remote('load')
  async load(): Promise<NotepadSnapshot> {
    const target = this.notePath()
    try {
      await fs.mkdir(path.dirname(target), { recursive: true })
      const content = await fs.readFile(target, 'utf8')
      return { content }
    } catch (e: unknown) {
      if (e instanceof Error && 'code' in e && e.code === 'ENOENT') return { content: '' }
      throw e
    }
  }

  @Remote('save')
  async save(content: string): Promise<NotepadSaveResult> {
    const target = this.notePath()
    await fs.mkdir(path.dirname(target), { recursive: true })
    await fs.writeFile(target, content, 'utf8')
    return { ok: true }
  }
}

export default AppStoreGateway
