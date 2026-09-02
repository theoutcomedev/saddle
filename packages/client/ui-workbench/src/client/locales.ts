/** `workbench` namespace dictionaries. */

/** Dictionary namespace owned by this plugin. */
export const NS = 'workbench'

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'workbench.tabs.close': '关闭',
  'workbench.add': '添加',
  'workbench.addMenu': '添加面板',
  'workbench.pane.details': '详情',
  'workbench.pane.jobs': '后台任务',
  'workbench.pane.browser': '浏览器',
  'workbench.pane.files': '文件',
  'workbench.empty': '没有可添加的面板。',
  'workbench.fullscreen': '全屏',
  'workbench.exitFullscreen': '退出全屏',
  'workbench.browser.url': '地址',
  'workbench.browser.go': '前往',
  'workbench.browser.blank': '请输入地址。',
  'workbench.browser.open': '在浏览器中打开',
} as const

/** English dictionary, key-identical to the Chinese source of truth. */
export const en: Record<WorkbenchKey, string> = {
  'workbench.tabs.close': 'Close',
  'workbench.add': 'Add',
  'workbench.addMenu': 'Add pane',
  'workbench.pane.details': 'Details',
  'workbench.pane.jobs': 'Jobs',
  'workbench.pane.browser': 'Browser',
  'workbench.pane.files': 'Files',
  'workbench.empty': 'No panes to add.',
  'workbench.fullscreen': 'Fullscreen',
  'workbench.exitFullscreen': 'Exit fullscreen',
  'workbench.browser.url': 'URL',
  'workbench.browser.go': 'Go',
  'workbench.browser.blank': 'Enter a URL.',
  'workbench.browser.open': 'Open in browser',
}

/** Key domain of the `workbench` namespace (zh is the source of truth). */
export type WorkbenchKey = keyof typeof zh
