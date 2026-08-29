/**
 * The model-facing `request_credential` tool: the chat half of connecting an
 * external service. It registers the generic api-key flow for a service on
 * demand, then runs it through the authorization seam, whose `secret` prompt
 * reaches the human as a masked question (kept out of logs and screenshots)
 * and whose commit lands the key in the encrypted credential store.
 * @module @deepseek-ai/dsh-connections/tool
 */

import type { Context } from '@deepseek-ai/cordis'
import type { AuthorizationInteraction, AuthorizationPrompt } from '@deepseek-ai/dsh-authorization'
import { isCredentialKeySegment } from '@deepseek-ai/dsh-credentials'
import type { AskUserQuestionItem } from '@deepseek-ai/dsh-user-questions'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { connectionKey, registerApiKeyConnection } from './index.ts'

/** Cordis plugin name. */
export const name = 'tool-request-credential'
/** Services the tool depends on to run a flow and surface its prompt. */
export const inject = ['tools', 'authorization', 'userQuestions', 'credentials']

/**
 * Restate one authorization prompt as a user-questions item. A `secret` prompt
 * becomes a masked free-text question; `text` and `select` carry their natural
 * presentation.
 * @param prompt - what the running flow asks.
 * @returns the question to put to the human.
 */
export function questionFor(prompt: AuthorizationPrompt): AskUserQuestionItem {  switch (prompt.kind) {
  case 'secret':
    return { id: 'credential', question: prompt.message, secret: true }
  case 'text':
    return { id: 'credential', question: prompt.message }
  case 'select':
    return {
      id: 'credential',
      question: prompt.message,
      options: prompt.options.map(option => ({
        label: option.label,
        ...option.description === undefined ? {} : { description: option.description },
      })),
    }
}
}

/**
 * The surface that renders one attempt's prompts. Notices are dropped: the
 * api-key flow emits none, and a flow that later needs one must surface it.
 * @param ctx - the plugin context carrying `ctx.userQuestions`.
 * @returns the interaction bound to this context.
 */
export function interactionFor(ctx: Context): AuthorizationInteraction {
  return {
    notify: () => {},
    prompt: async (prompt) => {
      const question = questionFor(prompt)
      const answer = await ctx.userQuestions.ask({ questions: [question] })
      const item = answer.answers.find(candidate => candidate.id === question.id)
      return item?.custom ?? item?.selected[0] ?? ''
    },
  }
}

/**
 * Register the `request_credential` tool.
 * @param ctx - the plugin context.
 */
export function apply(ctx: Context): void {
  ctx.tools.register(defineTool({
    name: 'request_credential',
    description: 'Connect an external service by capturing its API key through a masked prompt. '
      + 'The key is stored encrypted and is never echoed back.',
    parameters: {
      service: {
        type: 'string',
        required: true,
        description: 'Stable lowercase-hyphenated service id, e.g. "supabase" or "resend".',
      },
      label: {
        type: 'string',
        description: 'Human-facing service name shown in the prompt; defaults to the id.',
      },
      docs_url: {
        type: 'string',
        description: 'Provider API/docs link the user can open to create the key.',
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          status: { type: 'string', required: true, enum: ['authorized', 'cancelled'] },
        },
      },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
    },
    async execute(args, exec) {
      if (!isCredentialKeySegment(args.service)) {
        throw new TypeError(`service id "${args.service}" must be a lowercase hyphenated identifier`)
      }
      const connection = {
        id: args.service,
        label: args.label ?? args.service,
        ...args.docs_url === undefined ? {} : { docsUrl: args.docs_url },
      }
      const key = connectionKey(connection)
      if (ctx.authorization.describe(key) === undefined) {
        registerApiKeyConnection(ctx, connection)
      }
      const outcome = await ctx.authorization.begin({
        key,
        method: 'api-key',
        interaction: interactionFor(ctx),
        signal: exec.signal,
      })
      return { status: outcome.status }
    },
  }))
}
