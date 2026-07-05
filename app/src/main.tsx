import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ConvexProvider } from 'convex/react'
import { convexClient } from './lib/convexClient'
import { api } from '../convex/_generated/api'
import { useProjectStore } from './store/projectStore'
import { useLaborStore, type LaborDoc } from './store/laborStore'
import { useMealStore } from './store/mealStore'
import { useAdStore, useOperatingStore, useMiscStore } from './store/ledgerStore'
import { useFeeStore, syncFeePeriodsWithSchedule, type FeeDoc } from './store/feeStore'
import './index.css'
import App from './App.tsx'

async function bootstrap() {
  const [project, labor, meal, ad, operating, misc, fee] = await Promise.all([
    convexClient.query(api.project.get, {}),
    convexClient.query(api.labor.get, {}),
    convexClient.query(api.meal.get, {}),
    convexClient.query(api.ledger.get, { category: 'ad' }),
    convexClient.query(api.ledger.get, { category: 'operating' }),
    convexClient.query(api.ledger.get, { category: 'misc' }),
    convexClient.query(api.fee.get, {}),
  ])

  if (project) useProjectStore.getState().hydrate(project)
  if (labor) useLaborStore.getState().hydrate(labor as unknown as LaborDoc)
  if (meal) useMealStore.getState().hydrate(meal)
  if (ad) useAdStore.getState().hydrate(ad)
  if (operating) useOperatingStore.getState().hydrate(operating)
  if (misc) useMiscStore.getState().hydrate(misc)
  if (fee) useFeeStore.getState().hydrate(fee as unknown as FeeDoc)
  syncFeePeriodsWithSchedule() // 분양일정 기준으로 D+n 기간 목록 재구성

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ConvexProvider client={convexClient}>
        <App />
      </ConvexProvider>
    </StrictMode>,
  )
}

bootstrap()
