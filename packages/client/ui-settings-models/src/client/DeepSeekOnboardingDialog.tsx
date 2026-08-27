/**
 * Official-DeepSeek first-run step. Readiness comes from the same
 * provider/settings/credential join as the Models page: any provider the user
 * can already talk to ends the step, and only a user with none is offered the
 * official DeepSeek route. The step reuses that page's credential editor in
 * the onboarding plugin's shared modal, so the key is entered once.
 */

import { useEffect } from 'react'
import type { ReactNode } from 'react'
import type { IApiClient } from '@deepseek-ai/dsh-api-remotes/client'
import type { SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import type { InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { ModelsSettingsState, ModelsSettingsStore, ProviderRow } from './store.ts'
import { onboardingReadiness } from './store.ts'
import type { SettingsSchemaOperations } from './schema-operations.ts'
import { ProviderEditor } from './ProviderEditor.tsx'
import type { en } from './locales.ts'
import { OnboardingModal } from './OnboardingModal.tsx'
import styles from './DeepSeekOnboardingDialog.module.css'

/** Registration-side dependencies of {@link DeepSeekOnboardingDialog}. */
export interface DeepSeekOnboardingInjected {
  hooks: {
    /** Shared Models-page join state, bound by the slot renderer. */
    models: SnapshotStore<ModelsSettingsState>
  }
  /** Shared Models-page join controller. */
  controller: ModelsSettingsStore
  /** Existing wire face reused by the Models credential editor. */
  api: Pick<IApiClient, 'settings' | 'credentials' | 'llm'>
  /** Settings schema and immutable path callbacks. */
  schema: SettingsSchemaOperations
  /** Feature copy. */
  t: (key: keyof typeof en) => string
}

/** Slot owner props plus the feature's injected dependencies. */
export type DeepSeekOnboardingDialogProps =
  PropsRuntime<'settings.onboarding'> & InjectFace<DeepSeekOnboardingInjected>

/* v8 ignore next 3 -- closed-union defaults only defend future source widening */
function assertNever(_value: never): never {
  throw new Error('unexpected DeepSeek onboarding state')
}

/**
 * Prompt a first-run user for the official DeepSeek credential while no
 * provider can serve requests and that credential is writable.
 * @param props - settings-shell owner state and Models feature dependencies.
 * @returns the onboarding modal or null when onboarding needs no intervention.
 */
export function DeepSeekOnboardingDialog(props: DeepSeekOnboardingDialogProps): ReactNode {
  const { complete, controller, useModels, api, schema, t } = props
  const state = useModels(snapshot => snapshot)
  const readiness = onboardingReadiness(state)

  useEffect(() => {
    if (state.status === 'idle') void controller.load()
  }, [controller, state.status])

  useEffect(() => {
    if (
      readiness.kind === 'adapter-absent'
      || readiness.kind === 'provider-ready'
      || readiness.kind === 'unavailable'
    ) complete()
  }, [complete, readiness.kind])

  switch (readiness.kind) {
    case 'loading':
    case 'adapter-absent':
    case 'provider-ready':
    case 'unavailable':
      return null
    case 'credential-missing':
      break
    /* v8 ignore next -- every current readiness variant is handled above */
    default:
      return assertNever(readiness)
  }

  const targetProviders = ['deepseek-official', 'openai', 'anthropic']
  const rows = targetProviders
    .map(p => state.rows.find(candidate => candidate.entry.provider === p))
    .filter((row): row is ProviderRow => row !== undefined)

  if (rows.length === 0) return null

  const finishCredential = (changed: boolean): void => {
    if (!changed) {
      complete()
      return
    }
    void controller.load()
  }

  return (
    <OnboardingModal title={t('onboardingTitle')}>
      <p className={styles.description}>{t('onboardingDescription')}</p>
      {rows.map((row, index) => {
        const namespace = state.namespaces.get(row.entry.settingsNs)
        if (!namespace) return null
        return (
          <div key={row.entry.provider} className={styles.editor} style={{ marginBottom: index !== rows.length - 1 ? '16px' : '0', paddingBottom: index !== rows.length - 1 ? '16px' : '0', borderBottom: index !== rows.length - 1 ? '1px solid var(--border-soft)' : 'none' }}>
            <div style={{ marginBottom: '8px', fontWeight: 600, color: 'var(--text-primary)' }}>{row.entry.displayName}</div>
            <ProviderEditor
              provider={row.entry.provider}
              displayName={row.entry.displayName}
              namespace={namespace}
              schema={schema}
              settingsPath={row.entry.settingsPath}
              api={api}
              t={t}
              readOnly={false}
              hideTitle
              credentialOnly
              credentialRequired
              autoFocusCredential={index === 0}
              cancelLabel="onboardingLater"
              submitLabel="onboardingSave"
              submitBusyLabel="onboardingSaving"
              onClose={finishCredential}
            />
          </div>
        )
      })}
    </OnboardingModal>
  )
}
