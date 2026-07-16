import { initializeApp } from 'firebase/app'
import { getDatabase, ref, get, set, onValue } from 'firebase/database'

// 모듈러 SDK만 사용한다 (firebase/compat 금지) — 과거 v8↔v9 문법 혼용으로 깨지던 원인 제거.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL as string,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string,
}

export const app = initializeApp(firebaseConfig)
export const db = getDatabase(app)

// 쓰기 가드 — 열람자(viewer)나 미로그인 상태에서 saveDoc이 서버에 쓰기를 시도하지 않도록
// 막는다. authStore가 역할에 따라 이 가드를 갱신한다. (Security Rules가 진짜 방어선이고,
// 이건 불필요한 permission-denied 오류와 무의미한 네트워크 요청을 줄이는 UX 보호막이다.)
let writeGuard: () => boolean = () => true
export function setWriteGuard(fn: () => boolean): void {
  writeGuard = fn
}

/** RTDB에서 문서(트리 노드) 하나를 1회 로드. 없으면 null. (convex query .first() 대체) */
export async function loadDoc<T>(path: string): Promise<T | null> {
  const snapshot = await get(ref(db, path))
  return snapshot.exists() ? (snapshot.val() as T) : null
}

/** 실시간 구독. 값이 바뀔 때마다 cb 호출. 반환값 호출 시 구독 해제. (마일스톤 B에서 활용) */
export function subscribeDoc<T>(path: string, cb: (value: T | null) => void): () => void {
  return onValue(ref(db, path), (snapshot) => {
    cb(snapshot.exists() ? (snapshot.val() as T) : null)
  })
}

/**
 * 저장 래퍼. 서버 반영 실패 시 조용히 유실되는 대신 콘솔에 남기고 사용자에게 1회 경고.
 * (기존 convexClient.persistMutation 과 동일한 역할)
 * 디바운스는 각 스토어가 이미 처리하므로 여기서는 즉시 set 한다.
 */
let persistErrorNotified = false
export function saveDoc(path: string, data: unknown): void {
  if (!writeGuard()) return // 열람자/미로그인: 로컬 변경은 두되 서버 쓰기는 하지 않음
  set(ref(db, path), stripUndefined(data)).catch((err: unknown) => {
    console.error('[firebase] 저장 실패 — 변경사항이 서버에 반영되지 않았습니다:', err)
    if (!persistErrorNotified) {
      persistErrorNotified = true
      window.alert(
        '변경사항 저장에 실패했습니다. 새로고침하면 최근 변경이 사라질 수 있습니다.\n' +
        '(네트워크 또는 Firebase 규칙/권한 문제일 수 있습니다.)',
      )
    }
  })
}

/**
 * RTDB는 값에 `undefined`가 있으면 전체 쓰기를 거부한다. optional 필드(groups, order, tabNames 등)가
 * undefined인 경우를 대비해 재귀적으로 제거한다. (빈 배열→null 이슈는 읽는 쪽에서 `?? []`로 방어)
 */
function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((v) => stripUndefined(v)) as unknown as T
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== undefined) out[k] = stripUndefined(v)
    }
    return out as T
  }
  return value
}
