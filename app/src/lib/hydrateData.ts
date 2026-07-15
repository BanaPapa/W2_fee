import { loadDoc } from './firebaseClient'
import { useProjectStore, type ProjectDoc } from '../store/projectStore'
import { useLaborStore, type LaborDoc } from '../store/laborStore'
import { useMealStore, type MealDoc } from '../store/mealStore'
import { useAdStore, useOperatingStore, useMiscStore, type LedgerDoc } from '../store/ledgerStore'
import { useCustomCardsStore, type CustomCardsDoc } from '../store/customCardsStore'
import { useFeeStore, syncFeePeriodsWithSchedule, type FeeDoc } from '../store/feeStore'

let started = false

/**
 * RTDB에서 8개 문서를 읽어 각 스토어를 하이드레이트한다.
 * Security Rules가 인증을 요구하므로 반드시 "로그인 + 역할 확인" 이후에 호출해야 한다.
 * 중복 호출은 무시한다 (계정 전환 시 데이터는 공유되므로 다시 읽을 필요 없음).
 */
export async function hydrateAllData(): Promise<void> {
  if (started) return
  started = true

  const [project, labor, meal, ad, operating, misc, fee, customCards] = await Promise.all([
    loadDoc<ProjectDoc>('project'),
    loadDoc<LaborDoc>('labor'),
    loadDoc<MealDoc>('meal'),
    loadDoc<LedgerDoc>('ledgers/ad'),
    loadDoc<LedgerDoc>('ledgers/operating'),
    loadDoc<LedgerDoc>('ledgers/misc'),
    loadDoc<FeeDoc>('fee'),
    loadDoc<CustomCardsDoc>('customCards'),
  ])

  // 문서가 아직 없어도(신규 배포 등) hydrated는 반드시 true로 세팅해야 이후 입력이 최초 저장으로 이어진다.
  if (project) useProjectStore.getState().hydrate(project)
  else useProjectStore.setState({ hydrated: true })

  if (labor) useLaborStore.getState().hydrate(labor)
  else useLaborStore.setState({ hydrated: true })

  if (meal) useMealStore.getState().hydrate(meal)
  else useMealStore.setState({ hydrated: true })

  if (ad) useAdStore.getState().hydrate(ad)
  else useAdStore.setState({ hydrated: true })

  if (operating) useOperatingStore.getState().hydrate(operating)
  else useOperatingStore.setState({ hydrated: true })

  if (misc) useMiscStore.getState().hydrate(misc)
  else useMiscStore.setState({ hydrated: true })

  if (fee) useFeeStore.getState().hydrate(fee)
  else useFeeStore.setState({ hydrated: true })
  syncFeePeriodsWithSchedule() // 분양일정 기준으로 D+n 기간 목록 재구성

  if (customCards) useCustomCardsStore.getState().hydrate(customCards)
  else useCustomCardsStore.setState({ hydrated: true })
}
