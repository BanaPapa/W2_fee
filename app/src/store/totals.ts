import type { CategoryId } from '../data/categories'
import { useProjectStore } from './projectStore'
import { useLaborStore, laborTotal, laborWorkDays } from './laborStore'
import { useMealStore, mealTotal } from './mealStore'
import { useAdStore, useOperatingStore, useMiscStore, ledgerTotal } from './ledgerStore'
import { useFeeStore, feeCostTotal, billTotal } from './feeStore'

/** Reactive per-category totals + P&L. Subscribes to every store. */
export function useTotals(): {
  byId: Record<CategoryId, number>
  grand: number // 총 비용 (6개 카드 합)
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

  const workDays = laborWorkDays(roles)
  const operatingMonths = new Date(periodEnd).getMonth() - new Date(periodStart).getMonth() + 1
  const byId: Record<CategoryId, number> = {
    fee: feeCostTotal(fee),
    labor: laborTotal(roles, extras),
    meal: mealTotal(meal, roles, operatingMonths, extras),
    ad: ledgerTotal(ad),
    op: ledgerTotal(op),
    etc: ledgerTotal(etc),
  }
  const grand = byId.fee + byId.labor + byId.meal + byId.ad + byId.op + byId.etc
  const bill = billTotal(fee)
  return { byId, grand, bill, profit: bill - grand, totalUnits: fee.totalUnits, workDays }
}
