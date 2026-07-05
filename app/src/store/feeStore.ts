import { create } from 'zustand'
import { api } from '../../convex/_generated/api'
import { convexClient } from '../lib/convexClient'
import { debounce } from '../lib/debounce'
import { useProjectStore, toDate, toIso } from './projectStore'

/* ---------------------------------------------------------------
 * 수수료 (청구·조직·MGM)
 *  - 청구수수료: 발주처에 청구하는 수입. 직접 입력하는 금액.
 *  - 목표분양률: 정당/예당 + D+1~D+N. D+n = 정당계약 첫날 + n개월,
 *    N은 분양 완료일이 마지막 D+n을 넘지 않도록 올림으로 결정된다.
 *    (예: 정당계약 12/15, 완료 4/30 → D+4=4/15로는 부족하므로 D+5)
 *  - 각 기간은 수수료 단계(데스크/1~3단계) 하나에 매핑되고, 단계마다
 *    조직 단가(하청업체 지급)가 있다. 예당까지(데스크)는 보통 0원.
 *  - MGM(소개수수료) = 기준 시점까지 누적 세대수 × 비율 × 세대당 단가
 * --------------------------------------------------------------- */

export type StageId = 'desk' | 's1' | 's2' | 's3'
export type MgmBasis = 'contract' | 'alt' // 정당까지 | 예당까지

export interface FeePeriod {
  key: string
  label: string
  date?: string    // 해당 기간의 기준일 (정당·예당 = 계약일, D+n = 정당계약+n개월)
  ratePct: number  // 구간별 목표분양률 (%)
  stage: StageId   // 이 기간에 적용되는 수수료 단계
}

export interface FeeStageRates {
  org: number // 조직 단가 (원/세대, 하청업체 지급)
}

export const STAGE_META: { id: StageId; name: string }[] = [
  { id: 'desk', name: '데스크' },
  { id: 's1', name: '1단계' },
  { id: 's2', name: '2단계' },
  { id: 's3', name: '3단계' },
]

export const stageName = (id: StageId): string => STAGE_META.find((s) => s.id === id)!.name

export const MGM_PRICE_OPTIONS = Array.from({ length: 10 }, (_, i) => (i + 1) * 1_000_000)
export const MGM_RATE_OPTIONS = [10, 20, 30, 40, 50]

export interface FeeDoc {
  totalUnits: number
  billAmount?: number // 청구수수료 총액 (직접 입력)
  periods: FeePeriod[]
  stageRates: Record<StageId, FeeStageRates>
  mgmUnitPrice: number
  mgmRatePct: number
  mgmBasis: MgmBasis
}

const DEFAULT_PERIODS: FeePeriod[] = [
  { key: 'contract', label: '정당', ratePct: 20, stage: 'desk' },
  { key: 'alt',      label: '예당', ratePct: 15, stage: 'desk' },
  { key: 'd1',       label: 'D+1', ratePct: 15, stage: 's1' },
  { key: 'd2',       label: 'D+2', ratePct: 10, stage: 's1' },
  { key: 'd3',       label: 'D+3', ratePct: 10, stage: 's2' },
  { key: 'd4',       label: 'D+4', ratePct: 10, stage: 's2' },
  { key: 'd5',       label: 'D+5', ratePct: 10, stage: 's3' },
  { key: 'd6',       label: 'D+6', ratePct: 10, stage: 's3' },
]

const DEFAULT_STAGE_RATES: Record<StageId, FeeStageRates> = {
  desk: { org: 0 },
  s1:   { org: 5000 },
  s2:   { org: 8000 },
  s3:   { org: 10000 },
}

interface FeeState extends FeeDoc {
  billAmount: number
  hydrated: boolean
  hydrate: (doc: FeeDoc) => void
  setTotalUnits: (n: number) => void
  setBillAmount: (n: number) => void
  updatePeriod: (key: string, patch: Partial<Pick<FeePeriod, 'ratePct' | 'stage'>>) => void
  updateStageRate: (id: StageId, patch: Partial<FeeStageRates>) => void
  setMgmUnitPrice: (n: number) => void
  setMgmRatePct: (n: number) => void
  setMgmBasis: (b: MgmBasis) => void
}

export const useFeeStore = create<FeeState>()((set) => ({
  hydrated: false,
  totalUnits: 1000,
  billAmount: 0,
  periods: DEFAULT_PERIODS,
  stageRates: DEFAULT_STAGE_RATES,
  mgmUnitPrice: 1_000_000,
  mgmRatePct: 20,
  mgmBasis: 'alt',

  hydrate: (doc) =>
    set({
      hydrated: true,
      totalUnits: doc.totalUnits,
      billAmount: doc.billAmount ?? 0,
      periods: doc.periods,
      stageRates: {
        desk: { org: doc.stageRates.desk.org },
        s1: { org: doc.stageRates.s1.org },
        s2: { org: doc.stageRates.s2.org },
        s3: { org: doc.stageRates.s3.org },
      },
      mgmUnitPrice: doc.mgmUnitPrice,
      mgmRatePct: doc.mgmRatePct,
      mgmBasis: doc.mgmBasis,
    }),
  setTotalUnits: (n) => set({ totalUnits: Math.max(0, n) }),
  setBillAmount: (n) => set({ billAmount: Math.max(0, n) }),
  updatePeriod: (key, patch) =>
    set((s) => ({ periods: s.periods.map((p) => (p.key === key ? { ...p, ...patch } : p)) })),
  updateStageRate: (id, patch) =>
    set((s) => ({ stageRates: { ...s.stageRates, [id]: { ...s.stageRates[id], ...patch } } })),
  setMgmUnitPrice: (n) => set({ mgmUnitPrice: n }),
  setMgmRatePct: (n) => set({ mgmRatePct: n }),
  setMgmBasis: (b) => set({ mgmBasis: b }),
}))

const pushFee = debounce((state: FeeState) => {
  convexClient.mutation(api.fee.set, {
    totalUnits: state.totalUnits,
    billAmount: state.billAmount,
    periods: state.periods,
    stageRates: state.stageRates,
    mgmUnitPrice: state.mgmUnitPrice,
    mgmRatePct: state.mgmRatePct,
    mgmBasis: state.mgmBasis,
  })
}, 400)

useFeeStore.subscribe((state, prev) => {
  if (!prev.hydrated) return
  pushFee(state)
})

/* ---------------- 분양일정 연동: D+n 기간 자동 계산 ---------------- */

/** iso + n개월. 말일 넘침은 그 달의 마지막 날로 보정 (12/31 + 2개월 → 2/28). */
const addMonths = (iso: string, n: number): string => {
  const d = toDate(iso)
  const t = new Date(d.getFullYear(), d.getMonth() + n, d.getDate())
  if (t.getDate() !== d.getDate()) t.setDate(0)
  return toIso(t.getTime())
}

/**
 * 분양일정(정당계약 첫날 ~ 완료일)에서 기간 목록을 다시 만든다.
 * 기존에 입력된 구간별 %와 단계 매핑은 key 기준으로 보존된다.
 */
export function syncFeePeriodsWithSchedule(): void {
  const ps = useProjectStore.getState()
  const main = ps.stages.find((s) => s.id === 'main')
  const contractDate = main?.keyDates?.find((k) => k.key === 'contract')?.date
  const altDate = main?.keyDates?.find((k) => k.key === 'alt')?.date
  if (!contractDate) return
  const endDate = ps.periodEnd

  // 완료일을 덮을 때까지 D+n을 늘린다 (완료일이 D+n 사이에 걸치면 올림)
  let n = 1
  while (addMonths(contractDate, n) < endDate && n < 36) n++

  const fee = useFeeStore.getState()
  const byKey = new Map(fee.periods.map((p) => [p.key, p]))
  const next: FeePeriod[] = [
    {
      key: 'contract', label: '정당', date: contractDate,
      ratePct: byKey.get('contract')?.ratePct ?? 20,
      stage: byKey.get('contract')?.stage ?? 'desk',
    },
    {
      key: 'alt', label: '예당', date: altDate,
      ratePct: byKey.get('alt')?.ratePct ?? 15,
      stage: byKey.get('alt')?.stage ?? 'desk',
    },
    ...Array.from({ length: n }, (_, i) => {
      const key = `d${i + 1}`
      const prev = byKey.get(key)
      return {
        key,
        label: `D+${i + 1}`,
        date: addMonths(contractDate, i + 1),
        ratePct: prev?.ratePct ?? 0,
        stage: prev?.stage ?? ('s3' as StageId),
      }
    }),
  ]

  if (JSON.stringify(next) !== JSON.stringify(fee.periods)) {
    useFeeStore.setState({ periods: next })
  }
}

useProjectStore.subscribe(() => syncFeePeriodsWithSchedule())

/* ---------------- 파생 계산 ---------------- */

export interface FeePeriodRow extends FeePeriod {
  cumPct: number   // 누적 분양률 (%)
  units: number    // 구간별 세대수
  cumUnits: number // 누적 세대수
}

/** 기간별 누적/세대수 파생. 세대수는 누적 기준으로 반올림해 합계가 어긋나지 않게 한다. */
export function feePeriodRows(doc: Pick<FeeDoc, 'totalUnits' | 'periods'>): FeePeriodRow[] {
  const rows: FeePeriodRow[] = []
  let cumPct = 0
  let prevCumUnits = 0
  for (const p of doc.periods) {
    cumPct += p.ratePct
    const cumUnits = Math.round((doc.totalUnits * cumPct) / 100)
    rows.push({ ...p, cumPct, units: cumUnits - prevCumUnits, cumUnits })
    prevCumUnits = cumUnits
  }
  return rows
}

export interface FeeStageRow {
  id: StageId
  name: string
  periodLabels: string[]
  units: number
  org: number
  orgTotal: number
}

export function feeStageRows(doc: FeeDoc): FeeStageRow[] {
  const rows = feePeriodRows(doc)
  return STAGE_META.map(({ id, name }) => {
    const mine = rows.filter((r) => r.stage === id)
    const units = mine.reduce((a, r) => a + r.units, 0)
    const { org } = doc.stageRates[id]
    return {
      id,
      name,
      periodLabels: mine.map((r) => r.label),
      units,
      org,
      orgTotal: units * org,
    }
  })
}

/** MGM = 기준 시점(정당/예당)까지 누적 세대수 × 비율 × 세대당 단가 */
export function mgmTotal(doc: FeeDoc): number {
  const rows = feePeriodRows(doc)
  const basisIdx = doc.mgmBasis === 'contract' ? 0 : 1
  const cumUnits = rows[basisIdx]?.cumUnits ?? 0
  return Math.round(cumUnits * (doc.mgmRatePct / 100)) * doc.mgmUnitPrice
}

/** MGM 대상 세대수 (표시용) */
export function mgmUnits(doc: FeeDoc): number {
  const rows = feePeriodRows(doc)
  const basisIdx = doc.mgmBasis === 'contract' ? 0 : 1
  return Math.round((rows[basisIdx]?.cumUnits ?? 0) * (doc.mgmRatePct / 100))
}

/** 청구수수료 총액 (수입, 직접 입력) */
export function billTotal(doc: FeeDoc): number {
  return doc.billAmount ?? 0
}

/** 조직수수료 총액 (하청업체 지급 비용) */
export function orgTotal(doc: FeeDoc): number {
  return feeStageRows(doc).reduce((a, r) => a + r.orgTotal, 0)
}

/** 카드에 표시되는 수수료성 비용 = 조직수수료 + MGM */
export function feeCostTotal(doc: FeeDoc): number {
  return orgTotal(doc) + mgmTotal(doc)
}
