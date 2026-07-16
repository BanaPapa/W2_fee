import { create } from 'zustand'
import {
  onAuthChange,
  watchRole,
  writeUserProfile,
  claimAdminIfFirst,
  type Role,
} from '../lib/firebaseAuth'
import { setWriteGuard } from '../lib/firebaseClient'
import { hydrateAllData } from './../lib/hydrateData'

// loading   — 최초 인증 상태 확인 중
// signedOut — 로그인 안 됨
// noRole    — 로그인됐지만 아직 역할 미배정 (관리자 승인 대기)
// ready     — 로그인 + 역할 있음 (앱 사용 가능)
export type AuthStatus = 'loading' | 'signedOut' | 'noRole' | 'ready'

interface AuthState {
  status: AuthStatus
  uid: string | null
  email: string | null
  displayName: string | null
  role: Role | null
  dataReady: boolean
}

export const useAuthStore = create<AuthState>(() => ({
  status: 'loading',
  uid: null,
  email: null,
  displayName: null,
  role: null,
  dataReady: false,
}))

/** 역할이 편집 가능한 등급인지 (admin/editor) */
export const canEditFromRole = (role: Role | null): boolean => role === 'admin' || role === 'editor'

// 쓰기 가드를 현재 스토어 역할과 연동한다 (열람자/미로그인은 서버 쓰기 안 함)
setWriteGuard(() => canEditFromRole(useAuthStore.getState().role))

let roleUnsub: (() => void) | null = null

/** 앱 진입점에서 1회 호출. 인증 상태를 구독하고 스토어를 갱신한다. */
export function initAuth(): void {
  onAuthChange(async (user) => {
    // 이전 사용자의 역할 구독 정리
    if (roleUnsub) { roleUnsub(); roleUnsub = null }

    if (!user) {
      useAuthStore.setState({ status: 'signedOut', uid: null, email: null, displayName: null, role: null })
      return
    }

    useAuthStore.setState({
      uid: user.uid,
      email: user.email,
      displayName: user.displayName ?? user.email?.split('@')[0] ?? null,
    })

    // 프로필 기록 + 최초 사용자 admin 부트스트랩 (실패해도 로그인 흐름은 계속)
    try {
      await claimAdminIfFirst(user.uid)
      await writeUserProfile(user)
    } catch (err) {
      console.error('[auth] 프로필/부트스트랩 기록 실패:', err)
    }

    // 내 역할 실시간 구독
    roleUnsub = watchRole(user.uid, (role) => {
      if (role) {
        useAuthStore.setState({ role, status: 'ready' })
        // 역할이 확인된 뒤에만 데이터 로드 (Rules가 인증을 요구하므로)
        void hydrateAllData().then(() => useAuthStore.setState({ dataReady: true }))
      } else {
        useAuthStore.setState({ role: null, status: 'noRole' })
      }
    })
  })
}
