/**
 * The Connections settings section: a curated service catalog with docs links
 * and connect guidance. Connection itself happens in chat through the
 * `request_credential` tool (masked prompt, encrypted store); this page is the
 * discovery surface.
 */
import type { InjectFace } from '@deepseek-ai/dsh-client-ui-slots'
import { SERVICES } from './catalog.ts'
import type { ConnectionsKey } from './locales.ts'

/** Props injected by the section registration. */
export interface ConnectionsSectionInjected {
  /** Bound locale translate for this namespace. */
  t: (key: ConnectionsKey) => string
}

/** Component-side view of the injected face. */
export type ConnectionsSectionProps = InjectFace<ConnectionsSectionInjected>

/**
 * Render the service catalog.
 * @param props - the injected translate.
 * @returns the catalog list.
 */
export function ConnectionsSection(props: ConnectionsSectionProps) {
  return (
    <div>
      <h2>{props.t('title')}</h2>
      <p>{props.t('hint')}</p>
      <ul>
        {SERVICES.map(service => (
          <li key={service.id}>
            <span>{service.label}</span>
            {' '}
            <a href={service.docsUrl} target="_blank" rel="noreferrer">{props.t('docs')}</a>
          </li>
        ))}
      </ul>
    </div>
  )
}
