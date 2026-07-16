import { useAuthStore } from '../../store/authStore'
import { signOutUser, type Role } from '../../lib/firebaseAuth'

const ROLE_LABEL: Record<Role, string> = { admin: '관리자', editor: '편집자', viewer: '열람자' }
const ROLE_COLOR: Record<Role, string> = { admin: '#7c5cff', editor: '#2dd4bf', viewer: 'var(--muted)' }

export default function AccountPanel() {
  const email = useAuthStore((s) => s.email)
  const displayName = useAuthStore((s) => s.displayName)
  const role = useAuthStore((s) => s.role)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 420 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 12.5, color: 'var(--muted)', fontWeight: 600 }}>이름</span>
        <span style={{ fontSize: 16, color: 'var(--fg)', fontWeight: 700 }}>{displayName ?? '-'}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 12.5, color: 'var(--muted)', fontWeight: 600 }}>이메일</span>
        <span style={{ fontSize: 16, color: 'var(--fg)' }}>{email ?? '-'}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 12.5, color: 'var(--muted)', fontWeight: 600 }}>권한</span>
        {role && (
          <span style={{ alignSelf: 'flex-start', fontSize: 13.5, fontWeight: 800, color: '#fff', background: ROLE_COLOR[role], borderRadius: 8, padding: '4px 12px' }}>
            {ROLE_LABEL[role]}
          </span>
        )}
      </div>
      <button
        onClick={() => signOutUser()}
        style={{ alignSelf: 'flex-start', marginTop: 6, background: 'var(--surface-2)', color: 'var(--fg)', border: '1px solid var(--border)', borderRadius: 10, height: 40, padding: '0 20px', fontWeight: 700, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit' }}
      >
        로그아웃
      </button>
    </div>
  )
}
