import { create } from 'zustand'
import type { Person } from '../lib/schedule'
import { ppdP } from '../lib/schedule'
import type { ExtraSlot } from './projectStore'
import { useProjectStore } from './projectStore'
import { api } from '../../convex/_generated/api'
import { convexClient } from '../lib/convexClient'
import { debounce } from '../lib/debounce'

export type Section = 'planning' | 'sales' | 'other_short' | 'other_long'

export const DEFAULT_SECTION_NAMES: Record<Section, string> = {
  planning: '기획',
  sales: '영업',
  other_short: '기타_단기',
  other_long: '기타_장기',
}

const toMD = (iso: string): [number, number] => {
  const [, m, d] = iso.split('-').map(Number)
  return [m - 1, d]
}

const addDaysIso = (iso: string, days: number): string => {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + days)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

/** default person period for new hires in the "기타_단기" section: the main-sales (본영업) window */
const mainStagePeriod = (): { s: [number, number]; e: [number, number] } | null => {
  const main = useProjectStore.getState().stages.find((st) => st.id === 'main')
  if (!main) return null
  return { s: toMD(main.start), e: toMD(main.end) }
}

/** 인력 사용기간 프리셋: 전체 / 사전 / 오픈 / 사후 */
export type UsagePeriod = 'all' | 'presales' | 'open' | 'postsales'
export const USAGE_PERIOD_LABELS: Record<UsagePeriod, string> = {
  all: '전체',
  presales: '사전',
  open: '오픈',
  postsales: '사후',
}

/** 인건비 산정방식: 개별(인원별 달력) / 집합(직무군 전체 1줄) */
export type CostMode = 'individual' | 'aggregate'

/** usagePeriod 프리셋 → 실제 ISO 날짜 범위. 단계 정보가 없으면 null. */
const usagePeriodISO = (usage: UsagePeriod): { start: string; end: string } | null => {
  const proj = useProjectStore.getState()
  const main = proj.stages.find((st) => st.id === 'main')
  if (!main) return null
  const rank1 = main.keyDates?.find((k) => k.key === 'rank1')?.date
  switch (usage) {
    case 'all':
      return { start: proj.periodStart, end: proj.periodEnd }
    case 'presales':
      return { start: proj.periodStart, end: addDaysIso(main.start, -1) }
    case 'open':
      return { start: addDaysIso(main.start, -1), end: rank1 ? addDaysIso(rank1, -1) : main.end }
    case 'postsales':
      return { start: addDaysIso(main.end, 1), end: proj.periodEnd }
  }
}

const usagePeriodMD = (usage: UsagePeriod): { s: [number, number]; e: [number, number] } | null => {
  const range = usagePeriodISO(usage)
  return range ? { s: toMD(range.start), e: toMD(range.end) } : null
}

export interface Role {
  name: string
  daily: number
  people: Person[]
  section: Section
  /** 인력 사용기간 프리셋. 미설정이면 자유롭게 개별 편집 (기존 동작) */
  usagePeriod?: UsagePeriod
  /** 인건비 산정방식. 미설정이면 개별(기존 동작)로 취급 */
  costMode?: CostMode
}

export interface LaborDoc {
  roles: Role[]
  sectionNames: Record<Section, string>
}

interface LaborState {
  hydrated: boolean
  roles: Role[]
  sectionNames: Record<Section, string>
  hydrate: (doc: LaborDoc) => void
  addRole: (section: Section) => void
  changeRoleSection: (i: number, section: Section) => void
  removeRole: (i: number) => void
  reorderRole: (from: number, to: number) => void
  renameRole: (i: number, name: string) => void
  setDaily: (i: number, daily: number) => void
  addPerson: (i: number) => void
  removePerson: (i: number) => void
  updatePerson: (roleI: number, personI: number, patch: Partial<Person>) => void
  renameSection: (section: Section, name: string) => void
  setRoleUsagePeriod: (i: number, usage: UsagePeriod | null) => void
  setRoleCostMode: (i: number, mode: CostMode) => void
}

// seeded from labor.html `roles`
const SEED: Role[] = [
  { name: '총괄 디렉터', daily: 420000, section: 'planning', people: [{ s: [6, 1], e: [9, 31] }] },
  {
    name: '기획 팀장',
    daily: 320000,
    section: 'planning',
    people: [
      { s: [6, 8], e: [9, 15] },
      { s: [6, 20], e: [9, 30] },
    ],
  },
  {
    name: '메인 기획자',
    daily: 240000,
    section: 'planning',
    people: [
      { s: [6, 15], e: [9, 31] },
      { s: [6, 15], e: [8, 31] },
      { s: [7, 1], e: [9, 31] },
    ],
  },
  {
    name: '상담 컨설턴트',
    daily: 180000,
    section: 'planning',
    people: [
      { s: [7, 1], e: [9, 10] },
      { s: [7, 1], e: [9, 30] },
      { s: [6, 20], e: [8, 31] },
      { s: [7, 8], e: [9, 10] },
      { s: [7, 1], e: [9, 10] },
      { s: [6, 15], e: [9, 15] },
      { s: [7, 1], e: [9, 30] },
      { s: [7, 8], e: [8, 31] },
    ],
  },
]

export const useLaborStore = create<LaborState>()(
    (set) => ({
      hydrated: false,
      roles: SEED,
      sectionNames: DEFAULT_SECTION_NAMES,
      hydrate: (doc) => set({ hydrated: true, roles: doc.roles, sectionNames: doc.sectionNames }),
      addRole: (section) =>
        set((s) => {
          const count = s.roles.filter((r) => (r.section ?? 'planning') === section).length
          if (count >= 8) return s
          const defaultPerson: Person =
            section === 'other_short' ? mainStagePeriod() ?? { s: [6, 1], e: [9, 31] } : { s: [6, 1], e: [9, 31] }
          return {
            roles: [
              ...s.roles,
              { name: '새 직무 ' + (s.roles.length + 1), daily: 200000, section, people: [defaultPerson] },
            ],
          }
        }),
      changeRoleSection: (i, section) =>
        set((s) => ({
          roles: s.roles.map((r, idx) => (idx === i ? { ...r, section } : r)),
        })),
      removeRole: (i) => set((s) => ({ roles: s.roles.filter((_, idx) => idx !== i) })),
      reorderRole: (from, to) =>
        set((s) => {
          const roles = [...s.roles]
          const [item] = roles.splice(from, 1)
          roles.splice(to, 0, item)
          return { roles }
        }),
      renameRole: (i, name) =>
        set((s) => ({ roles: s.roles.map((r, idx) => (idx === i ? { ...r, name } : r)) })),
      setDaily: (i, daily) =>
        set((s) => ({ roles: s.roles.map((r, idx) => (idx === i ? { ...r, daily } : r)) })),
      addPerson: (i) =>
        set((s) => ({
          roles: s.roles.map((r, idx) => {
            if (idx !== i) return r
            if (r.costMode === 'aggregate' && r.people.length > 0) {
              return { ...r, people: [...r.people, { ...r.people[0] }] }
            }
            if (r.usagePeriod) {
              const np: Person = usagePeriodMD(r.usagePeriod) ?? { s: [6, 1], e: [9, 31] }
              return { ...r, people: [...r.people, np] }
            }
            if (r.section === 'other_short') {
              const np: Person = mainStagePeriod() ?? { s: [6, 1], e: [9, 31] }
              return { ...r, people: [...r.people, np] }
            }
            const last = r.people[r.people.length - 1]
            const np: Person = last ? { s: [...last.s], e: [...last.e] } : { s: [6, 1], e: [9, 31] }
            return { ...r, people: [...r.people, np] }
          }),
        })),
      removePerson: (i) =>
        set((s) => ({
          roles: s.roles.map((r, idx) =>
            idx === i && r.people.length > 0 ? { ...r, people: r.people.slice(0, -1) } : r,
          ),
        })),
      updatePerson: (roleI, personI, patch) =>
        set((s) => ({
          roles: s.roles.map((r, idx) => {
            if (idx !== roleI) return r
            if (r.costMode === 'aggregate') {
              return { ...r, people: r.people.map((p) => ({ ...p, ...patch })) }
            }
            return { ...r, people: r.people.map((p, pi) => (pi === personI ? { ...p, ...patch } : p)) }
          }),
        })),
      renameSection: (section, name) =>
        set((s) => ({ sectionNames: { ...s.sectionNames, [section]: name } })),
      setRoleUsagePeriod: (i, usage) =>
        set((s) => ({
          roles: s.roles.map((r, idx) => {
            if (idx !== i) return r
            if (usage === null) return { ...r, usagePeriod: undefined }
            const md = usagePeriodMD(usage)
            return {
              ...r,
              usagePeriod: usage,
              people: md ? r.people.map(() => ({ s: md.s, e: md.e })) : r.people,
            }
          }),
        })),
      setRoleCostMode: (i, mode) =>
        set((s) => ({
          roles: s.roles.map((r, idx) => {
            if (idx !== i) return r
            if (mode === 'aggregate' && r.people.length > 0) {
              const template = r.people[0]
              return { ...r, costMode: mode, people: r.people.map(() => ({ ...template })) }
            }
            return { ...r, costMode: mode }
          }),
        })),
    }),
)

const pushLabor = debounce((state: LaborState) => {
  convexClient.mutation(api.labor.set, { roles: state.roles, sectionNames: state.sectionNames })
}, 400)

useLaborStore.subscribe((state, prev) => {
  if (!prev.hydrated) return
  pushLabor(state)
})

/* ---------- pure calc selectors ---------- */
export const personExtrasDays = (p: Person, extras: ExtraSlot[]): number =>
  extras.reduce((a, e, ei) => a + (p.extraOv?.[ei] ?? e.days), 0)

export const roleTotalDays = (r: Role, extras: ExtraSlot[]): number =>
  r.people.reduce((a, p) => a + ppdP(p) + personExtrasDays(p, extras), 0)

export const roleTotal = (r: Role, extras: ExtraSlot[]): number => r.daily * roleTotalDays(r, extras)

export const laborTotal = (roles: Role[], extras: ExtraSlot[]): number =>
  roles.reduce((a, r) => a + roleTotal(r, extras), 0)

/** total scheduled work-days across all people, used by meal auto-link */
export const laborWorkDays = (roles: Role[]): number =>
  roles.reduce((a, r) => a + r.people.reduce((b, p) => b + ppdP(p), 0), 0)

export const laborHeadcount = (roles: Role[]): number =>
  roles.reduce((a, r) => a + r.people.length, 0)
