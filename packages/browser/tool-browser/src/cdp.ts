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
    this.ws = new WebSocket(wsUrl, {
      headers: { Host: 'localhost' },
    })
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

  async clickElement(opts: {
    selector?: string
    text?: string
    x?: number
    y?: number
  }): Promise<{ x: number; y: number; tag?: string; description: string }> {
    if (opts.selector || opts.text) {
      const script = `(() => {
        let el = null;
        const sel = ${JSON.stringify(opts.selector ?? null)};
        const txt = ${JSON.stringify(opts.text ?? null)};
        if (sel) {
          el = document.querySelector(sel);
        }
        if (!el && txt) {
          const selStr = 'a, button, input[type="submit"], input[type="button"], [role="button"], [role="link"], label, span, p, h1, h2, h3, h4, div';
          const candidates = Array.from(document.querySelectorAll(selStr));
          el = candidates.find(node => {
            const content = (node.innerText || node.textContent || '').trim();
            return content.toLowerCase() === txt.toLowerCase();
          }) || candidates.find(node => {
            const content = (node.innerText || node.textContent || '').trim();
            return content.toLowerCase().includes(txt.toLowerCase());
          });
        }
        if (!el) return { error: 'Element not found matching ' + (sel || txt) };
        try { el.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'center' }); } catch {}
        const rect = el.getBoundingClientRect();
        try { el.focus(); } catch {}
        try { el.click(); } catch {}
        return {
          x: Math.round(rect.left + rect.width / 2),
          y: Math.round(rect.top + rect.height / 2),
          tag: el.tagName.toLowerCase(),
          text: (el.innerText || el.textContent || '').slice(0, 50).trim(),
        };
      })()`

      const res = await this.evaluate(script) as { error?: string; x: number; y: number; tag: string; text: string }
      if (res.error) throw new Error(res.error)
      // Also dispatch native CDP click at coordinates
      if (typeof res.x === 'number' && typeof res.y === 'number') {
        await this.click(res.x, res.y)
      }
      return {
        x: res.x,
        y: res.y,
        tag: res.tag,
        description: `Clicked <${res.tag}> "${res.text || opts.selector || opts.text}" at (${res.x}, ${res.y})`,
      }
    }

    if (typeof opts.x === 'number' && typeof opts.y === 'number') {
      await this.click(opts.x, opts.y)
      return { x: opts.x, y: opts.y, description: `Clicked at (${opts.x}, ${opts.y})` }
    }

    throw new Error('Either selector, text, or (x, y) coordinates must be provided to click.')
  }

  async type(text: string): Promise<void> {
    for (const char of text) {
      await this.send('Input.dispatchKeyEvent', { type: 'keyDown', text: char })
      await this.send('Input.dispatchKeyEvent', { type: 'keyUp', text: char })
    }
  }

  async pressKey(key: string): Promise<void> {
    if (key.toLowerCase() === 'enter') {
      await this.send('Input.dispatchKeyEvent', { type: 'keyDown', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13, key: 'Enter', code: 'Enter', text: '\r' })
      await this.send('Input.dispatchKeyEvent', { type: 'keyUp', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13, key: 'Enter', code: 'Enter' })
    } else if (key.toLowerCase() === 'tab') {
      await this.send('Input.dispatchKeyEvent', { type: 'keyDown', windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9, key: 'Tab', code: 'Tab' })
      await this.send('Input.dispatchKeyEvent', { type: 'keyUp', windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9, key: 'Tab', code: 'Tab' })
    } else if (key.toLowerCase() === 'escape') {
      await this.send('Input.dispatchKeyEvent', { type: 'keyDown', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27, key: 'Escape', code: 'Escape' })
      await this.send('Input.dispatchKeyEvent', { type: 'keyUp', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27, key: 'Escape', code: 'Escape' })
    } else {
      await this.send('Input.dispatchKeyEvent', { type: 'keyDown', text: key })
      await this.send('Input.dispatchKeyEvent', { type: 'keyUp', text: key })
    }
  }

  async typeElement(opts: { selector?: string; text: string; clear?: boolean; pressEnter?: boolean }): Promise<string> {
    if (opts.selector) {
      const script = `(() => {
        const el = document.querySelector(${JSON.stringify(opts.selector)});
        if (!el) return { error: 'Element not found for selector: ' + ${JSON.stringify(opts.selector)} };
        try { el.scrollIntoView({ behavior: 'instant', block: 'center' }); } catch {}
        try { el.focus(); } catch {}
        if (${opts.clear ? 'true' : 'false'}) {
          if ('value' in el) el.value = '';
          else el.textContent = '';
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }
        const rect = el.getBoundingClientRect();
        return {
          x: Math.round(rect.left + rect.width / 2),
          y: Math.round(rect.top + rect.height / 2),
          tag: el.tagName.toLowerCase(),
        };
      })()`

      const res = await this.evaluate(script) as { error?: string; x: number; y: number; tag: string }
      if (res.error) throw new Error(res.error)
      if (typeof res.x === 'number' && typeof res.y === 'number') {
        await this.click(res.x, res.y)
      }
    }

    await this.type(opts.text)

    if (opts.pressEnter) {
      await this.pressKey('Enter')
    }

    return `Typed "${opts.text}" into ${opts.selector ? opts.selector : 'focused element'}${opts.pressEnter ? ' and pressed Enter' : ''}.`
  }

  async getPageContent(format: 'interactive' | 'text' | 'html' = 'interactive'): Promise<string> {
    if (format === 'html') {
      const html = await this.evaluate('document.documentElement.outerHTML') as string
      return (html || '').slice(0, 15000)
    }

    if (format === 'text') {
      const text = await this.evaluate('document.body.innerText') as string
      return (text || '').slice(0, 10000)
    }

    // Default 'interactive': extract title, URL, inputs, buttons, key links, and headings
    const script = `(() => {
      const title = document.title || 'Untitled';
      const url = window.location.href;

      // Inputs
      const inputs = Array.from(document.querySelectorAll('input:not([type="hidden"]), textarea, select')).slice(0, 20).map((el, i) => {
        const tag = el.tagName.toLowerCase();
        const type = el.getAttribute('type') || (tag === 'textarea' ? 'textarea' : 'text');
        const name = el.getAttribute('name') || '';
        const id = el.id ? '#' + el.id : '';
        const placeholder = el.getAttribute('placeholder') || '';
        const val = ('value' in el && el.value) ? el.value.slice(0, 30) : '';
        const selector = id || (name ? tag + '[name="' + name + '"]' : tag + ':nth-of-type(' + (i + 1) + ')');
        return '- ' + tag.toUpperCase() + ' [' + type + '] ' + (placeholder ? 'placeholder="' + placeholder + '" ' : '') + (name ? 'name="' + name + '" ' : '') + (val ? 'value="' + val + '" ' : '') + '-> selector: \`' + selector + '\`';
      });

      // Buttons
      const buttons = Array.from(document.querySelectorAll('button, input[type="submit"], input[type="button"], [role="button"]')).slice(0, 25).map((el, i) => {
        const text = (el.innerText || el.value || el.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 40);
        const id = el.id ? '#' + el.id : '';
        const name = el.getAttribute('name') ? '[name="' + el.getAttribute('name') + '"]' : '';
        const selector = id || name || (text ? 'button:has-text("' + text + '")' : 'button:nth-of-type(' + (i + 1) + ')');
        return '- Button "' + (text || 'Button') + '" -> selector: \`' + selector + '\`';
      });

      // Links (first 25 with meaningful text)
      const links = Array.from(document.querySelectorAll('a[href]'))
        .map(a => ({
          text: (a.innerText || a.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 50),
          href: a.getAttribute('href') || ''
        }))
        .filter(l => l.text.length > 1 && !l.href.startsWith('javascript:'))
        .slice(0, 25)
        .map(l => '- Link "' + l.text + '" (' + l.href.slice(0, 60) + ')');

      // Headings
      const headings = Array.from(document.querySelectorAll('h1, h2, h3')).slice(0, 15).map(h => {
        const level = h.tagName.toLowerCase();
        const prefix = level === 'h1' ? '# ' : level === 'h2' ? '## ' : '### ';
        return prefix + (h.innerText || h.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 80);
      });

      let md = '# ' + title + '\\nURL: ' + url + '\\n\\n';
      if (inputs.length) md += '### Form Inputs:\\n' + inputs.join('\\n') + '\\n\\n';
      if (buttons.length) md += '### Buttons & Controls:\\n' + buttons.join('\\n') + '\\n\\n';
      if (headings.length) md += '### Headings:\\n' + headings.join('\\n') + '\\n\\n';
      if (links.length) md += '### Links:\\n' + links.join('\\n') + '\\n\\n';

      return md;
    })()`

    const content = await this.evaluate(script) as string
    return content || 'No content extracted.'
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

  async printToPdf(options: {
    landscape?: boolean | undefined
    printBackground?: boolean | undefined
    scale?: number | undefined
    pageRanges?: string | undefined
    paperWidth?: number | undefined
    paperHeight?: number | undefined
  } = {}): Promise<string> {
    const params: Record<string, unknown> = {
      printBackground: options.printBackground ?? true,
      landscape: options.landscape ?? false,
      scale: options.scale ?? 1,
    }
    if (options.pageRanges) params.pageRanges = options.pageRanges
    if (options.paperWidth) params.paperWidth = options.paperWidth
    if (options.paperHeight) params.paperHeight = options.paperHeight

    const result = await this.send<{ data: string }>('Page.printToPDF', params)
    return result.data
  }

  async setDownloadPath(downloadPath: string): Promise<void> {
    try {
      await this.send('Browser.setDownloadBehavior', {
        behavior: 'allowAndName',
        downloadPath,
        eventsEnabled: true,
      })
    } catch {
      try {
        await this.send('Page.setDownloadBehavior', {
          behavior: 'allow',
          downloadPath,
        })
      } catch {}
    }
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
