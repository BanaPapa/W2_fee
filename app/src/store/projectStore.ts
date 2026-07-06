import { create } from 'zustand'
import { api } from '../../convex/_generated/api'
import { persistMutation } from '../lib/convexClient'
import { debounce } from '../lib/debounce'

export interface ExtraSlot { name: string; days: number }

export interface KeyDate { key: string; label: string; date: string }
export interface SubPeriod { key: string; label: string; start: string; end: string }

export interface EventBlock {
  id: string
  name: string
  enabled: boolean
  days: number
  daysOptions: number[]
}

export interface Stage {
  id: string
  name: string
  start: string
  end: string
  color: string
  enabled: boolean
  durationDays?: number
  openDays?: 3 | 10       // 본 영업 오픈 기간
  contractDays?: number   // 정당계약 기간 (기본 3일)
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

// 주어진 날짜가 속한 일~토 주간의 토요일(당일 포함, 최대 6일 뒤)을 반환한다.
export const nextSaturdayOfWeek = (ms: number): number => {
  const dow = new Date(ms).getDay()
  return ms + ((6 - dow + 7) % 7) * MS_DAY
}

// openDays: 3일 오픈 → 특공+1=1순위 on open+4; 10일 → 1순위 on open+11
export const calcMainKeyDates = (openDateStr: string, openDays: 3 | 10 = 3, contractDays: number = 3): KeyDate[] => {
  const o = toDate(openDateStr).getTime()
  const r1     = openDays + 1     // 1순위: 오픈+openDays(특공일)+1
  const win    = r1 + 7           // 당발: 1순위 접수일과 같은 요일 다음주(1순위+7)
  const con    = win + 11         // 계약: 당발+11(최소값, 상황에 따라 더 늦출 수 있음)
  const conEnd = con + contractDays - 1  // 정당계약 마지막 날
  // 예당: 정당계약이 끝난 그 주(일~토)의 토요일부터 시작 (다음날 바로 시작하는 경우는 드묾)
  const altMs  = nextSaturdayOfWeek(o + conEnd * MS_DAY)
  return [
    { key: 'open',     label: '오픈일',     date: openDateStr },
    { key: 'rank1',    label: '1순위',      date: toIso(o + r1  * MS_DAY) },
    { key: 'winner',   label: '당첨자발표', date: toIso(o + win * MS_DAY) },
    { key: 'contract', label: '정당계약',   date: toIso(o + con * MS_DAY) },
    { key: 'alt',      label: '예당계약',   date: toIso(altMs) },
  ]
}

// 법령상 모집공고일로부터 10일 뒤부터 청약(특공/1순위/2순위)을 받을 수 있다.
// 즉 "오픈기간 종료일 = 모집공고일 + 10일"은 openDays(3/10)와 무관하게 항상 고정이고,
// 오픈일(오픈기간 시작일)만 그 종료일에서 openDays만큼 거슬러 올라간 자리에 놓인다.
//   오픈기간 종료일 = 오픈일 + openDays - 1
//   모집공고일      = 오픈기간 종료일 - 10 = 오픈일 + openDays - 11
export const calcAnnounceDate = (openDateStr: string, openDays: 3 | 10 = 3): string =>
  toIso(toDate(openDateStr).getTime() + (openDays - 11) * MS_DAY)

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
    start: '2026-06-01', end: '2026-07-02',   // end = 오픈일 전날 (사전영업은 모집공고 이후에도 계속됨)
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
    contractDays: 3,
    keyDates: calcMainKeyDates('2026-07-03', 3, 3),
  },
  {
    id: 'noorder', name: '무순위',
    start: '2026-07-30', end: '2026-08-20',   // 21일 표시 (end - start = 21)
    color: 'violet', enabled: false,
  },
  {
    id: 'postsales', name: '사후영업',
    start: '2026-07-30', end: '2026-08-31',
    color: 'slate', enabled: true,
  },
]

export interface ProjectDoc {
  title: string
  pm: string
  periodStart: string
  periodEnd: string
  extras: ExtraSlot[]
  stages: Stage[]
  eventBlocks: EventBlock[]
}

interface ProjectState {
  hydrated: boolean
  periodStart: string
  periodEnd: string
  extras: ExtraSlot[]
  stages: Stage[]
  eventBlocks: EventBlock[]
  project: { title: string; pm: string }
  hydrate: (doc: ProjectDoc) => void
  setPeriod: (start: string, end: string) => void
  setAllStages: (stages: Stage[]) => void
  toggleNoOrder: () => void
  updateStage: (i: number, patch: Partial<Stage>) => void
  updateKeyDate: (stageIdx: number, key: string, date: string) => void
  updateSubPeriod: (stageIdx: number, key: string, patch: Partial<SubPeriod>) => void
  setOpenDate: (dateStr: string) => void
  setOpenDays: (days: 3 | 10) => void
  setContractDays: (days: number) => void
  setEventBlockEnabled: (id: string, enabled: boolean) => void
  setEventBlockDays: (id: string, days: number) => void
  addExtra: () => void
  updateExtra: (i: number, patch: Partial<ExtraSlot>) => void
  removeExtra: (i: number) => void
}

export const useProjectStore = create<ProjectState>()(
    (set) => ({
      hydrated: false,
      periodStart: '2026-06-01',
      periodEnd: '2026-11-14',
      extras: [],
      stages: DEFAULT_STAGES,
      eventBlocks: [
        { id: 'union_contract',  name: '조합계약',   enabled: false, days: 5, daysOptions: [3, 5, 7, 14] },
        { id: 'option_contract', name: '옵션계약',   enabled: false, days: 3, daysOptions: [1, 3, 5, 7] },
        { id: 'interim_sign',    name: '중도금 자서', enabled: false, days: 3, daysOptions: [1, 3, 5, 7] },
      ],
      project: { title: '강남 리버파크 분양 제안', pm: '김서연 PM' },

      hydrate: (doc) =>
        set({
          hydrated: true,
          periodStart: doc.periodStart,
          periodEnd: doc.periodEnd,
          extras: doc.extras,
          stages: doc.stages,
          eventBlocks: doc.eventBlocks,
          project: { title: doc.title, pm: doc.pm },
        }),

      setPeriod: (start, end) =>
        set((state) => {
          if (!start || !end || toDate(end) <= toDate(start)) return state
          const oS = toDate(state.periodStart).getTime()
          const oSpan = Math.max(1, toDate(state.periodEnd).getTime() - oS)
          const nS = toDate(start).getTime()
          const nSpan = Math.max(1, toDate(end).getTime() - nS)
          const en = state.stages.filter(s => s.enabled)
          const firstId = en[0]?.id
          const lastId = en[en.length - 1]?.id

          // 1) 비율에 맞춰 대략적인 새 날짜를 계산한다.
          const rough = state.stages.map((s) => ({
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

          // 2) 각 날짜를 독립적으로 반올림하면 하루 겹치거나 비는 경우가 생기므로,
          //    활성화된 단계끼리 정수 일 단위로 이어붙여 항상 맞닿게 만든다.
          const stages = [...rough]
          let prevEnd = toDate(stages[0].end).getTime()
          for (let i = 1; i < stages.length; i++) {
            const cur = stages[i]
            if (!cur.enabled) continue
            const newStartMs = prevEnd + MS_DAY
            const isLastEnabled = cur.id === lastId
            if (cur.id === 'main') {
              const newKDs  = calcMainKeyDates(toIso(newStartMs), cur.openDays ?? 3, cur.contractDays ?? 3)
              const altDate = newKDs.find(k => k.key === 'alt')?.date ?? cur.end
              stages[i] = { ...cur, start: toIso(newStartMs), end: altDate, keyDates: newKDs }
            } else {
              const durMs = Math.max(0, toDate(cur.end).getTime() - toDate(cur.start).getTime())
              stages[i] = {
                ...cur,
                start: toIso(newStartMs),
                end: isLastEnabled ? end : toIso(newStartMs + durMs),
              }
            }
            prevEnd = toDate(stages[i].end).getTime()
          }

          return { periodStart: start, periodEnd: end, stages }
        }),

      setAllStages: (stages) =>
        set(() => ({ stages, ...enabledBounds(stages) })),

      toggleNoOrder: () =>
        set((state) => {
          const idx = state.stages.findIndex(s => s.id === 'noorder')
          if (idx === -1) return state
          const noOrder = state.stages[idx]
          const wasEnabled = noOrder.enabled
          // 비활성화 시: 실제 저장된 기간만큼 되돌림
          // 활성화 시: 항상 21일 표시 (end = start + 21 days, dur = 22 * MS_DAY)
          const existingDur = toDate(noOrder.end).getTime() - toDate(noOrder.start).getTime() + MS_DAY
          const ENABLE_DUR  = 22 * MS_DAY  // start+21일 = 21일 표시
          const delta = wasEnabled ? -existingDur : ENABLE_DUR

          const stages = state.stages.map((s, i) => {
            if (i === idx) {
              if (!wasEnabled) {
                const prevEnd = toDate(state.stages[idx - 1].end).getTime()
                return { ...s, enabled: true, start: toIso(prevEnd + MS_DAY), end: toIso(prevEnd + ENABLE_DUR) }
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
          if (!dateStr) return s
          const d = toDate(dateStr)
          if (d < toDate(s.periodStart) || d > toDate(s.periodEnd)) return s
          const mainIdx     = s.stages.findIndex(st => st.id === 'main')
          const presalesIdx = s.stages.findIndex(st => st.id === 'presales')
          if (mainIdx === -1) return s
          const mainSt      = s.stages[mainIdx]
          const newKeyDates = calcMainKeyDates(dateStr, mainSt.openDays ?? 3, mainSt.contractDays ?? 3)
          const altDate     = newKeyDates.find(k => k.key === 'alt')?.date ?? mainSt.end
          const delta       = toDate(altDate).getTime() - toDate(mainSt.end).getTime()
          const lastEnabledId = s.stages.filter(st => st.enabled).slice(-1)[0]?.id
          // 사전영업은 모집공고 이후에도 오픈일 직전까지 계속되므로, 사전영업의 실제 기간(end)은
          // 오픈일에 맞춰 그대로 이어지고, 모집공고일은 (본영업 쪽에서) 별도 마커로만 표시한다.
          const stages = s.stages.map((st, i) => {
            if (i === presalesIdx)
              return { ...st, end: toIso(toDate(dateStr).getTime() - MS_DAY) }
            if (i === mainIdx)
              return { ...st, start: dateStr, end: altDate, keyDates: newKeyDates }
            if (i > mainIdx)
              return st.id === lastEnabledId
                ? { ...st, start: toIso(toDate(st.start).getTime() + delta), end: s.periodEnd }
                : { ...st, start: toIso(toDate(st.start).getTime() + delta), end: toIso(toDate(st.end).getTime() + delta) }
            return st
          })
          return { stages }
        }),

      setOpenDays: (days) =>
        set((s) => {
          const mainIdx = s.stages.findIndex(st => st.id === 'main')
          if (mainIdx === -1) return s
          const mainSt = s.stages[mainIdx]
          const openKd = mainSt.keyDates?.find(k => k.key === 'open')
          if (!openKd) return { ...s, stages: s.stages.map(st => st.id === 'main' ? { ...st, openDays: days } : st) }
          const newKeyDates = calcMainKeyDates(openKd.date, days, mainSt.contractDays ?? 3)
          const altDate     = newKeyDates.find(k => k.key === 'alt')?.date ?? mainSt.end
          const delta       = toDate(altDate).getTime() - toDate(mainSt.end).getTime()
          const lastEnabledId = s.stages.filter(st => st.enabled).slice(-1)[0]?.id
          const stages = s.stages.map((st, i) => {
            if (i === mainIdx) return { ...st, openDays: days, keyDates: newKeyDates, start: openKd.date, end: altDate }
            if (i > mainIdx) return st.id === lastEnabledId
              ? { ...st, start: toIso(toDate(st.start).getTime() + delta), end: s.periodEnd }
              : { ...st, start: toIso(toDate(st.start).getTime() + delta), end: toIso(toDate(st.end).getTime() + delta) }
            return st
          })
          return { stages }
        }),

      setContractDays: (days) =>
        set((s) => {
          const mainIdx = s.stages.findIndex(st => st.id === 'main')
          if (mainIdx === -1) return s
          const mainSt = s.stages[mainIdx]
          const openKd = mainSt.keyDates?.find(k => k.key === 'open')
          if (!openKd) return { ...s, stages: s.stages.map(st => st.id === 'main' ? { ...st, contractDays: days } : st) }
          const newKeyDates = calcMainKeyDates(openKd.date, mainSt.openDays ?? 3, days)
          const altDate = newKeyDates.find(k => k.key === 'alt')?.date ?? mainSt.end
          const delta = toDate(altDate).getTime() - toDate(mainSt.end).getTime()
          const lastEnabledId = s.stages.filter(st => st.enabled).slice(-1)[0]?.id
          const stages = s.stages.map((st, i) => {
            if (i === mainIdx) return { ...st, contractDays: days, keyDates: newKeyDates, end: altDate }
            if (i > mainIdx) return st.id === lastEnabledId
              ? { ...st, start: toIso(toDate(st.start).getTime() + delta), end: s.periodEnd }
              : { ...st, start: toIso(toDate(st.start).getTime() + delta), end: toIso(toDate(st.end).getTime() + delta) }
            return st
          })
          return { stages }
        }),

      setEventBlockEnabled: (id, enabled) =>
        set((s) => ({ eventBlocks: s.eventBlocks.map(eb => eb.id === id ? { ...eb, enabled } : eb) })),

      setEventBlockDays: (id, days) =>
        set((s) => ({ eventBlocks: s.eventBlocks.map(eb => eb.id === id ? { ...eb, days } : eb) })),

      addExtra: () => set((s) => ({ extras: [...s.extras, { name: '추가 근무일', days: 1 }] })),
      updateExtra: (i, patch) =>
        set((s) => ({ extras: s.extras.map((e, idx) => idx === i ? { ...e, ...patch } : e) })),
      removeExtra: (i) => set((s) => ({ extras: s.extras.filter((_, idx) => idx !== i) })),
    }),
)

const pushProject = debounce((state: ProjectState) => {
  persistMutation(api.project.set, {
    title: state.project.title,
    pm: state.project.pm,
    periodStart: state.periodStart,
    periodEnd: state.periodEnd,
    extras: state.extras,
    stages: state.stages,
    eventBlocks: state.eventBlocks,
  })
}, 400)

useProjectStore.subscribe((state, prev) => {
  if (!prev.hydrated) return
  pushProject(state)
})

export const periodDates = (s: { periodStart: string; periodEnd: string }) => ({
  start: toDate(s.periodStart),
  end: toDate(s.periodEnd),
})
