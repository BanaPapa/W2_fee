import type { ReactNode } from 'react'
import { useAuthStore } from '../../store/authStore'
import { signOutUser } from '../../lib/firebaseAuth'
import LoginScreen from './LoginScreen'

function Centered({ children }: { children: ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 20, background: 'var(--bg)' }}>
      {children}
    </div>
  )
}

function Spinner({ label }: { label: string }) {
  return (
    <Centered>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
        <div className="auth-spinner" />
        <div style={{ fontSize: 14.5, color: 'var(--muted)', fontWeight: 600 }}>{label}</div>
      </div>
    </Centered>
  )
}

export default function AuthGate({ children }: { children: ReactNode }) {
  const status = useAuthStore((s) => s.status)
  const dataReady = useAuthStore((s) => s.dataReady)
  const email = useAuthStore((s) => s.email)

  if (status === 'loading') return <Spinner label="불러오는 중..." />
  if (status === 'signedOut') return <LoginScreen />

  if (status === 'noRole') {
    return (
      <Centered>
        <div className="modal-card" style={{ width: 'min(400px, 92vw)', padding: 28, textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🔒</div>
          <h1 style={{ margin: '0 0 8px', fontSize: 19, fontWeight: 800, color: 'var(--fg)' }}>승인 대기 중</h1>
          <p style={{ margin: '0 0 4px', fontSize: 14.5, color: 'var(--muted)', lineHeight: 1.5 }}>
            <b style={{ color: 'var(--fg)' }}>{email}</b> 계정으로 로그인했습니다.
          </p>
          <p style={{ margin: '0 0 22px', fontSize: 14.5, color: 'var(--muted)', lineHeight: 1.5 }}>
            관리자가 권한을 부여하면 이용할 수 있습니다.
          </p>
          <button
            onClick={() => signOutUser()}
            style={{ background: 'var(--surface-2)', color: 'var(--fg)', border: '1px solid var(--border)', borderRadius: 10, height: 40, padding: '0 20px', fontWeight: 700, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            로그아웃
          </button>
        </div>
      </Centered>
    )
  }

  // status === 'ready'
  if (!dataReady) return <Spinner label="데이터 불러오는 중..." />
  return <>{children}</>
}
