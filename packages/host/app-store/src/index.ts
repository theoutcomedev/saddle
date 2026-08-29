/**
 * App store + notepad persistence for the "My Apps" sidebar surface.
 * @module @deepseek-ai/dsh-host-app-store
 */

import type { Context } from '@deepseek-ai/cordis'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import type {} from '@deepseek-ai/dsh-fs'
import type {} from '@deepseek-ai/dsh-sandbox-policy'
import type {} from 'zod'
import type { NotepadSaveResult, NotepadSnapshot } from './types.ts'

export type * from './types.ts'

/** Note filename under the session workspace root. */
const NOTE_FILE = '.notepad.txt'

/** Remote-only service exposing the app-store notepad persistence. */
export class AppStoreGateway extends TypertRemoteService {
  static inject = ['fs', 'sandboxPolicy']

  constructor(ctx: Context) {
    super(ctx, 'appStore')
  }

  private notePath(): string {
    const root = this.ctx.sandboxPolicy.workspaceRoot
    return `${root.replace(/\/+$/, '')}/${NOTE_FILE}`
  }

  @Remote('load')
  async load(): Promise<NotepadSnapshot> {
    const target = await this.ctx.fs.resolve(this.notePath())
    const info = await this.ctx.fs.stat(target)
    if (info === undefined) return { content: '' }
    const content = await this.ctx.fs.readText(target)
    return { content }
  }

  @Remote('save')
  async save(content: string): Promise<NotepadSaveResult> {
    const target = await this.ctx.fs.resolve(this.notePath())
    await this.ctx.fs.writeText(target, content)
    return { ok: true }
  }
}

export default AppStoreGateway
