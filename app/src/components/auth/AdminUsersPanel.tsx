import { useEffect, useState } from 'react'
import { useAuthStore } from '../../store/authStore'
import { watchAllUsers, setUserRole, type Role, type UserProfile } from '../../lib/firebaseAuth'

const ROLES: Role[] = ['admin', 'editor', 'viewer']
const ROLE_LABEL: Record<Role, string> = { admin: '관리자', editor: '편집자', viewer: '열람자' }

export default function AdminUsersPanel() {
  const myUid = useAuthStore((s) => s.uid)
  const [users, setUsers] = useState<UserProfile[]>([])

  useEffect(() => watchAllUsers(setUsers), [])

  const sorted = [...users].sort((a, b) => a.email.localeCompare(b.email))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 13, color: 'var(--muted)' }}>
        사용자별 권한을 지정합니다. 역할이 없는 사용자는 로그인해도 <b>승인 대기</b> 상태입니다.
        <br />본인 권한은 실수로 잠기지 않도록 변경할 수 없습니다.
      </div>
      {sorted.length === 0 && (
        <div style={{ fontSize: 14, color: 'var(--muted)', padding: '12px 0' }}>아직 로그인한 사용자가 없습니다.</div>
      )}
      {sorted.map((u) => {
        const isMe = u.uid === myUid
        return (
          <div
            key={u.uid}
            style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface-2)' }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {u.displayName || u.email}{isMe && <span style={{ color: 'var(--accent)', marginLeft: 6, fontSize: 13 }}>(나)</span>}
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</div>
            </div>
            <select
              className="field-input"
              style={{ width: 120, flexShrink: 0, opacity: isMe ? 0.5 : 1, cursor: isMe ? 'not-allowed' : 'pointer' }}
              value={u.role ?? ''}
              disabled={isMe}
              onChange={(e) => setUserRole(u.uid, e.target.value as Role)}
            >
              {u.role === null && <option value="" disabled>미지정</option>}
              {ROLES.map((r) => (
                <option key={r} value={r}>{ROLE_LABEL[r]}</option>
              ))}
            </select>
          </div>
        )
      })}
    </div>
  )
}
