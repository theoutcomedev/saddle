import fs from 'node:fs/promises'
import path from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { ToolRunContext } from '@deepseek-ai/dsh-tools'
import type { ContentBlock } from '@deepseek-ai/dsh-llm'
import type { JsonValue } from '@deepseek-ai/dsh-session'
import type {} from '@deepseek-ai/dsh-system-prompt'
import { credentialKey } from '@deepseek-ai/dsh-credentials'
import { SteelClient, type SteelSession } from './steel-client.ts'
import { CdpSession } from './cdp.ts'
import { loadProfile, saveProfile, listProfiles } from './profiles.ts'

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
  const fallback = `http://steel.${serverIp}.sslip.io/v1/sessions/debug?showControls=false&interactive=true`

  if (!rawDebugUrl) return fallback
  if (rawDebugUrl.includes('0.0.0.0') || rawDebugUrl.includes('127.0.0.1') || rawDebugUrl.includes('steel:')
    || rawDebugUrl.includes('saddle-steel:') || /^https?:\/\/172\./.test(rawDebugUrl)) {
    return fallback
  }
  const sep = rawDebugUrl.includes('?') ? '&' : '?'
  return `${rawDebugUrl}${sep}showControls=false&interactive=true`
}

async function resolveModelAdmitsImages(ctx: Context, exec?: ToolRunContext): Promise<boolean> {
  try {
    const routed = exec?.agent?.session.requestHeader()?.config
    const provider = routed?.provider ?? exec?.agent?.options.provider
    const model = routed?.model ?? exec?.agent?.options.model
    const llm = ctx.get('llm') as {
      resolveModelInfo?: (p: string, m: string, s?: AbortSignal) => Promise<{ inputModalities?: string[] }>
    } | undefined
    if (provider && model && typeof llm?.resolveModelInfo === 'function') {
      const info = await llm.resolveModelInfo(provider, model, exec?.signal)
      if (Array.isArray(info?.inputModalities) && info.inputModalities.includes('image')) {
        return true
      }
    }
  } catch {}
  return false
}

async function ensureSession(
  ctx: Context,
  config: Config,
  profileName?: string,
): Promise<{ steel: SteelSession; cdp: CdpSession; viewerUrl: string }> {
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

  let sessionContext: Record<string, unknown> | undefined
  if (profileName) {
    const loaded = await loadProfile(profileName)
    if (loaded) {
      sessionContext = loaded
    }
  }

  const baseUrl = resolveBaseUrl(config, credUrl)
  const client = new SteelClient(baseUrl, apiKey)

  try {
    steelSession = await client.createSession({
      ...(twoCaptchaKey ? { twoCaptchaKey } : {}),
      ...(sessionContext ? { sessionContext } : {}),
    })
    cdpSession = await CdpSession.connect(steelSession.websocketUrl)
    const downloadDir = path.resolve(process.env.SADDLE_DATA_DIR || '/app/data', 'downloads')
    await fs.mkdir(downloadDir, { recursive: true }).catch(() => {})
    await cdpSession.setDownloadPath(downloadDir).catch(() => {})
  } catch (error) {
    throw new Error(`Steel browser not configured or reachable. Detail: ${error}`)
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
      'You can pass profile: "name" to browser_navigate to load saved cookies and logins.',
      'Use browser_save_profile to save your login session and cookies under a profile name for future tasks.',
      'Use browser_get_content to inspect the page and discover form inputs, buttons, and recommended selectors.',
      'Use browser_click with selector (e.g. "#search-btn"), button text, or x,y pixel coordinates.',
      'Use browser_type with selector and text to fill input fields, with optional pressEnter: true.',
      'Use browser_screenshot to capture the visual page state.',
      'Use browser_pdf to export pages as styled PDFs directly into the workspace.',
      'Use browser_download_file to download files using session authentication cookies.',
      'Call browser_session_end when completely done browsing to free resources.',
    ].join(' '),
  })

  const outputBase = {
    schema: {
      type: 'object',
      properties: {
        viewerUrl: { type: 'string', required: true },
        result: { type: 'string', required: true },
        attachment: { type: 'json' },
        admitsImages: { type: 'boolean' },
      },
      additionalProperties: true,
    } as const,
    render: (_args: unknown, value: unknown): ContentBlock[] => {
      const val = value as {
        result: string
        viewerUrl: string
        attachment?: unknown
        admitsImages?: boolean
      }
      const blocks: ContentBlock[] = [{ type: 'text' as const, text: val.result }]
      if (val.attachment && val.admitsImages) {
        blocks.push({
          type: 'image' as const,
          attachment: val.attachment as any,
        })
      }
      return blocks
    },
  }

  ctx.tools.register(defineTool({
    name: 'browser_navigate',
    description: 'Navigate the browser to a URL. Returns a success message and viewer URL.',
    parameters: {
      url: { type: 'string', required: true, description: 'The URL to navigate to.' },
      profile: {
        type: 'string',
        description: 'Optional saved profile name (e.g. "default", "github") to resume cookies and authenticated state.',
      },
    },
    output: outputBase,
    async execute(args: { url: string; profile?: string }, _exec) {
      const { cdp, viewerUrl } = await ensureSession(ctx, config, args.profile)
      await cdp.navigate(args.url)
      const title = await cdp.evaluate('document.title').catch(() => '')
      const profileNote = args.profile ? ` with profile "${args.profile}"` : ''
      return { viewerUrl, result: `Navigated to ${args.url}${profileNote}. Page title: "${String(title ?? '')}"` }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'browser_get_content',
    description: 'Inspect the current page to extract its title, URL, form inputs (with exact selectors), clickable buttons, links, and headings.',
    parameters: {
      format: {
        type: 'string',
        description: 'Output format: "interactive" (default, structured form inputs and buttons), "text" (clean text only), or "html".',
      },
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
    description: 'Take a screenshot of the current page. Open the browser pane viewer to see it, or inspect the attached visual image.',
    parameters: {},
    output: outputBase,
    async execute(_args: unknown, exec: ToolRunContext) {
      const { cdp, viewerUrl } = await ensureSession(ctx, config)
      const pngBase64 = await cdp.screenshot()
      const admitsImages = await resolveModelAdmitsImages(ctx, exec)

      let attachmentRef: unknown = undefined
      const attachments = ctx.get('attachments') as {
        saveImages?: (inputs: readonly { data: Buffer; mediaType: string }[]) => Promise<readonly unknown[]>
      } | undefined
      if (attachments && typeof attachments.saveImages === 'function') {
        try {
          const buffer = Buffer.from(pngBase64, 'base64')
          const refs = await attachments.saveImages([{ data: buffer, mediaType: 'image/png' }])
          attachmentRef = refs[0]
        } catch {
          // best-effort saving to attachment store
        }
      }

      return {
        viewerUrl,
        result: attachmentRef && admitsImages
          ? 'Screenshot captured (visual image attached to this turn).'
          : 'Screenshot taken. Open the browser pane viewer to see the live page.',
        attachment: (attachmentRef as JsonValue) ?? null,
        admitsImages,
      }
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
    name: 'browser_save_profile',
    description: 'Save the current browser state (cookies, localStorage, session storage) to a named profile to resume logins in future sessions.',
    parameters: {
      name: { type: 'string', required: true, description: 'The profile name (e.g. "default", "github", "twitter").' },
    },
    output: outputBase,
    async execute(args: { name: string }, _exec) {
      if (!steelSession) {
        return { viewerUrl: '', result: 'No active browser session to save.' }
      }
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
      const context = await client.getSessionContext(steelSession.id)
      const cleanName = await saveProfile(args.name, context)
      const viewerUrl = resolveViewerUrl(steelSession.debugUrl || steelSession.viewerUrl)
      return {
        viewerUrl,
        result: `Browser session state successfully saved to profile "${cleanName}". Future sessions can use browser_navigate with profile: "${cleanName}" to resume.`,
      }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'browser_list_profiles',
    description: 'List all saved browser profile names available for resumption.',
    parameters: {},
    output: outputBase,
    async execute(_args: unknown, _exec) {
      const profiles = await listProfiles()
      const viewerUrl = steelSession ? resolveViewerUrl(steelSession.debugUrl || steelSession.viewerUrl) : ''
      if (profiles.length === 0) {
        return { viewerUrl, result: 'No saved browser profiles found.' }
      }
      return {
        viewerUrl,
        result: `Saved browser profiles (${profiles.length}):\n${profiles.map(p => `- ${p}`).join('\n')}`,
      }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'browser_pdf',
    description: 'Export the current page as a styled PDF and save it directly into the workspace.',
    parameters: {
      path: {
        type: 'string',
        description: 'Destination filename or path (e.g. "report.pdf", "docs/summary.pdf"). Defaults to "page.pdf".',
      },
      landscape: {
        type: 'boolean',
        description: 'Render in landscape orientation (defaults to false).',
      },
      printBackground: {
        type: 'boolean',
        description: 'Print background graphics and colors (defaults to true).',
      },
      scale: {
        type: 'number',
        description: 'Scale factor of the webpage rendering (default 1.0).',
      },
      pageRanges: {
        type: 'string',
        description: 'Paper ranges to print, e.g. "1-5", "8", "1-3, 5".',
      },
    },
    output: outputBase,
    async execute(args: {
      path?: string
      landscape?: boolean
      printBackground?: boolean
      scale?: number
      pageRanges?: string
    }, exec: ToolRunContext) {
      const { cdp, viewerUrl } = await ensureSession(ctx, config)
      const pdfBase64 = await cdp.printToPdf({
        landscape: args.landscape,
        printBackground: args.printBackground,
        scale: args.scale,
        pageRanges: args.pageRanges,
      })
      const targetFile = args.path || 'page.pdf'
      const sessionCwd = exec.agent?.session.header.cwd || process.cwd()
      const fullPath = path.isAbsolute(targetFile) ? targetFile : path.resolve(sessionCwd, targetFile)
      await fs.mkdir(path.dirname(fullPath), { recursive: true })
      const buffer = Buffer.from(pdfBase64, 'base64')
      await fs.writeFile(fullPath, buffer)
      return {
        viewerUrl,
        result: `Successfully exported page PDF (${buffer.length} bytes) to ${fullPath}`,
      }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'browser_download_file',
    description: 'Download a file using the active session cookies and headers, saving it to the workspace.',
    parameters: {
      url: {
        type: 'string',
        required: true,
        description: 'The URL of the file to download.',
      },
      path: {
        type: 'string',
        description: 'Destination path or filename in workspace (defaults to filename from URL).',
      },
    },
    output: outputBase,
    async execute(args: { url: string; path?: string }, exec: ToolRunContext) {
      const { cdp, viewerUrl } = await ensureSession(ctx, config)
      const script = `(async () => {
        const res = await fetch(${JSON.stringify(args.url)});
        if (!res.ok) throw new Error('HTTP download failed: ' + res.status + ' ' + res.statusText);
        const blob = await res.blob();
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const result = reader.result;
            if (typeof result === 'string') {
              const idx = result.indexOf(',');
              resolve(idx >= 0 ? result.slice(idx + 1) : result);
            } else {
              reject(new Error('Failed to read blob'));
            }
          };
          reader.onerror = () => reject(new Error('FileReader error'));
          reader.readAsDataURL(blob);
        });
      })()`

      const base64Data = await cdp.evaluate(script) as string
      if (!base64Data || typeof base64Data !== 'string') {
        throw new Error('Failed to retrieve file contents from browser context.')
      }

      let filename = args.path
      if (!filename) {
        try {
          const parsed = new URL(args.url)
          const base = path.basename(parsed.pathname)
          filename = base || 'downloaded_file'
        } catch {
          filename = 'downloaded_file'
        }
      }

      const sessionCwd = exec.agent?.session.header.cwd || process.cwd()
      const fullPath = path.isAbsolute(filename) ? filename : path.resolve(sessionCwd, filename)
      await fs.mkdir(path.dirname(fullPath), { recursive: true })
      const buffer = Buffer.from(base64Data, 'base64')
      await fs.writeFile(fullPath, buffer)
      return {
        viewerUrl,
        result: `Successfully downloaded file (${buffer.length} bytes) to ${fullPath}`,
      }
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
