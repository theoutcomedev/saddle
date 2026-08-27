/** Durable settings namespace for product-wide GUI onboarding facts. */
export const WELCOME_NOTICE_SETTINGS_NAMESPACE = 'ui-onboarding'

/** Field storing the last welcome notice version the user acknowledged. */
export const WELCOME_NOTICE_ACK_FIELD = 'welcomeNoticeVersion'

/**
 * Bump only when the notice changes materially and every user should see it
 * again. The acknowledgement is compared for exact equality.
 */
export const WELCOME_NOTICE_VERSION = '2026-08-26.1'

/** The complete editable internal-testing notice in both supported GUI locales. */
export const WELCOME_NOTICE_COPY = {
  zh: {
    title: 'Saddle OS 开发者预览版',
    body: '欢迎来到 Saddle OS。我们的多态 UI 引擎目前正处于高速迭代的开发者预览阶段。系统核心 API 和动态生成组件将在未来几个月内快速演进。\n\n我们期待与您一起打破软件边界，共同构建未来的智能交互体验。准备好掌控一切了吗？',
    continueLabel: '继续',
  },
  en: {
    title: 'Welcome to Saddle OS',
    body: 'Saddle OS is currently in Developer Preview. The Metamorphic UI Engine and core foundational APIs will continue to evolve rapidly as we build the future of dynamic software.\n\nWe look forward to breaking the boundaries of traditional interfaces with you. Get ready to ride on the cutting edge of autonomous application generation. Take the reins.',
    continueLabel: 'Continue',
  },
} as const
