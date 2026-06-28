import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface ExtraSlot { name: string; days: number }

export interface KeyDate { key: string; label: string; date: string }
export interface SubPeriod { key: string; label: string; start: string; end: string }

export interface Stage {
  id: string
  name: string
  start: string
  end: string
  color: string
  enabled: boolean
  durationDays?: number
  openDays?: 3 | 10       // 본 영업 오픈 기간
  keyDates?: KeyDate[]
  subPeriods?: SubPeriod[]
}

export const MS_DAY = 86400000

export const toDate = (iso: string): Date => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export const toIso = (ms: number): string => {
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const nearestFriday = (ms: number): number => {
  const dow = new Date(ms).getDay()
  if (dow === 5) return ms
  const daysToNext = (5 - dow + 7) % 7
  const daysToPrev = (dow + 7 - 5) % 7
  return daysToNext <= daysToPrev ? ms + daysToNext * MS_DAY : ms - daysToPrev * MS_DAY
}

// openDays: 3일 오픈 → 특공+1=1순위 on open+4; 10일 → 1순위 on open+11
export const calcMainKeyDates = (openDateStr: string, openDays: 3 | 10 = 3): KeyDate[] => {
  const o = toDate(openDateStr).getTime()
  const r1  = openDays + 1        // 1순위: 오픈+openDays(특공일)+1
  const win = r1 + 8              // 당발: 1순위+8
  const con = win + 11            // 계약: 당발+11
  const alt = con + 3             // 예당: 계약+3
  return [
    { key: 'open',     label: '오픈일',     date: openDateStr },
    { key: 'rank1',    label: '1순위',      date: toIso(o + r1  * MS_DAY) },
    { key: 'winner',   label: '당첨자발표', date: toIso(o + win * MS_DAY) },
    { key: 'contract', label: '정당계약',   date: toIso(o + con * MS_DAY) },
    { key: 'alt',      label: '예당계약',   date: toIso(o + alt * MS_DAY) },
  ]
}

const rescale = (dateStr: string, oS: number, oSpan: number, nS: number, nSpan: number) =>
  toIso(nS + Math.round(((toDate(dateStr).getTime() - oS) / oSpan) * nSpan))

const enabledBounds = (stages: Stage[]) => {
  const en = stages.filter(s => s.enabled)
  return {
    periodStart: en[0]?.start ?? stages[0].start,
    periodEnd: en[en.length - 1]?.end ?? stages[stages.length - 1].end,
  }
}

const DEFAULT_STAGES: Stage[] = [
  {
    id: 'presales', name: '사전영업',
    start: '2026-06-01', end: '2026-07-02',   // end = 모집공고일 = 오픈일 전날
    color: 'teal', enabled: true,
    subPeriods: [
      { key: 'planning', label: '기획투입', start: '2026-06-01', end: '2026-06-20' },
      { key: 'sales',    label: '영업투입', start: '2026-06-10', end: '2026-07-02' },
    ],
  },
  {
    id: 'main', name: '본 영업',
    start: '2026-07-03', end: '2026-07-29',   // start = 오픈일, end = 예당계약
    color: 'accent', enabled: true,
    openDays: 3,
    keyDates: calcMainKeyDates('2026-07-03', 3),
  },
  {
    id: 'noorder', name: '무순위',
    start: '2026-07-30', end: '2026-08-19',   // 21일 기준
    color: 'violet', enabled: false,
  },
  {
    id: 'postsales', name: '사후영업',
    start: '2026-07-30', end: '2026-08-31',
    color: 'slate', enabled: true,
  },
]

interface ProjectState {
  periodStart: string
  periodEnd: string
  extras: ExtraSlot[]
  stages: Stage[]
  project: { title: string; pm: string }
  setPeriod: (start: string, end: string) => void
  setAllStages: (stages: Stage[]) => void
  resetStages: () => void
  toggleNoOrder: () => void
  updateStage: (i: number, patch: Partial<Stage>) => void
  updateKeyDate: (stageIdx: number, key: string, date: string) => void
  updateSubPeriod: (stageIdx: number, key: string, patch: Partial<SubPeriod>) => void
  setOpenDate: (dateStr: string) => void
  setOpenDays: (days: 3 | 10) => void
  addExtra: () => void
  updateExtra: (i: number, patch: Partial<ExtraSlot>) => void
  removeExtra: (i: number) => void
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set) => ({
      periodStart: '2026-06-01',
      periodEnd: '2026-11-14',
      extras: [],
      stages: DEFAULT_STAGES,
      project: { title: '강남 리버파크 분양 제안', pm: '김서연 PM' },

      setPeriod: (start, end) =>
        set((state) => {
          const oS = toDate(state.periodStart).getTime()
          const oSpan = Math.max(1, toDate(state.periodEnd).getTime() - oS)
          const nS = toDate(start).getTime()
          const nSpan = Math.max(1, toDate(end).getTime() - nS)
          const en = state.stages.filter(s => s.enabled)
          const firstId = en[0]?.id
          const lastId = en[en.length - 1]?.id

          const stages = state.stages.map((s) => ({
            ...s,
            start: s.id === firstId ? start : rescale(s.start, oS, oSpan, nS, nSpan),
            end:   s.id === lastId  ? end   : rescale(s.end,   oS, oSpan, nS, nSpan),
            keyDates: s.keyDates?.map(kd => ({ ...kd, date: rescale(kd.date, oS, oSpan, nS, nSpan) })),
            subPeriods: s.subPeriods?.map(sp => ({
              ...sp,
              start: rescale(sp.start, oS, oSpan, nS, nSpan),
              end:   rescale(sp.end,   oS, oSpan, nS, nSpan),
            })),
          }))
          return { periodStart: start, periodEnd: end, stages }
        }),

      setAllStages: (stages) =>
        set(() => ({ stages, ...enabledBounds(stages) })),

      resetStages: () =>
        set((state) => {
          const sMs = toDate(state.periodStart).getTime()
          const span = toDate(state.periodEnd).getTime() - sMs
          const enIdx = state.stages.map((s, i) => s.enabled ? i : -1).filter(i => i >= 0)
          const n = enIdx.length
          let ei = 0
          const stages = state.stages.map((s, i) => {
            if (!s.enabled) return s
            const sRatio = ei / n
            const eRatio = (ei + 1) / n
            const isLast = ei === n - 1
            ei++
            return {
              ...s,
              start: toIso(sMs + Math.round(sRatio * span)),
              end:   isLast ? toIso(sMs + span) : toIso(sMs + Math.round(eRatio * span) - MS_DAY),
            }
          })
          return { stages }
        }),

      toggleNoOrder: () =>
        set((state) => {
          const idx = state.stages.findIndex(s => s.id === 'noorder')
          if (idx === -1) return state
          const noOrder = state.stages[idx]
          const wasEnabled = noOrder.enabled
          const dur = toDate(noOrder.end).getTime() - toDate(noOrder.start).getTime() + MS_DAY
          const delta = wasEnabled ? -dur : dur

          const stages = state.stages.map((s, i) => {
            if (i === idx) {
              if (!wasEnabled) {
                const prevEnd = toDate(state.stages[idx - 1].end).getTime()
                return { ...s, enabled: true, start: toIso(prevEnd + MS_DAY), end: toIso(prevEnd + dur) }
              }
              return { ...s, enabled: false }
            }
            if (i > idx) {
              return {
                ...s,
                start: toIso(toDate(s.start).getTime() + delta),
                end:   toIso(toDate(s.end).getTime()   + delta),
              }
            }
            return s
          })
          return { stages, ...enabledBounds(stages) }
        }),

      updateStage: (i, patch) =>
        set((s) => {
          const stages = s.stages.map((st, idx) => (idx === i ? { ...st, ...patch } : st))
          return { stages, ...enabledBounds(stages) }
        }),

      updateKeyDate: (stageIdx, key, date) =>
        set((s) => ({
          stages: s.stages.map((st, i) =>
            i !== stageIdx ? st : {
              ...st,
              keyDates: st.keyDates?.map(kd => kd.key === key ? { ...kd, date } : kd),
            }),
        })),

      updateSubPeriod: (stageIdx, key, patch) =>
        set((s) => ({
          stages: s.stages.map((st, i) =>
            i !== stageIdx ? st : {
              ...st,
              subPeriods: st.subPeriods?.map(sp => sp.key === key ? { ...sp, ...patch } : sp),
            }),
        })),

      setOpenDate: (dateStr) =>
        set((s) => {
          const mainIdx     = s.stages.findIndex(st => st.id === 'main')
          const presalesIdx = s.stages.findIndex(st => st.id === 'presales')
          if (mainIdx === -1) return s
          const mainSt      = s.stages[mainIdx]
          const newKeyDates = calcMainKeyDates(dateStr, mainSt.openDays ?? 3)
          const altDate     = newKeyDates.find(k => k.key === 'alt')?.date ?? mainSt.end
          const delta       = toDate(altDate).getTime() - toDate(mainSt.end).getTime()
          const stages = s.stages.map((st, i) => {
            if (i === presalesIdx)
              return { ...st, end: toIso(toDate(dateStr).getTime() - MS_DAY) }
            if (i === mainIdx)
              return { ...st, start: dateStr, end: altDate, keyDates: newKeyDates }
            if (i > mainIdx)
              return {
                ...st,
                start: toIso(toDate(st.start).getTime() + delta),
                end:   toIso(toDate(st.end).getTime()   + delta),
              }
            return st
          })
          return { stages, ...enabledBounds(stages) }
        }),

      setOpenDays: (days) =>
        set((s) => {
          const mainIdx = s.stages.findIndex(st => st.id === 'main')
          if (mainIdx === -1) return s
          const mainSt = s.stages[mainIdx]
          const openKd = mainSt.keyDates?.find(k => k.key === 'open')
          if (!openKd) return { ...s, stages: s.stages.map(st => st.id === 'main' ? { ...st, openDays: days } : st) }
          const newKeyDates = calcMainKeyDates(openKd.date, days)
          const altDate     = newKeyDates.find(k => k.key === 'alt')?.date ?? mainSt.end
          const delta       = toDate(altDate).getTime() - toDate(mainSt.end).getTime()
          const stages = s.stages.map((st, i) => {
            if (i === mainIdx) return { ...st, openDays: days, keyDates: newKeyDates, start: openKd.date, end: altDate }
            if (i > mainIdx)   return {
              ...st,
              start: toIso(toDate(st.start).getTime() + delta),
              end:   toIso(toDate(st.end).getTime()   + delta),
            }
            return st
          })
          return { stages, ...enabledBounds(stages) }
        }),

      addExtra: () => set((s) => ({ extras: [...s.extras, { name: '추가 근무일', days: 1 }] })),
      updateExtra: (i, patch) =>
        set((s) => ({ extras: s.extras.map((e, idx) => idx === i ? { ...e, ...patch } : e) })),
      removeExtra: (i) => set((s) => ({ extras: s.extras.filter((_, idx) => idx !== i) })),
    }),
    { name: 'ec-project-v5' },
  ),
)

export const periodDates = (s: { periodStart: string; periodEnd: string }) => ({
  start: toDate(s.periodStart),
  end: toDate(s.periodEnd),
})
