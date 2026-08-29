/** Copy dictionaries for the Connections settings section. */
export const en = {
  nav: 'Connections',
  title: 'Connected services',
  hint: 'Ask the agent in chat to connect a service (for example "connect Supabase"); the key is entered through a masked prompt and stored encrypted.',
  docs: 'Docs',
} as const

export const zh = {
  nav: '连接',
  title: '已连接的服务',
  hint: '在聊天中让 Agent 连接某个服务（例如“连接 Supabase”）；密钥通过掩码提示输入并加密存储。',
  docs: '文档',
} as const

/** Locale key union for this namespace. */
export type ConnectionsKey = keyof typeof en
