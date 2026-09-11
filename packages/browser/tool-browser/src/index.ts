import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { ContentBlock } from '@deepseek-ai/dsh-llm'
import type {} from '@deepseek-ai/dsh-system-prompt'
import { credentialKey } from '@deepseek-ai/dsh-credentials'
import { SteelClient, type SteelSession } from './steel-client.ts'
import { CdpSession } from './cdp.ts'

export const name = 'tool-browser'
export const inject = ['tools', 'systemPrompt', 'credentials']

export interface Config {
  steelUrl?: string
}

export const Config: z<Config> = z.object({
  steelUrl: z.string(),
})

let steelSession: SteelSession | null = null
let cdpSession: CdpSession | null = null

function resolveBaseUrl(config: Config, credentialUrl?: string): string {
  return config.steelUrl
    ?? credentialUrl
    ?? process.env.STEEL_BROWSER_URL
    ?? 'http://steel:3000'
}

function resolveViewerUrl(rawDebugUrl?: string): string {
  if (process.env.STEEL_PUBLIC_VIEWER_URL) {
    return process.env.STEEL_PUBLIC_VIEWER_URL
  }
  const hostIp = process.env.HOST_PUBLIC_IP || process.env.SADDLE_SERVER_IP
  const serverIp = (!hostIp || hostIp === 'auto') ? '91.99.165.95' : hostIp
  const fallback = `http://steel.${serverIp}.sslip.io/v1/sessions/debug?interactive=true`

  if (!rawDebugUrl) return fallback
  if (rawDebugUrl.includes('0.0.0.0') || rawDebugUrl.includes('127.0.0.1') || rawDebugUrl.includes('steel:') || rawDebugUrl.includes('saddle-steel:') || /^https?:\/\/172\./.test(rawDebugUrl)) {
    return fallback
  }
  return rawDebugUrl.includes('?') ? `${rawDebugUrl}&interactive=true` : `${rawDebugUrl}?interactive=true`
}

async function ensureSession(ctx: Context, config: Config): Promise<{ steel: SteelSession; cdp: CdpSession; viewerUrl: string }> {
  if (steelSession && cdpSession) {
    const publicViewerUrl = resolveViewerUrl(steelSession.debugUrl || steelSession.viewerUrl)
    return { steel: steelSession, cdp: cdpSession, viewerUrl: publicViewerUrl }
  }

  const key = credentialKey('connections', 'steel-browser')
  const cred = await ctx.credentials.readRecord(key).catch(() => null)
  let apiKey: string | undefined
  let credUrl: string | undefined
  let twoCaptchaKey: string | undefined

  if (cred?.kind === 'grant' && cred.payload && typeof cred.payload === 'object') {
    const payload = cred.payload as { type?: string; values?: { apiKey?: string; url?: string; twoCaptchaKey?: string } }
    if (payload.type === 'api-key' && payload.values) {
      const values = payload.values
      apiKey = values.apiKey
      credUrl = values.url
      twoCaptchaKey = values.twoCaptchaKey
    }
  }

  const baseUrl = resolveBaseUrl(config, credUrl)
  const client = new SteelClient(baseUrl, apiKey)

  try {
    steelSession = await client.createSession({ ...(twoCaptchaKey ? { twoCaptchaKey } : {}) })
    cdpSession = await CdpSession.connect(steelSession.websocketUrl)
  } catch (error) {
    throw new Error(`Steel browser not configured or reachable. Add STEEL_BROWSER_URL env var or configure steel-browser in Settings → Connections. Detail: ${error}`)
  }

  const publicViewerUrl = resolveViewerUrl(steelSession.debugUrl || steelSession.viewerUrl)
  return { steel: steelSession, cdp: cdpSession, viewerUrl: publicViewerUrl }
}

export function apply(ctx: Context, config: Config = {}): void {
  async function closeActiveSession(): Promise<void> {
    if (steelSession && cdpSession) {
      const id = steelSession.id
      try { cdpSession.close() } catch {}
      const key = credentialKey('connections', 'steel-browser')
      const cred = await ctx.credentials.readRecord(key).catch(() => null)
      let apiKey: string | undefined
      let credUrl: string | undefined
      if (cred?.kind === 'grant' && cred.payload && typeof cred.payload === 'object') {
        const payload = cred.payload as { type?: string; values?: { apiKey?: string; url?: string } }
        if (payload.type === 'api-key' && payload.values) {
          apiKey = payload.values.apiKey
          credUrl = payload.values.url
        }
      }
      const baseUrl = resolveBaseUrl(config, credUrl)
      const client = new SteelClient(baseUrl, apiKey)
      client.releaseSession(id).catch(() => {})
      steelSession = null
      cdpSession = null
    }
  }

  ctx.effect(() => () => {
    void closeActiveSession().catch(() => {})
  }, 'tool-browser: cleanup')

  ctx.systemPrompt.section({
    name: 'tool:browser',
    order: 110,
    text: [
      'Browser tools give you a real Chrome browser. Call browser_navigate first to open a page.',
      'Use browser_get_content to inspect the page and discover form inputs, buttons, and recommended selectors.',
      'Use browser_click with selector (e.g. "#search-btn"), button text, or x,y pixel coordinates.',
      'Use browser_type with selector and text to fill input fields, with optional pressEnter: true.',
      'Use browser_screenshot after interactions to verify the visual state in the browser pane.',
      'Call browser_session_end when completely done browsing to free resources.',
    ].join(' '),
  })

  const outputBase = {
    schema: {
      type: 'object',
      properties: {
        viewerUrl: { type: 'string', required: true },
        result: { type: 'string', required: true },
      },
      additionalProperties: false,
    } as const,
    render: (_args: unknown, value: unknown): ContentBlock[] => {
      const val = value as { result: string; viewerUrl: string }
      return [{ type: 'text' as const, text: val.result }]
    },
  }

  ctx.tools.register(defineTool({
    name: 'browser_navigate',
    description: 'Navigate the browser to a URL. Returns a success message and viewer URL.',
    parameters: {
      url: { type: 'string', required: true, description: 'The URL to navigate to.' },
    },
    output: outputBase,
    async execute(args: { url: string }, _exec) {
      const { cdp, viewerUrl } = await ensureSession(ctx, config)
      await cdp.navigate(args.url)
      const title = await cdp.evaluate('document.title').catch(() => '')
      return { viewerUrl, result: `Navigated to ${args.url}. Page title: "${String(title ?? '')}"` }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'browser_get_content',
    description: 'Inspect the current page to extract its title, URL, form inputs (with exact selectors), clickable buttons, links, and headings.',
    parameters: {
      format: { type: 'string', description: 'Output format: "interactive" (default, structured form inputs and buttons), "text" (clean text only), or "html".' },
    },
    output: outputBase,
    async execute(args: { format?: 'interactive' | 'text' | 'html' }, _exec) {
      const { cdp, viewerUrl } = await ensureSession(ctx, config)
      const content = await cdp.getPageContent(args.format || 'interactive')
      return { viewerUrl, result: content }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'browser_screenshot',
    description: 'Take a screenshot of the current page. Open the browser pane viewer to see it.',
    parameters: {},
    output: outputBase,
    async execute(_args: unknown, _exec) {
      const { cdp, viewerUrl } = await ensureSession(ctx, config)
      await cdp.screenshot()
      return { viewerUrl, result: 'Screenshot taken.' }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'browser_click',
    description: 'Click an element on the page using a CSS selector, visible button/link text, or (x, y) coordinates.',
    parameters: {
      selector: { type: 'string', description: 'CSS selector of the element to click (e.g. "#submit-button", "button.btn-primary").' },
      text: { type: 'string', description: 'Visible text of the button or link to click (e.g. "Log In", "Search").' },
      x: { type: 'number', description: 'Optional pixel X coordinate.' },
      y: { type: 'number', description: 'Optional pixel Y coordinate.' },
    },
    output: outputBase,
    async execute(args: { selector?: string; text?: string; x?: number; y?: number }, _exec) {
      const { cdp, viewerUrl } = await ensureSession(ctx, config)
      const res = await cdp.clickElement(args)
      return { viewerUrl, result: res.description }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'browser_type',
    description: 'Type text into an input field or at the current cursor position. Optionally clear the field first and press Enter.',
    parameters: {
      text: { type: 'string', required: true, description: 'The text to type.' },
      selector: { type: 'string', description: 'Optional CSS selector of the input or textarea to focus and type into (e.g. "input[name=\'q\']", "#search").' },
      clear: { type: 'boolean', description: 'Clear existing text in the input before typing (defaults to false).' },
      pressEnter: { type: 'boolean', description: 'Press Enter key immediately after typing (defaults to false).' },
    },
    output: outputBase,
    async execute(args: { text: string; selector?: string; clear?: boolean; pressEnter?: boolean }, _exec) {
      const { cdp, viewerUrl } = await ensureSession(ctx, config)
      const result = await cdp.typeElement(args)
      return { viewerUrl, result }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'browser_scroll',
    description: 'Scroll the page vertically. Positive deltaY scrolls down, negative scrolls up.',
    parameters: {
      x: { type: 'number', required: true, description: 'X coordinate of the mouse during scroll.' },
      y: { type: 'number', required: true, description: 'Y coordinate of the mouse during scroll.' },
      deltaY: { type: 'number', required: true, description: 'Scroll amount in pixels.' },
    },
    output: outputBase,
    async execute(args: { x: number; y: number; deltaY: number }, _exec) {
      const { cdp, viewerUrl } = await ensureSession(ctx, config)
      await cdp.scroll(args.x, args.y, args.deltaY)
      return { viewerUrl, result: `Scrolled by ${args.deltaY}.` }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'browser_evaluate',
    description: 'Evaluate JavaScript in the browser context.',
    parameters: {
      script: { type: 'string', required: true },
    },
    output: outputBase,
    async execute(args: { script: string }, _exec) {
      const { cdp, viewerUrl } = await ensureSession(ctx, config)
      const res = await cdp.evaluate(args.script)
      return { viewerUrl, result: `Evaluated script. Result: ${JSON.stringify(res)}` }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'browser_session_end',
    description: 'End the current browser session and free resources.',
    parameters: {},
    output: outputBase,
    async execute(_args: unknown, _exec) {
      if (steelSession && cdpSession) {
        const viewerUrl = steelSession.viewerUrl
        await closeActiveSession()
        return { viewerUrl, result: 'Session ended.' }
      }
      return { viewerUrl: '', result: 'No active session.' }
    },
  }))
}
