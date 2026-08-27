import { Tooltip } from '@deepseek-ai/dsh-client-ui-primitives'
import css from './LogoutButton.module.css'
import clsx from 'clsx'

const LogoutIcon = ({ className }: { className?: string }) => (
  <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
    <polyline points="16 17 21 12 16 7"></polyline>
    <line x1="21" y1="12" x2="9" y2="12"></line>
  </svg>
)

export function LogoutButton({ wide }: { wide: boolean }) {
  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.reload()
  }

  const btn = (
    <button
      type="button"
      className={clsx(css.button, !wide && css.collapsed)}
      onClick={handleLogout}
      aria-label="Logout"
    >
      <div className={css.iconContainer}>
        <LogoutIcon className={css.icon} />
      </div>
      {wide && <span className={css.label}>Logout</span>}
    </button>
  )

  if (wide) return btn
  return <Tooltip content="Logout" placement="right">{btn}</Tooltip>
}
