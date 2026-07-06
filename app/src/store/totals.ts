import { useProjectStore } from './projectStore'
import { useLaborStore, laborTotal, laborWorkDays } from './laborStore'
import { useMealStore, mealTotal } from './mealStore'
import { useAdStore, useOperatingStore, useMiscStore, ledgerTotal } from './ledgerStore'
import { useFeeStore, feeCostTotal, billTotal } from './feeStore'
import { useCustomCardsStore, customCardTotal } from './customCardsStore'

/** Reactive per-category totals + P&L. Subscribes to every store, including user-added cards. */
export function useTotals(): {
  byId: Record<string, number>
  grand: number // 총 비용 (고정 카드 + 사용자 추가 카드 전부 합)
  bill: number // 청구수수료 (수입)
  profit: number // 순이익 = 청구수수료 - 총 비용
  totalUnits: number
  workDays: number
} {
  const extras = useProjectStore((s) => s.extras)
  const roles = useLaborStore((s) => s.roles)
  const meal = useMealStore((s) => s)
  const ad = useAdStore((s) => s.items)
  const op = useOperatingStore((s) => s.items)
  const etc = useMiscStore((s) => s.items)
  const fee = useFeeStore((s) => s)
  const periodStart = useProjectStore((s) => s.periodStart)
  const periodEnd = useProjectStore((s) => s.periodEnd)
  const customCards = useCustomCardsStore((s) => s)

  const workDays = laborWorkDays(roles)
  const operatingMonths = new Date(periodEnd).getMonth() - new Date(periodStart).getMonth() + 1
  const byId: Record<string, number> = {
    fee: feeCostTotal(fee),
    labor: laborTotal(roles, extras),
    meal: mealTotal(meal, roles, operatingMonths, extras),
    ad: ledgerTotal(ad),
    op: ledgerTotal(op),
    etc: ledgerTotal(etc),
  }
  let grand = byId.fee + byId.labor + byId.meal + byId.ad + byId.op + byId.etc
  for (const c of customCards.cards) {
    const t = customCardTotal(customCards, c.id)
    byId[c.id] = t
    grand += t
  }
  const bill = billTotal(fee)
  return { byId, grand, bill, profit: bill - grand, totalUnits: fee.totalUnits, workDays }
}
