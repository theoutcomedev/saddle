import { useState } from 'react'
import css from './LoginScreen.module.css'

export function LoginScreen({ onLoginSuccess }: { onLoginSuccess: () => void }) {
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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
        <div className={css.logo}>Saddle OS</div>
        <div className={css.subtitle}>AI Operating System</div>

        <div className={css.inputGroup}>
          <label className={css.label}>Admin Password</label>
          <input
            type="password"
            className={css.input}
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoFocus
            required
          />
        </div>

        {error && <div className={css.error}>{error}</div>}

        <button type="submit" className={css.button} disabled={loading}>
          {loading ? 'Logging in...' : 'Log In'}
        </button>
      </form>
    </div>
  )
}
