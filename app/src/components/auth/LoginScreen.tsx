import { useState } from 'react'
import { signInEmail, signUpEmail, signInGoogle, authErrorMessage } from '../../lib/firebaseAuth'

type Mode = 'signin' | 'signup'

const btnPrimary: React.CSSProperties = {
  background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 10,
  height: 44, fontWeight: 700, fontSize: 16, cursor: 'pointer', fontFamily: 'inherit',
}

export default function LoginScreen() {
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      if (mode === 'signin') await signInEmail(email.trim(), pw)
      else await signUpEmail(email.trim(), pw)
      // 성공 시 authStore 구독이 화면을 전환한다
    } catch (err) {
      setError(authErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const google = async () => {
    setError(null)
    setBusy(true)
    try {
      await signInGoogle()
    } catch (err) {
      setError(authErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 20, background: 'var(--bg)' }}>
      <div className="modal-card" style={{ width: 'min(380px, 92vw)', padding: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <div style={{ width: 30, height: 30, borderRadius: 9, background: 'linear-gradient(135deg,#7c5cff,#2dd4bf)' }} />
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: 'var(--fg)' }}>Easy Commission</h1>
        </div>
        <p style={{ margin: '0 0 20px', fontSize: 14, color: 'var(--muted)' }}>
          {mode === 'signin' ? '로그인하여 계속합니다.' : '새 계정을 만듭니다.'}
        </p>

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input
            className="field-input" type="email" placeholder="이메일" autoComplete="email"
            value={email} onChange={(e) => setEmail(e.target.value)} required
          />
          <input
            className="field-input" type="password" placeholder="비밀번호"
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            value={pw} onChange={(e) => setPw(e.target.value)} required
          />
          {error && <div style={{ fontSize: 13.5, color: '#ef4444', fontWeight: 600 }}>{error}</div>}
          <button type="submit" disabled={busy} style={{ ...btnPrimary, opacity: busy ? 0.6 : 1, marginTop: 4 }}>
            {busy ? '처리 중...' : mode === 'signin' ? '로그인' : '회원가입'}
          </button>
        </form>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '16px 0' }}>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>또는</span>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        </div>

        <button
          onClick={google} disabled={busy}
          style={{
            width: '100%', height: 44, borderRadius: 10, border: '1px solid var(--border)',
            background: 'var(--surface-2)', color: 'var(--fg)', fontWeight: 700, fontSize: 15,
            cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            opacity: busy ? 0.6 : 1,
          }}
        >
          <GoogleG /> Google로 계속하기
        </button>

        <button
          onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null) }}
          style={{ marginTop: 18, background: 'none', border: 'none', color: 'var(--accent)', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', width: '100%' }}
        >
          {mode === 'signin' ? '계정이 없으신가요? 회원가입' : '이미 계정이 있으신가요? 로그인'}
        </button>
      </div>
    </div>
  )
}

function GoogleG() {
  return (
    <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.5 30.1 0 24 0 14.6 0 6.4 5.4 2.5 13.3l7.8 6.1C12.2 13.2 17.6 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.1 5.3-4.6 6.9l7.1 5.5c4.1-3.8 6.5-9.4 6.5-16.9z" />
      <path fill="#FBBC05" d="M10.3 28.4c-.5-1.4-.7-2.9-.7-4.4s.3-3 .7-4.4l-7.8-6.1C1 16.5 0 20.1 0 24s1 7.5 2.5 10.5l7.8-6.1z" />
      <path fill="#34A853" d="M24 48c6.1 0 11.3-2 15-5.5l-7.1-5.5c-2 1.3-4.6 2.1-7.9 2.1-6.4 0-11.8-3.7-13.7-9.1l-7.8 6.1C6.4 42.6 14.6 48 24 48z" />
    </svg>
  )
}
