import { WebSocket } from 'ws'

export class CdpSession {
  private ws: WebSocket
  private seq = 0
  private pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>()
  private closed = false
  private pageSessionId: string | null = null

  static async connect(wsUrl: string): Promise<CdpSession> {
    const session = new CdpSession(wsUrl)
    await session.ready()
    await session.attachPage()
    return session
  }

  private constructor(wsUrl: string) {
    this.ws = new WebSocket(wsUrl)
    this.ws.on('message', (data) => {
      const msg = JSON.parse(String(data)) as { id?: number; result?: unknown; error?: { message: string } }
      if (msg.id === undefined) return
      const handler = this.pending.get(msg.id)
      if (!handler) return
      this.pending.delete(msg.id)
      if (msg.error) handler.reject(new Error(msg.error.message))
      else handler.resolve(msg.result ?? {})
    })
    this.ws.on('close', () => { this.closed = true })
  }

  private ready(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws.once('open', resolve)
      this.ws.once('error', reject)
    })
  }

  private async attachPage(): Promise<void> {
    const targetsRes = await this.rawSend<{ targetInfos?: Array<{ targetId: string; type: string }> }>('Target.getTargets')
    let pageTarget = targetsRes.targetInfos?.find(t => t.type === 'page')
    if (!pageTarget) {
      const created = await this.rawSend<{ targetId: string }>('Target.createTarget', { url: 'about:blank' })
      pageTarget = { targetId: created.targetId, type: 'page' }
    }
    const attached = await this.rawSend<{ sessionId: string }>('Target.attachToTarget', {
      targetId: pageTarget.targetId,
      flatten: true,
    })
    this.pageSessionId = attached.sessionId
    await this.send('Page.enable')
    await this.send('Runtime.enable')
  }

  private rawSend<T = unknown>(method: string, params?: Record<string, unknown>): Promise<T> {
    if (this.closed) throw new Error('CDP session is closed')
    const id = ++this.seq
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject })
      this.ws.send(JSON.stringify({ id, method, params: params ?? {} }))
    })
  }

  send<T = unknown>(method: string, params?: Record<string, unknown>): Promise<T> {
    if (this.closed) throw new Error('CDP session is closed')
    const id = ++this.seq
    const payload: Record<string, unknown> = { id, method, params: params ?? {} }
    if (this.pageSessionId) {
      payload.sessionId = this.pageSessionId
    }
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject })
      this.ws.send(JSON.stringify(payload))
    })
  }

  async navigate(url: string): Promise<void> {
    await this.send('Page.navigate', { url })
    // Wait for page load via a short poll
    await new Promise<void>(resolve => setTimeout(resolve, 2000))
  }

  async screenshot(): Promise<string> {
    const result = await this.send<{ data: string }>('Page.captureScreenshot', { format: 'png', quality: 80 })
    return result.data // base64 PNG
  }

  async click(x: number, y: number): Promise<void> {
    await this.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 })
    await this.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 })
  }

  async type(text: string): Promise<void> {
    for (const char of text) {
      await this.send('Input.dispatchKeyEvent', { type: 'keyDown', text: char })
      await this.send('Input.dispatchKeyEvent', { type: 'keyUp', text: char })
    }
  }

  async scroll(x: number, y: number, deltaY: number): Promise<void> {
    await this.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x, y, deltaX: 0, deltaY })
  }

  async evaluate(script: string): Promise<unknown> {
    const result = await this.send<{ result: { value?: unknown; description?: string } }>(
      'Runtime.evaluate', { expression: script, returnByValue: true },
    )
    return result.result.value ?? result.result.description
  }

  close(): void {
    this.closed = true
    this.ws.close()
    for (const { reject } of this.pending.values()) {
      reject(new Error('CDP session closed'))
    }
    this.pending.clear()
  }
}
