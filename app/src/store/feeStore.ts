import { create } from 'zustand'
import { saveDoc } from '../lib/firebaseClient'
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

export type StageId = 'desk' | 's1' | 's2' | 's3' | 's4' | 's5'

export const MIN_STAGE_COUNT = 1
export const MAX_STAGE_COUNT = 5
export type MgmBasis = 'all' | 'contract' | 'alt' // 전체 | 정당까지 | 예당까지

export const MGM_BASIS_OPTIONS: { id: MgmBasis; label: string }[] = [
  { id: 'all', label: '전체' },
  { id: 'contract', label: '정당까지' },
  { id: 'alt', label: '예당까지' },
]

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
  { id: 's4', name: '4단계' },
  { id: 's5', name: '5단계' },
]

export const stageName = (id: StageId): string => STAGE_META.find((s) => s.id === id)!.name

/** 현재 활성화된 단계(데스크 + 1~stageCount단계). 단계 수는 사건마다 1~5로 조정 가능하다. */
export function activeStageMeta(doc: Pick<FeeDoc, 'stageCount'>): { id: StageId; name: string }[] {
  const n = Math.min(MAX_STAGE_COUNT, Math.max(MIN_STAGE_COUNT, doc.stageCount))
  return STAGE_META.filter((s) => s.id === 'desk' || Number(s.id.slice(1)) <= n)
}

export const MGM_PRICE_OPTIONS = Array.from({ length: 10 }, (_, i) => (i + 1) * 1_000_000)
export const MGM_RATE_OPTIONS = [10, 20, 30, 40, 50]

export interface FeeDoc {
  totalUnits: number
  billAmount?: number // 청구수수료 총액 (구버전: 직접 입력. 이제 세대수 × 세대당 단가로 자동 계산)
  billUnitPrice?: number // 세대당 청구 단가 (원) — 청구수수료 = totalUnits × billUnitPrice
  periods: FeePeriod[]
  stageRates: Record<StageId, FeeStageRates>
  stageCount: number // 활성화된 단계 수 (1~5, 데스크 제외)
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
  s4:   { org: 0 },
  s5:   { org: 0 },
}

interface FeeState extends FeeDoc {
  billAmount: number
  billUnitPrice: number
  hydrated: boolean
  hydrate: (doc: FeeDoc) => void
  setTotalUnits: (n: number) => void
  setBillAmount: (n: number) => void
  setBillUnitPrice: (n: number) => void
  updatePeriod: (key: string, patch: Partial<Pick<FeePeriod, 'ratePct' | 'stage'>>) => void
  /** 기간을 단계에 배정하되, 기간 순서가 단계 순서와 항상 맞도록 앞/뒤 기간을 함께 이동시킨다 */
  assignPeriodStage: (key: string, stage: StageId) => void
  /** 최초 계약률(정당+예당 합)을 받아 나머지를 D+1~D+N에 점감(앞이 많고 점차 감소) 배분해 합계 100%를 맞춘다 */
  autoDistributeRates: (initialPct: number) => void
  updateStageRate: (id: StageId, patch: Partial<FeeStageRates>) => void
  setStageCount: (n: number) => void
  setMgmUnitPrice: (n: number) => void
  setMgmRatePct: (n: number) => void
  setMgmBasis: (b: MgmBasis) => void
}

const STAGE_ORDER: Record<StageId, number> = { desk: 0, s1: 1, s2: 2, s3: 3, s4: 4, s5: 5 }

export const useFeeStore = create<FeeState>()((set) => ({
  hydrated: false,
  totalUnits: 1000,
  billAmount: 0,
  billUnitPrice: 0,
  periods: DEFAULT_PERIODS,
  stageRates: DEFAULT_STAGE_RATES,
  stageCount: 3,
  mgmUnitPrice: 1_000_000,
  mgmRatePct: 20,
  mgmBasis: 'alt',

  hydrate: (doc) => {
    // 구버전 문서는 s4/s5/stageCount가 없을 수 있으므로 기본값으로 보정한다.
    const sr = doc.stageRates as Partial<Record<StageId, FeeStageRates>>
    set({
      hydrated: true,
      totalUnits: doc.totalUnits,
      billAmount: doc.billAmount ?? 0,
      // 구버전 문서(청구수수료 직접 입력)는 총액 ÷ 세대수로 세대당 단가를 역산해서 이어받는다
      billUnitPrice:
        doc.billUnitPrice ??
        (doc.totalUnits > 0 && doc.billAmount ? Math.round(doc.billAmount / doc.totalUnits) : 0),
      periods: doc.periods ?? [],
      stageRates: {
        desk: { org: sr.desk?.org ?? 0 },
        s1: { org: sr.s1?.org ?? 0 },
        s2: { org: sr.s2?.org ?? 0 },
        s3: { org: sr.s3?.org ?? 0 },
        s4: { org: sr.s4?.org ?? 0 },
        s5: { org: sr.s5?.org ?? 0 },
      },
      stageCount: doc.stageCount ?? 3,
      mgmUnitPrice: doc.mgmUnitPrice,
      mgmRatePct: doc.mgmRatePct,
      mgmBasis: doc.mgmBasis,
    })
  },
  setTotalUnits: (n) => set({ totalUnits: Math.max(0, n) }),
  setBillAmount: (n) => set({ billAmount: Math.max(0, n) }),
  setBillUnitPrice: (n) => set({ billUnitPrice: Math.max(0, n) }),
  updatePeriod: (key, patch) =>
    set((s) => ({ periods: s.periods.map((p) => (p.key === key ? { ...p, ...patch } : p)) })),
  assignPeriodStage: (key, stage) =>
    set((s) => {
      // 정당/예당은 항상 한 몸으로 움직인다
      const unit = key === 'contract' || key === 'alt' ? ['contract', 'alt'] : [key]
      const idxs = s.periods.flatMap((p, i) => (unit.includes(p.key) ? [i] : []))
      if (idxs.length === 0) return s
      const lo = Math.min(...idxs)
      const hi = Math.max(...idxs)
      const target = STAGE_ORDER[stage]
      // 기간 순서(정당/예당 → D+1 → D+2 …)와 단계 순서가 항상 같이 증가해야 하므로,
      // 옮겨진 기간보다 앞이면서 더 늦은 단계인 기간은 앞으로, 뒤이면서 더 이른 단계인 기간은 뒤로 끌려온다.
      const periods = s.periods.map((p, i) => {
        const cur = STAGE_ORDER[p.stage]
        if (i >= lo && i <= hi) return p.stage === stage ? p : { ...p, stage }
        if (i < lo && cur > target) return { ...p, stage }
        if (i > hi && cur < target) return { ...p, stage }
        return p
      })
      return { periods }
    }),
  autoDistributeRates: (initialPct) =>
    set((s) => {
      const initial = Math.max(0, Math.min(100, Math.round(initialPct)))
      // 최초 계약률은 정당 6 : 예당 4로 나눈다 (합만 맞으면 되므로 이후 개별 조정 가능)
      const contractPct = Math.round(initial * 0.6)
      const altPct = initial - contractPct

      const dPeriods = s.periods.filter((p) => p.key.startsWith('d'))
      const remain = 100 - initial
      const n = dPeriods.length
      // 선형 점감 가중치 (n, n-1, …, 1): 1~2개월째가 많고 점차 줄어든다.
      // 누적 기준으로 반올림해 합계가 정확히 remain이 되게 한다.
      const wsum = (n * (n + 1)) / 2
      let wCum = 0
      let prevRounded = 0
      const monthPcts = dPeriods.map((_, i) => {
        wCum += n - i
        const rounded = wsum > 0 ? Math.round((remain * wCum) / wsum) : 0
        const v = rounded - prevRounded
        prevRounded = rounded
        return v
      })

      const byKey = new Map(dPeriods.map((p, i) => [p.key, monthPcts[i]]))
      const periods = s.periods.map((p) => {
        if (p.key === 'contract') return { ...p, ratePct: contractPct }
        if (p.key === 'alt') return { ...p, ratePct: altPct }
        const v = byKey.get(p.key)
        return v == null ? p : { ...p, ratePct: v }
      })
      return { periods }
    }),
  updateStageRate: (id, patch) =>
    set((s) => ({ stageRates: { ...s.stageRates, [id]: { ...s.stageRates[id], ...patch } } })),
  setStageCount: (n) =>
    set((s) => {
      const clamped = Math.max(MIN_STAGE_COUNT, Math.min(MAX_STAGE_COUNT, n))
      const maxStage = `s${clamped}` as StageId
      // 비활성화되는 단계에 매핑된 기간은 새 최대 단계로 내려서 세대수/수수료가 유실되지 않게 한다.
      const periods = s.periods.map((p) => {
        if (p.stage === 'desk') return p
        const num = Number(p.stage.slice(1))
        return num > clamped ? { ...p, stage: maxStage } : p
      })
      return { stageCount: clamped, periods }
    }),
  setMgmUnitPrice: (n) => set({ mgmUnitPrice: n }),
  setMgmRatePct: (n) => set({ mgmRatePct: n }),
  setMgmBasis: (b) => set({ mgmBasis: b }),
}))

const pushFee = debounce((state: FeeState) => {
  saveDoc('fee', {
    totalUnits: state.totalUnits,
    billAmount: billTotal(state),
    billUnitPrice: state.billUnitPrice,
    periods: state.periods,
    stageRates: state.stageRates,
    stageCount: state.stageCount,
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
  return activeStageMeta(doc).map(({ id, name }) => {
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

/** MGM 기준 시점의 누적 세대수 (전체 = 총 세대수, 그 외 = 해당 기간까지 누적) */
export function mgmBasisCumUnits(doc: FeeDoc): number {
  if (doc.mgmBasis === 'all') return doc.totalUnits
  const rows = feePeriodRows(doc)
  const basisIdx = doc.mgmBasis === 'contract' ? 0 : 1
  return rows[basisIdx]?.cumUnits ?? 0
}

/** MGM 기준 시점 라벨 (표시용) */
export function mgmBasisLabel(doc: FeeDoc): string {
  if (doc.mgmBasis === 'all') return '전체'
  const rows = feePeriodRows(doc)
  const basisIdx = doc.mgmBasis === 'contract' ? 0 : 1
  return rows[basisIdx]?.label ?? ''
}

/** MGM 대상 세대수 (표시용) */
export function mgmUnits(doc: FeeDoc): number {
  return Math.round(mgmBasisCumUnits(doc) * (doc.mgmRatePct / 100))
}

/** MGM = 기준 시점(전체/정당/예당)까지 누적 세대수 × 비율 × 세대당 단가 */
export function mgmTotal(doc: FeeDoc): number {
  return mgmUnits(doc) * doc.mgmUnitPrice
}

/** 청구수수료 총액 (수입) = 총 세대수 × 세대당 청구 단가 */
export function billTotal(doc: FeeDoc): number {
  return doc.totalUnits * (doc.billUnitPrice ?? 0)
}

/** 조직수수료 총액 (하청업체 지급 비용) */
export function orgTotal(doc: FeeDoc): number {
  return feeStageRows(doc).reduce((a, r) => a + r.orgTotal, 0)
}

/** 카드에 표시되는 수수료성 비용 = 조직수수료 + MGM */
export function feeCostTotal(doc: FeeDoc): number {
  return orgTotal(doc) + mgmTotal(doc)
}
