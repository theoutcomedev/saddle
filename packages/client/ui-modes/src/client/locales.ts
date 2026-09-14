/** `layouts` namespace dictionaries (the workspace-layout picker, the chip, and every layout's copy). */
import type { WorkspaceLayoutId } from '@deepseek-ai/dsh-workspace-modes/client'

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'layouts.row': '布局',
  'layouts.title': '工作区布局',
  'layouts.description': '布局改变这个屏幕的形状：哪些面板在场、留多少白、输入框长什么样。它改的不是助手能做什么——那是会话的 preset。切换不会丢掉草稿、滚动位置，或任何还在运行的任务。',
  'layouts.active': '当前',
  'layouts.exit': '退出{name}',
  'layouts.close': '关闭',
  'layout.default.name': '默认',
  'layout.default.description': '会话列表在左，输入框在底，其余留白。',
  'layout.capture.name': '速记',
  'layout.capture.description': '输入框是主角，会话列表收成一页随时拉出。手机上的一手操作形状。',
  'layout.read.name': '阅读',
  'layout.read.description': '输入框收起，正文独占整屏，字号放宽。想回话时再点出来。',
  'layout.focus.name': '专注',
  'layout.focus.description': '收起会话列表，把详情面板放到正文旁边。一份文档，一个面板。',
  'layout.zen.name': '禅写',
  'layout.zen.description': '两侧面板全部收起，正文收成适合阅读的一栏。只剩写和读。',
  'layout.workbench.name': '工作台',
  'layout.workbench.description': '面板常驻在正文旁边，不用每次打开。',
  'layout.counter.name': '柜台',
  'layout.counter.description': '面向他人的形状：界面让给作品，输入框与导航收起，退出需要明确动作。',
  'layout.studio.name': '工作间',
  'layout.studio.description': '紧凑排版，面板放宽，对话退到一边。长时间制作时用。',
  'layout.wall.name': '展示墙',
  'layout.wall.description': '满屏展示，没有输入框，也没有导航。挂在墙上的屏幕。',
} satisfies Record<string, string>

/** The layouts namespace key union. */
export type LayoutsKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'layouts.row': 'Layout',
  'layouts.title': 'Workspace layout',
  'layouts.description': "A layout changes the shape of this screen: which surfaces are present, how much air is left, what the composer looks like. It is not what the assistant can do — that is the session's preset. Switching keeps your draft, your scroll position, and anything still running.",
  'layouts.active': 'Active',
  'layouts.exit': 'Leave {name}',
  'layouts.close': 'Close',
  'layout.default.name': 'Default',
  'layout.default.description': 'Session list on the left, composer at the bottom, the rest left open.',
  'layout.capture.name': 'Capture',
  'layout.capture.description': 'The composer leads and the session list becomes a page you pull in. The one-handed phone shape.',
  'layout.read.name': 'Read',
  'layout.read.description': 'The composer is out of the way and the writing takes the screen, in roomier type. Bring it back when you want to reply.',
  'layout.focus.name': 'Focus',
  'layout.focus.description': 'Session list out; the pane sits beside the document. One document, one pane.',
  'layout.zen.name': 'Zen Writer',
  'layout.zen.description': 'Both side surfaces out, the text held to a reading measure. Writing and reading only.',
  'layout.workbench.name': 'Workbench',
  'layout.workbench.description': 'The pane stays beside the work instead of being opened each time.',
  'layout.counter.name': 'Counter',
  'layout.counter.description': 'A shape for showing someone: the screen belongs to the work, navigation and composer are away, and leaving takes a deliberate move.',
  'layout.studio.name': 'Studio',
  'layout.studio.description': 'Dense chrome, the pane opened wide, the conversation off to the side. For long making sessions.',
  'layout.wall.name': 'Wall',
  'layout.wall.description': 'Edge to edge, no composer and no navigation. A screen nobody is sitting at.',
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
