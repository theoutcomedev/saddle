export interface SteelSession {
  id: string
  websocketUrl: string
  viewerUrl: string
  debugUrl: string
}

export class SteelClient {
  private readonly baseUrl: string
  private readonly apiKey?: string | undefined

  constructor(baseUrl: string, apiKey?: string | undefined) {
    this.baseUrl = baseUrl
    this.apiKey = apiKey
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = { 'Content-Type': 'application/json' }
    if (this.apiKey) h['steel-api-key'] = this.apiKey
    return h
  }

  async createSession(opts?: {
    twoCaptchaKey?: string
    sessionContext?: Record<string, unknown>
  }): Promise<SteelSession> {
    const body: Record<string, unknown> = { sessionTimeout: 3600000 }
    if (opts?.twoCaptchaKey) body.solveCaptcha = true // Steel uses this flag
    if (opts?.sessionContext) body.sessionContext = opts.sessionContext
    const res = await fetch(`${this.baseUrl}/v1/sessions`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`Steel: createSession failed ${res.status}: ${await res.text()}`)
    const data = await res.json() as {
      id: string
      sessionViewerUrl?: string
      cdpUrl?: string
      debugUrl?: string
      websocketUrl?: string
    }
    const rawDebugUrl = data.debugUrl ?? `${this.baseUrl}/v1/sessions/debug`
    const wsUrl = data.cdpUrl ?? `${this.baseUrl.replace(/^http/, 'ws')}/`
    return {
      id: data.id,
      websocketUrl: wsUrl,
      viewerUrl: data.sessionViewerUrl ?? rawDebugUrl,
      debugUrl: rawDebugUrl,
    }
  }

  async getSessionContext(sessionId: string): Promise<Record<string, unknown>> {
    const res = await fetch(`${this.baseUrl}/v1/sessions/${sessionId}/context`, {
      method: 'GET',
      headers: this.headers(),
    })
    if (!res.ok) throw new Error(`Steel: getSessionContext failed ${res.status}: ${await res.text()}`)
    return (await res.json()) as Record<string, unknown>
  }

  async releaseSession(sessionId: string): Promise<void> {
    await fetch(`${this.baseUrl}/v1/sessions/${sessionId}/release`, {
      method: 'POST',
      headers: this.headers(),
    }).catch(() => { /* best-effort */ })
  }
}
