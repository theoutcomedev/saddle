/** `modes` namespace dictionaries (the workspace-mode picker, the chip, and every mode's copy). */
import type { WorkspaceModeId } from '@deepseek-ai/dsh-workspace-modes/client'

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'modes.row': '模式',
  'modes.title': '工作区模式',
  'modes.description': '模式决定屏幕把什么放在中间、面板占多少、留下多少留白。切换不会丢掉草稿、滚动位置，或任何还在运行的任务。',
  'modes.active': '当前',
  'modes.exit': '退出{name}',
  'modes.close': '关闭',
  'mode.standard.name': '标准模式',
  'mode.standard.description': '应用最初的形状：会话列表打开，详情列收起。',
  'mode.focus.name': '专注',
  'mode.focus.description': '收起会话列表，把详情列放宽到对话旁边：一份文档，一个面板。',
  'mode.zen.name': '禅写',
  'mode.zen.description': '两侧面板收起，对话收成一栏适合阅读的宽度。只剩写和读。',
} satisfies Record<string, string>

/** The modes namespace key union. */
export type ModesKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'modes.row': 'Modes',
  'modes.title': 'Workspace modes',
  'modes.description': 'A mode decides what the screen centres, how much room a panel gets, and how much air is left over. Switching keeps your draft, your scroll position, and anything still running.',
  'modes.active': 'Active',
  'modes.exit': 'Leave {name}',
  'modes.close': 'Close',
  'mode.standard.name': 'Standard',
  'mode.standard.description': "The shell's own default shape: session list open, details column closed.",
  'mode.focus.name': 'Focus',
  'mode.focus.description': 'Session list out; the details column opened wide beside the conversation. One document, one pane.',
  'mode.zen.name': 'Zen Writer',
  'mode.zen.description': 'Both panels out and the conversation held to a reading measure. Writing and reading only.',
} satisfies Record<ModesKey, string>

/**
 * Locale key naming a mode.
 * @param mode - the mode to name.
 * @returns the key carrying that mode's display name.
 */
export function modeNameKey(mode: WorkspaceModeId): ModesKey {
  return `mode.${mode}.name`
}

/**
 * Locale key describing a mode.
 * @param mode - the mode to describe.
 * @returns the key carrying that mode's one-sentence description.
 */
export function modeDescriptionKey(mode: WorkspaceModeId): ModesKey {
  return `mode.${mode}.description`
}
