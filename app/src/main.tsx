import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { loadDoc } from './lib/firebaseClient'
import { useProjectStore, type ProjectDoc } from './store/projectStore'
import { useLaborStore, type LaborDoc } from './store/laborStore'
import { useMealStore, type MealDoc } from './store/mealStore'
import { useAdStore, useOperatingStore, useMiscStore, type LedgerDoc } from './store/ledgerStore'
import { useCustomCardsStore, type CustomCardsDoc } from './store/customCardsStore'
import { useFeeStore, syncFeePeriodsWithSchedule, type FeeDoc } from './store/feeStore'
import './index.css'
import App from './App.tsx'

async function bootstrap() {
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

  // 문서가 아직 없어도(신규 배포 등) hydrated는 반드시 true로 세팅해야 한다.
  // 그래야 이후 사용자가 입력한 값이 최초 저장(insert)으로 이어진다 — 그렇지 않으면
  // 이 스토어의 저장 로직(hydrated 가드)이 세션 내내 막혀서 아무것도 저장되지 않는다.
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

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

bootstrap()
