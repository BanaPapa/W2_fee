import { app, db } from './firebaseClient'
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
  type User,
} from 'firebase/auth'
import { ref, get, set, onValue } from 'firebase/database'

export const auth = getAuth(app)
const googleProvider = new GoogleAuthProvider()

export type Role = 'admin' | 'editor' | 'viewer'

export interface UserProfile {
  uid: string
  email: string
  displayName: string
  role: Role | null
}

/** Firebase 인증 에러 코드를 한국어 메시지로 */
export function authErrorMessage(err: unknown): string {
  const code = (err as { code?: string })?.code ?? ''
  switch (code) {
    case 'auth/invalid-email': return '이메일 형식이 올바르지 않습니다.'
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential': return '이메일 또는 비밀번호가 올바르지 않습니다.'
    case 'auth/email-already-in-use': return '이미 가입된 이메일입니다.'
    case 'auth/weak-password': return '비밀번호는 6자 이상이어야 합니다.'
    case 'auth/popup-closed-by-user': return '로그인 창이 닫혔습니다.'
    case 'auth/operation-not-allowed': return '이 로그인 방식이 콘솔에서 아직 활성화되지 않았습니다.'
    case 'auth/configuration-not-found': return 'Firebase 콘솔에서 Authentication이 아직 설정되지 않았습니다. (Authentication → 시작하기 → 이메일/Google 활성화)'
    case 'auth/network-request-failed': return '네트워크 오류입니다. 연결을 확인해 주세요.'
    case 'auth/too-many-requests': return '시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.'
    default: return (err as { message?: string })?.message ?? '로그인에 실패했습니다.'
  }
}

export const signInEmail = (email: string, pw: string) => signInWithEmailAndPassword(auth, email, pw)
export const signUpEmail = (email: string, pw: string) => createUserWithEmailAndPassword(auth, email, pw)
export const signInGoogle = () => signInWithPopup(auth, googleProvider)
export const signOutUser = () => signOut(auth)
export const resetPassword = (email: string) => sendPasswordResetEmail(auth, email)

export function onAuthChange(cb: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, cb)
}

/** 로그인 시 관리 화면 목록에 뜨도록 사용자 프로필을 기록한다 (Auth 사용자 목록은 클라이언트에서 못 읽으므로) */
export async function writeUserProfile(user: User): Promise<void> {
  await set(ref(db, `users/${user.uid}`), {
    email: user.email ?? '',
    displayName: user.displayName ?? (user.email?.split('@')[0] ?? ''),
    lastLogin: Date.now(),
  })
}

/** 아직 아무 역할도 없는 최초 사용자라면 스스로 admin으로 등록한다 (부트스트랩) */
export async function claimAdminIfFirst(uid: string): Promise<void> {
  const rolesSnap = await get(ref(db, 'roles'))
  if (!rolesSnap.exists()) {
    await set(ref(db, `roles/${uid}`), 'admin')
  }
}

/** 내 역할을 실시간 구독. 역할이 없으면 null */
export function watchRole(uid: string, cb: (role: Role | null) => void): () => void {
  return onValue(ref(db, `roles/${uid}`), (snap) => {
    cb(snap.exists() ? (snap.val() as Role) : null)
  })
}

/** (admin용) 전체 사용자 목록 + 각자의 역할을 실시간 구독 */
export function watchAllUsers(cb: (users: UserProfile[]) => void): () => void {
  const usersRef = ref(db, 'users')
  const rolesRef = ref(db, 'roles')
  let users: Record<string, { email: string; displayName: string }> = {}
  let roles: Record<string, Role> = {}
  const emit = () => {
    cb(
      Object.entries(users).map(([uid, u]) => ({
        uid,
        email: u.email,
        displayName: u.displayName,
        role: roles[uid] ?? null,
      })),
    )
  }
  const u1 = onValue(usersRef, (snap) => { users = (snap.val() as typeof users) ?? {}; emit() })
  const u2 = onValue(rolesRef, (snap) => { roles = (snap.val() as typeof roles) ?? {}; emit() })
  return () => { u1(); u2() }
}

/** (admin용) 특정 사용자의 역할 지정 */
export const setUserRole = (uid: string, role: Role) => set(ref(db, `roles/${uid}`), role)
