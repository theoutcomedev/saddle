export const ICONS = {
  UI: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>',
  LLM: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>',
  Tool: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>',
  Subagent: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>',
  API: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>',
  Sandbox: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>',
  Host: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect><rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect><line x1="6" y1="6" x2="6.01" y2="6"></line><line x1="6" y1="18" x2="6.01" y2="18"></line></svg>',
  Workflow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>',
  Database: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path></svg>',
}

import type { PluginInventoryEntry } from '@deepseek-ai/dsh-host-plugin-inventory/types'

export type RichPluginEntry = PluginInventoryEntry & {
  categories?: string[]
  tags?: string[]
  icon?: string
  developer?: string
}

export function injectMetadata(raw: PluginInventoryEntry): RichPluginEntry {
  const entry = raw as RichPluginEntry
  const name = entry.moduleName || ''

  if (entry.categories && entry.categories.length > 0) return entry // Already has seeded metadata

  let category = 'Core Plugins'
  let tags = ['core']
  let icon = ICONS.Host

  if (name.includes('ui-') || name.includes('client-')) {
    category = 'UI Components'
    tags = ['ui', 'frontend', 'react']
    icon = ICONS.UI
  } else if (name.includes('llm-') || name.includes('token-')) {
    category = 'LLM Providers'
    tags = ['llm', 'ai', 'inference', 'model']
    icon = ICONS.LLM
  } else if (name.includes('tool-')) {
    category = 'Agent Tools'
    tags = ['tool', 'agent', 'capability']
    icon = ICONS.Tool
  } else if (name.includes('subagent-')) {
    category = 'Subagents'
    tags = ['agent', 'delegation', 'ai']
    icon = ICONS.Subagent
  } else if (name.includes('api-') || name.includes('connection')) {
    category = 'APIs & Remotes'
    tags = ['api', 'remote', 'protocol']
    icon = ICONS.API
  } else if (name.includes('sandbox-') || name.includes('subprocess-')) {
    category = 'Sandboxing'
    tags = ['security', 'sandbox', 'execution']
    icon = ICONS.Sandbox
  } else if (name.includes('workflow-') || name.includes('session-')) {
    category = 'Workflows'
    tags = ['workflow', 'automation', 'state']
    icon = ICONS.Workflow
  } else if (name.includes('storage') || name.includes('persistence')) {
    category = 'Databases & Storage'
    tags = ['database', 'storage', 'persistence']
    icon = ICONS.Database
  } else if (name.includes('host-')) {
    category = 'Host Infrastructure'
    tags = ['backend', 'core', 'host']
    icon = ICONS.Host
  }

  return {
    ...entry,
    developer: entry.developer || 'DeepSeek Harness',
    categories: [category],
    tags: tags,
    icon: icon,
  }
}
