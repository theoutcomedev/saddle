import { useState, useEffect } from 'react'
import { SaddleLogo } from '@deepseek-ai/dsh-client-ui-primitives'
import css from './LoginScreen.module.css'

export function LoginScreen({ onLoginSuccess }: { onLoginSuccess: () => void }) {
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    document.body.classList.add('dark-theme')
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (res.ok) {
        onLoginSuccess()
      } else {
        setError('Invalid password')
      }
    } catch (_err) {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={css.root}>
      <form className={css.card} onSubmit={handleLogin}>
        <div className={css.logoContainer}>
          <SaddleLogo size={32} className={css.logoIcon} />
        </div>
        <div className={css.title}>Saddle OS</div>
        <div className={css.subtitle}>AI Operating System</div>

        <div className={css.inputGroup}>
          <input
            type="password"
            className={css.input}
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Enter Admin Password"
            autoFocus
            required
          />
        </div>

        {error && <div className={css.error}>{error}</div>}

        <button type="submit" className={css.button} disabled={loading}>
          {loading ? 'Authenticating...' : 'Secure Login'}
        </button>
      </form>
    </div>
  )
}
