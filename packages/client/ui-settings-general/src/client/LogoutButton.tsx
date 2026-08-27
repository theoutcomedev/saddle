import css from './SettingsRoot.module.css'
import clsx from 'clsx'

const LogoutIcon = ({ className }: { className?: string | undefined }) => (
  <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
    <polyline points="16 17 21 12 16 7"></polyline>
    <line x1="21" y1="12" x2="9" y2="12"></line>
  </svg>
)

export function LogoutButton() {
  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.reload()
  }

  return (
    <button
      type="button"
      className={clsx(css.navCell, css.logoutBtn)}
      onClick={handleLogout}
      style={{ marginTop: 'auto', color: 'var(--dsw-alias-state-error-primary, #ef4444)' }}
    >
      <LogoutIcon className={css.navIcon} />
      <span className={css.navLabel}>Logout</span>
    </button>
  )
}
