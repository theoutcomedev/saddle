/**
 * Model-facing metamorphic app mounting tool: the agent synthesizes an
 * interactive app and this mounts it into the user's UI, where the client
 * renders it inside a sandboxed iframe.
 *
 * The canvas it feeds is closed on purpose — React with its hooks, lucide
 * icons, and Tailwind, compiled from one entry module — so the schema here
 * names exactly that and nothing more. A self-contained `/index.html` is the
 * escape hatch for everything else.
 * @module @deepseek-ai/dsh-tool-mount-app
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { JsonValue } from '@deepseek-ai/dsh-session'

import type {} from '@deepseek-ai/dsh-system-prompt'

export const name = 'tool-mount-app'
export const inject = ['tools']

export interface MountAppArgs {
  title: string
  description?: string
  target?: 'workbench' | 'chat' | 'fullscreen'
  entryFile?: string
  files: Record<string, string>
}

export type MountAppOutput = {
  [key: string]: JsonValue
  appId: string
  title: string
  description: string
  target: 'workbench' | 'chat' | 'fullscreen'
  entryFile: string
  files: Record<string, string>
  fileCount: number
  timestamp: number
  savedDir?: string
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '') || 'app'
}

export function apply(ctx: Context) {
  const sp = ctx.get('systemPrompt') as { section?: (s: { name: string; order: number; text: string }) => void } | undefined
  if (sp && typeof sp.section === 'function') {
    sp.section({
      name: 'saddle:metamorphic-apps',
      order: 195,
      text: 'When a user asks you to build, create, or morph the UI into an interactive tool, application, or dashboard '
        + '(e.g. workout tracker, financial calculator, runway simulator, bookstore, game, data visualizer, canvas, or form), '
        + 'use the `mount_app` tool to compile and render it live. Provide complete, clean, self-contained runnable React code '
        + 'in `/App.tsx` styled with Tailwind CSS classes. The canvas provides React 18, its hooks, lucide icons and Tailwind and nothing else: '
        + 'it resolves no npm packages, so keep the whole app in that one file, or ship a self-contained `/index.html` instead. For icons, use '
        + 'lucide-react or inline SVG. For charts, render native SVG elements (<svg>, <path>, <rect>, <circle>, gradients, tooltips) directly in React.',
    })
  }

  ctx.tools.register(defineTool({
    name: 'mount_app',
    description:
      'Mount and render a live interactive application (React/TypeScript, or HTML) directly into the user interface. '
      + 'Use this when the user asks to build, create, or morph the UI into an interactive app (e.g. workout tracker, financial calculator, '
      + 'bookstore, game, data dashboard, interactive canvas, or form). The app is compiled and executed live in the browser inside a sandboxed iframe. '
      + 'Provide clean, complete, runnable code in /App.tsx with Tailwind CSS utility classes. The canvas serves React 18, its hooks, lucide icons and '
      + 'Tailwind: it loads no npm package and one entry module, so do not split the app across files or reach for a charting library — render native '
      + 'SVG instead. For anything the React path cannot express, pass a self-contained /index.html, which becomes the document itself.',
    parameters: {
      title: {
        type: 'string',
        required: true,
        description: 'Descriptive title of the application (e.g. "Marathon Training Tracker", "Interactive Sci-Fi Bookstore").',
      },
      description: {
        type: 'string',
        description: 'Short explanation of what the app does and how the user can interact with it.',
      },
      target: {
        type: 'string',
        enum: ['workbench', 'chat', 'fullscreen'],
        description: 'Where to focus presentation: "workbench" (docked pane alongside Files/Browser), "chat" (inline card), or "fullscreen". Defaults to "workbench".',
      },
      entryFile: {
        type: 'string',
        description: 'Path to the primary React component entrypoint. Defaults to "/App.tsx".',
      },
      files: {
        type: 'object',
        additionalProperties: true,
        required: true,
        description: 'Map of virtual file paths to their full source code content. Include /App.tsx (the entry: a default export or an App component). '
          + 'Extra files are saved and shown in the app\'s Code view but are not importable, so keep the app in one file; /index.html is rendered as a complete '
          + 'standalone document instead, which is the way to ship anything the React canvas cannot express.',
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: true,
        properties: {
          appId: { type: 'string', required: true },
          title: { type: 'string', required: true },
          description: { type: 'string', required: true },
          target: { type: 'string', required: true },
          entryFile: { type: 'string', required: true },
          files: { type: 'object', additionalProperties: true, required: true },
          fileCount: { type: 'integer', required: true },
          timestamp: { type: 'number', required: true },
          savedDir: { type: 'string' },
        },
      },
      render: (_args, value) => [{
        type: 'text',
        text: `✨ Successfully mounted metamorphic app "${value.title}" (${value.fileCount} files) into ${value.target}. The interactive live app is running now.`,
      }],
      presentationMeta: (_args, value) => value as unknown as JsonValue,
    },
    async execute(rawArgs, exec) {
      const args = rawArgs as unknown as MountAppArgs
      const rawTitle = args.title || 'Untitled App'
      const title = rawTitle.trim()
      const slug = slugify(title)
      const appId = `app-${slug}-${Date.now()}`
      const target = args.target || 'workbench'
      const entryFile = typeof args.entryFile === 'string' && args.entryFile ? args.entryFile : '/App.tsx'

      // Normalize virtual files: guarantee keys start with '/'
      const files: Record<string, string> = {}
      for (const [rawKey, content] of Object.entries(args.files)) {
        const key = rawKey.startsWith('/') ? rawKey : `/${rawKey}`
        files[key] = content
      }

      // If /App.tsx is missing in react template, provide a sensible fallback if /App.jsx or /index.tsx exists
      if (!files['/App.tsx'] && !files['/App.jsx'] && !files['/index.html'] && !files['/App.js']) {
        const first = Object.keys(files)[0]
        const firstContent = first !== undefined ? files[first] : undefined
        if (firstContent !== undefined) {
          files['/App.tsx'] = firstContent
        }
      }

      // If the session has a cwd workspace, persist the app files to disk under .saddle/apps/<slug>/
      let savedDir: string | undefined
      try {
        const sessionCwd = exec.agent?.session.header.cwd
        if (sessionCwd) {
          savedDir = path.join(sessionCwd, '.saddle', 'apps', slug)
          await fs.mkdir(savedDir, { recursive: true })
          for (const [filePath, content] of Object.entries(files)) {
            const relPath = filePath.replace(/^\/+/, '')
            const targetPath = path.join(savedDir, relPath)
            await fs.mkdir(path.dirname(targetPath), { recursive: true })
            await fs.writeFile(targetPath, content, 'utf8')
          }
        }
      } catch {
        // Disk persistence is best-effort; virtual sandbox execution remains unaffected
      }

      const output: MountAppOutput = {
        appId,
        title,
        description: typeof args.description === 'string' ? args.description : `Interactive ${title} application`,
        target,
        entryFile,
        files,
        fileCount: Object.keys(files).length,
        timestamp: Date.now(),
        ...(savedDir !== undefined ? { savedDir } : {}),
      }

      return output
    },
  }))
}
