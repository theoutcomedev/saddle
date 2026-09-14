/** `layouts` namespace dictionaries (the workspace-layout picker, the chip, and every layout's copy). */
import type { WorkspaceLayoutId } from '@deepseek-ai/dsh-workspace-modes/client'

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'layouts.row': '布局',
  'layouts.title': '工作区布局',
  'layouts.description': '布局决定屏幕把什么放在中间、面板占多少、留下多少留白。它改的是屏幕的形状，不是助手能做什么——那是会话的 preset。切换不会丢掉草稿、滚动位置，或任何还在运行的任务。',
  'layouts.active': '当前',
  'layouts.exit': '退出{name}',
  'layouts.close': '关闭',
  'layout.default.name': '默认',
  'layout.default.description': '应用最初的形状：会话列表打开，详情列收起。',
  'layout.focus.name': '专注',
  'layout.focus.description': '收起会话列表，把详情列放宽到对话旁边：一份文档，一个面板。',
  'layout.zen.name': '禅写',
  'layout.zen.description': '两侧面板收起，对话收成一栏适合阅读的宽度。只剩写和读。',
} satisfies Record<string, string>

/** The layouts namespace key union. */
export type LayoutsKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'layouts.row': 'Layout',
  'layouts.title': 'Workspace layout',
  'layouts.description': 'A layout decides what the screen centres, how much room a panel gets, and how much air is left over — the shape of the screen, not what the assistant can do (that is the session\'s preset). Switching keeps your draft, your scroll position, and anything still running.',
  'layouts.active': 'Active',
  'layouts.exit': 'Leave {name}',
  'layouts.close': 'Close',
  'layout.default.name': 'Default',
  'layout.default.description': 'The shell\'s own shape: session list open, details column closed.',
  'layout.focus.name': 'Focus',
  'layout.focus.description': 'Session list out; the details column opened wide beside the conversation. One document, one pane.',
  'layout.zen.name': 'Zen Writer',
  'layout.zen.description': 'Both panels out and the conversation held to a reading measure. Writing and reading only.',
} satisfies Record<LayoutsKey, string>

/**
 * Locale key naming a layout.
 * @param layout - the layout to name.
 * @returns the key carrying that layout's display name.
 */
export function layoutNameKey(layout: WorkspaceLayoutId): LayoutsKey {
  return `layout.${layout}.name`
}

/**
 * Locale key describing a layout.
 * @param layout - the layout to describe.
 * @returns the key carrying that layout's one-sentence description.
 */
export function layoutDescriptionKey(layout: WorkspaceLayoutId): LayoutsKey {
  return `layout.${layout}.description`
}
