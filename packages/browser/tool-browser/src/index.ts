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

async function ensureSession(ctx: Context, config: Config): Promise<{ steel: SteelSession; cdp: CdpSession; viewerUrl: string }> {
  if (steelSession && cdpSession) return { steel: steelSession, cdp: cdpSession, viewerUrl: steelSession.viewerUrl }

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

  return { steel: steelSession, cdp: cdpSession, viewerUrl: steelSession.viewerUrl }
}

export function apply(ctx: Context, config: Config = {}): void {
  ctx.systemPrompt.section({
    name: 'tool:browser',
    order: 110,
    text: [
      'Browser tools give you a real Chrome browser. Call browser_navigate first to open a page.',
      'Always call browser_screenshot after interactions to verify the result.',
      'Use browser_click with x,y pixel coordinates (read them from the screenshot).',
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
    description: 'Click at specific x,y coordinates.',
    parameters: {
      x: { type: 'number', required: true },
      y: { type: 'number', required: true },
    },
    output: outputBase,
    async execute(args: { x: number; y: number }, _exec) {
      const { cdp, viewerUrl } = await ensureSession(ctx, config)
      await cdp.click(args.x, args.y)
      return { viewerUrl, result: `Clicked at (${args.x}, ${args.y}).` }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'browser_type',
    description: 'Type text at the current cursor position.',
    parameters: {
      text: { type: 'string', required: true },
    },
    output: outputBase,
    async execute(args: { text: string }, _exec) {
      const { cdp, viewerUrl } = await ensureSession(ctx, config)
      await cdp.type(args.text)
      return { viewerUrl, result: 'Typed text.' }
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
    description: 'End the current browser session.',
    parameters: {},
    output: outputBase,
    async execute(_args: unknown, _exec) {
      if (steelSession && cdpSession) {
        const id = steelSession.id
        const viewerUrl = steelSession.viewerUrl

        // release without waiting
        const key = credentialKey('connections', 'steel-browser')
        const cred = await ctx.credentials.readRecord(key).catch(() => null)
        let apiKey: string | undefined
        let credUrl: string | undefined
        if (cred?.kind === 'grant' && cred.payload && typeof cred.payload === 'object') {
          const payload = cred.payload as { type?: string; values?: { apiKey?: string; url?: string } }
          if (payload.type === 'api-key' && payload.values) {
            const values = payload.values
            apiKey = values.apiKey
            credUrl = values.url
          }
        }
        const baseUrl = resolveBaseUrl(config, credUrl)
        const client = new SteelClient(baseUrl, apiKey)
        client.releaseSession(id).catch(() => {})

        cdpSession.close()
        steelSession = null
        cdpSession = null
        return { viewerUrl, result: 'Session ended.' }
      }
      return { viewerUrl: '', result: 'No active session.' }
    },
  }))
}
