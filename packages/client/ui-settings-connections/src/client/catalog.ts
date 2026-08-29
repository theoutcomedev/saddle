/** The curated service catalog: what the Connections page offers to connect. */
export interface ServiceEntry {
  /** Stable lowercase-hyphenated id, matching the credential-key grammar. */
  id: string
  /** Human-facing name. */
  label: string
  /** Provider API/docs link shown beside the service. */
  docsUrl: string
}

/** Services offered for connection, in display order. */
export const SERVICES: readonly ServiceEntry[] = [
  { id: 'supabase', label: 'Supabase', docsUrl: 'https://supabase.com/docs' },
  { id: 'resend', label: 'Resend', docsUrl: 'https://resend.com/docs' },
  { id: 'openphone', label: 'OpenPhone', docsUrl: 'https://www.openphone.com/api' },
  { id: 'neon', label: 'Neon', docsUrl: 'https://neon.tech/docs' },
  { id: 'github', label: 'GitHub', docsUrl: 'https://docs.github.com/en/rest' },
]
