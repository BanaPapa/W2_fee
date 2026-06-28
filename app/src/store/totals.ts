import type { CategoryId } from '../data/categories'
import { useProjectStore } from './projectStore'
import { useLaborStore, laborTotal, laborWorkDays } from './laborStore'
import { useMealStore, mealTotal } from './mealStore'
import { useAdStore, useOperatingStore, useMiscStore, ledgerTotal } from './ledgerStore'

/** Reactive per-category totals + grand total. Subscribes to every store. */
export function useTotals(): { byId: Record<CategoryId, number>; grand: number; workDays: number } {
  const extras = useProjectStore((s) => s.extras)
  const roles = useLaborStore((s) => s.roles)
  const meal = useMealStore((s) => s)
  const ad = useAdStore((s) => s.items)
  const op = useOperatingStore((s) => s.items)
  const etc = useMiscStore((s) => s.items)
  const periodStart = useProjectStore((s) => s.periodStart)
  const periodEnd = useProjectStore((s) => s.periodEnd)

  const workDays = laborWorkDays(roles)
  const operatingMonths = new Date(periodEnd).getMonth() - new Date(periodStart).getMonth() + 1
  const byId: Record<CategoryId, number> = {
    labor: laborTotal(roles, extras),
    meal: mealTotal(meal, roles, operatingMonths),
    ad: ledgerTotal(ad),
    op: ledgerTotal(op),
    etc: ledgerTotal(etc),
  }
  const grand = byId.labor + byId.meal + byId.ad + byId.op + byId.etc
  return { byId, grand, workDays }
}
