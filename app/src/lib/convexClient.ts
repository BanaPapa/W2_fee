import { ConvexReactClient } from 'convex/react'
import type { FunctionReference } from 'convex/server'

export const convexClient = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string)

/**
 * 저장용 뮤테이션 래퍼. 서버 검증 실패(예: 스키마 미배포) 시 조용히 유실되는 대신
 * 콘솔에 남기고 사용자에게 1회 경고를 띄운다.
 */
let persistErrorNotified = false
export function persistMutation<M extends FunctionReference<'mutation'>>(
  mutation: M,
  args: M['_args'],
): void {
  convexClient.mutation(mutation, args).catch((err: unknown) => {
    console.error('[convex] 저장 실패 — 변경사항이 서버에 반영되지 않았습니다:', err)
    if (!persistErrorNotified) {
      persistErrorNotified = true
      window.alert(
        '변경사항 저장에 실패했습니다. 새로고침하면 최근 변경이 사라질 수 있습니다.\n' +
        '(개발 중이라면 `npx convex dev`가 실행 중인지 확인하세요 — 스키마 변경이 서버에 배포되지 않았을 때 이 오류가 납니다)',
      )
    }
  })
}
