/**
 * Model-facing metamorphic app mounting tool.
 * Enables the AI agent to synthesize and hot-mount live interactive React/HTML
 * applications executed inside an isolated Sandpack runtime.
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
  dependencies?: Record<string, string>
  template?: 'react-ts' | 'react' | 'vanilla'
}

export type MountAppOutput = {
  [key: string]: JsonValue
  appId: string
  title: string
  description: string
  target: 'workbench' | 'chat' | 'fullscreen'
  entryFile: string
  files: Record<string, string>
  dependencies: Record<string, string>
  template: 'react-ts' | 'react' | 'vanilla'
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
        + 'in `/App.tsx` styled with Tailwind CSS classes. For icons, use simple inline SVGs or lucide-react. For charts and visualizations, '
        + 'prefer rendering clean native SVG elements (<svg>, <path>, <rect>, <circle>, gradients, tooltips) directly in React rather than '
        + 'complex heavyweight charting packages, ensuring fast zero-latency rendering without dependency resolution issues.',
    })
  }

  ctx.tools.register(defineTool({
    name: 'mount_app',
    description:
      'Mount and render a live interactive metamorphic application (React/TypeScript/HTML) directly into the user interface. '
      + 'Use this when the user asks to build, create, or morph the UI into an interactive app (e.g. workout tracker, financial calculator, '
      + 'bookstore, game, data dashboard, interactive canvas, or form). The app will be compiled and executed live in the browser using an isolated Sandpack runtime. '
      + 'Always provide clean, complete, runnable code in /App.tsx with Tailwind CSS utility classes. Prefer native SVG elements for charts and graphs.',
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
        description: 'Map of virtual file paths to their full source code content. Must include at least /App.tsx (or /index.html).',
      },
      dependencies: {
        type: 'object',
        additionalProperties: true,
        description: 'Optional NPM dependencies (package name -> version, e.g. {"lucide-react": "^0.454.0", "recharts": "^2.13.0", "canvas-confetti": "^1.9.4"}).',
      },
      template: {
        type: 'string',
        enum: ['react-ts', 'react', 'vanilla'],
        description: 'Sandpack template environment. Defaults to "react-ts".',
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
          dependencies: { type: 'object', additionalProperties: true, required: true },
          template: { type: 'string', required: true },
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
      const template = args.template || 'react-ts'

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

      // Default dependencies to include lucide-react if none specified
      const dependencies: Record<string, string> = {
        'lucide-react': '^0.454.0',
      }
      if (args.dependencies) {
        for (const [pkg, ver] of Object.entries(args.dependencies)) {
          dependencies[pkg] = ver
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
        dependencies,
        template,
        fileCount: Object.keys(files).length,
        timestamp: Date.now(),
        ...(savedDir !== undefined ? { savedDir } : {}),
      }

      return output
    },
  }))
}
