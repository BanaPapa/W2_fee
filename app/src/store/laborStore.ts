import { create } from 'zustand'
import type { Person, YMD } from '../lib/schedule'
import { ppdP, dayKeyOf, monthKeyOf } from '../lib/schedule'
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

const toYMD = (iso: string): YMD => {
  const [y, m, d] = iso.split('-').map(Number)
  return [y, m - 1, d]
}

const addDaysIso = (iso: string, days: number): string => {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + days)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

const fallbackYear = (): number =>
  Number(useProjectStore.getState().periodStart.split('-')[0]) || new Date().getFullYear()

/** new-hire fallback window when no stage/usagePeriod info is available */
const defaultFallbackPerson = (): Person => {
  const y = fallbackYear()
  return { s: [y, 6, 1], e: [y, 9, 31] }
}

/** default person period for new hires in the "기타_단기" section: the main-sales (본영업) window */
const mainStagePeriod = (): { s: YMD; e: YMD } | null => {
  const main = useProjectStore.getState().stages.find((st) => st.id === 'main')
  if (!main) return null
  return { s: toYMD(main.start), e: toYMD(main.end) }
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

/** usagePeriod 프리셋 → 실제 ISO 날짜 범위. 단계 정보가 없으면 null. ('open'은 연속 구간이 아니라 별도 처리) */
const usagePeriodISO = (usage: Exclude<UsagePeriod, 'open'>): { start: string; end: string } | null => {
  const proj = useProjectStore.getState()
  const main = proj.stages.find((st) => st.id === 'main')
  if (!main) return null
  switch (usage) {
    case 'all':
      return { start: proj.periodStart, end: proj.periodEnd }
    case 'presales':
      return { start: proj.periodStart, end: addDaysIso(main.start, -1) }
    case 'postsales':
      // 예당일 다음날부터 분양완료일까지 — 해를 넘어가도 그대로 전부 포함한다.
      return { start: addDaysIso(main.end, 1), end: proj.periodEnd }
  }
}

/**
 * '오픈' 사용기간: 연속 구간이 아니라 오픈 관련 특정 일자들만 근무일로 잡는다.
 * - 오픈기간 3일: 오픈전일 · 오픈일 · 오픈 다음날 · 오픈 다다음날 (4일)
 * - 오픈기간 10일: 오픈 8일전 ~ 5일전(4일) + 오픈일 · 다음날 · 다다음날(3일) = 총 7일
 * - 오픈기간(3/10)과 무관하게 정당계약 전체 기간과 예당일도 항상 추가로 포함
 * 그 사이(포함되지 않는) 날짜는 전부 비근무로 명시적으로 덮어써서, 근무기간(s~e)이
 * 넓어도 실제 근무일수는 위 특정 일자들뿐이도록 한다.
 */
const openUsagePerson = (): Person | null => {
  const main = useProjectStore.getState().stages.find((st) => st.id === 'main')
  if (!main) return null
  const openDate = main.keyDates?.find((k) => k.key === 'open')?.date
  const contractDate = main.keyDates?.find((k) => k.key === 'contract')?.date
  const altDate = main.keyDates?.find((k) => k.key === 'alt')?.date
  if (!openDate || !contractDate || !altDate) return null

  const openDays = main.openDays ?? 3
  const contractDays = main.contractDays ?? 3

  const dayKeyOfIso = (iso: string): string => {
    const [y, m, d] = toYMD(iso)
    return dayKeyOf(y, m, d)
  }

  const included = new Set<string>()
  const markRange = (startIso: string, days: number) => {
    for (let i = 0; i < days; i++) included.add(dayKeyOfIso(addDaysIso(startIso, i)))
  }

  let earliestIso: string
  if (openDays === 10) {
    earliestIso = addDaysIso(openDate, -8)
    markRange(earliestIso, 4) // 오픈 8일전 ~ 5일전
    markRange(openDate, 3) // 오픈일 · 다음날 · 다다음날
  } else {
    earliestIso = addDaysIso(openDate, -1)
    markRange(earliestIso, 4) // 오픈전일 ~ 오픈 다다음날
  }
  markRange(contractDate, contractDays) // 정당계약 전체 기간
  markRange(altDate, 1) // 예당일

  const startIso = earliestIso
  const endIso = altDate
  const ov: Record<string, boolean> = {}
  for (let cursor = startIso; ; cursor = addDaysIso(cursor, 1)) {
    const key = dayKeyOfIso(cursor)
    ov[key] = included.has(key)
    if (cursor === endIso) break
  }

  return { s: toYMD(startIso), e: toYMD(endIso), ov }
}

const usagePeriodPerson = (usage: UsagePeriod): Person | null => {
  if (usage === 'open') return openUsagePerson()
  const range = usagePeriodISO(usage)
  if (!range) return null
  const s = toYMD(range.start)
  const e = toYMD(range.end)
  // 사후: 근무 패턴(5/6/7일) 선택과 무관하게 항상 매일 근무(7일)로 찍는다
  if (usage === 'postsales') {
    const pat: Record<string, number> = {}
    let y = s[0]
    let m = s[1]
    const endKey = e[0] * 12 + e[1]
    while (y * 12 + m <= endKey) {
      pat[monthKeyOf(y, m)] = 7
      m++
      if (m > 11) { m = 0; y++ }
    }
    return { s, e, pat }
  }
  return { s, e }
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
  { name: '총괄 디렉터', daily: 420000, section: 'planning', people: [{ s: [2026, 6, 1], e: [2026, 9, 31] }] },
  {
    name: '기획 팀장',
    daily: 320000,
    section: 'planning',
    people: [
      { s: [2026, 6, 8], e: [2026, 9, 15] },
      { s: [2026, 6, 20], e: [2026, 9, 30] },
    ],
  },
  {
    name: '메인 기획자',
    daily: 240000,
    section: 'planning',
    people: [
      { s: [2026, 6, 15], e: [2026, 9, 31] },
      { s: [2026, 6, 15], e: [2026, 8, 31] },
      { s: [2026, 7, 1], e: [2026, 9, 31] },
    ],
  },
  {
    name: '상담 컨설턴트',
    daily: 180000,
    section: 'planning',
    people: [
      { s: [2026, 7, 1], e: [2026, 9, 10] },
      { s: [2026, 7, 1], e: [2026, 9, 30] },
      { s: [2026, 6, 20], e: [2026, 8, 31] },
      { s: [2026, 7, 8], e: [2026, 9, 10] },
      { s: [2026, 7, 1], e: [2026, 9, 10] },
      { s: [2026, 6, 15], e: [2026, 9, 15] },
      { s: [2026, 7, 1], e: [2026, 9, 30] },
      { s: [2026, 7, 8], e: [2026, 8, 31] },
    ],
  },
]

/**
 * usagePeriod가 지정된 직무는 분양기간(오픈일/오픈기간/정당계약기간 등) 설정이 바뀔 때마다
 * 즉시 재계산되어야 한다. 저장된 people의 s/e/ov를 항상 현재 분양기간 기준으로 다시 덮어쓴다.
 */
const resyncUsagePeriodRoles = (roles: Role[]): Role[] =>
  roles.map((r) => {
    if (!r.usagePeriod) return r
    const person = usagePeriodPerson(r.usagePeriod)
    if (!person) return r
    return { ...r, people: r.people.map(() => ({ ...person })) }
  })

/**
 * DB에는 연도 없이 월-일([month, day])만 저장된 예전 형식의 people이 남아있을 수 있다.
 * s/e가 2개짜리 배열이면 프로젝트 시작연도를 붙이고, pat/ov 키도 연도 없는 예전 형식
 * ("6", "8-15")이면 연도를 붙여 새 형식("2026-6", "2026-8-15")으로 변환한다.
 */
const migratePerson = (raw: unknown, year: number): Person => {
  const p = raw as { s: number[]; e: number[]; pat?: Record<string, number>; ov?: Record<string, boolean>; extraOv?: Record<number, number> }
  const migrateDate = (v: number[]): YMD => (v.length === 3 ? (v as YMD) : [year, v[0], v[1]])

  let pat: Record<string, number> | undefined
  if (p.pat) {
    pat = {}
    for (const k of Object.keys(p.pat)) {
      pat[k.includes('-') ? k : monthKeyOf(year, Number(k))] = p.pat[k]
    }
  }

  let ov: Record<string, boolean> | undefined
  if (p.ov) {
    ov = {}
    for (const k of Object.keys(p.ov)) {
      const parts = k.split('-')
      if (parts.length === 2) {
        const [m, d] = parts.map(Number)
        ov[dayKeyOf(year, m, d)] = p.ov[k]
      } else {
        ov[k] = p.ov[k]
      }
    }
  }

  return { s: migrateDate(p.s), e: migrateDate(p.e), pat, ov, extraOv: p.extraOv }
}

const migrateRoles = (roles: Role[]): Role[] => {
  const year = fallbackYear()
  return roles.map((r) => ({ ...r, people: r.people.map((p) => migratePerson(p, year)) }))
}

export const useLaborStore = create<LaborState>()(
    (set) => ({
      hydrated: false,
      roles: SEED,
      sectionNames: DEFAULT_SECTION_NAMES,
      hydrate: (doc) =>
        set({ hydrated: true, roles: resyncUsagePeriodRoles(migrateRoles(doc.roles)), sectionNames: doc.sectionNames }),
      addRole: (section) =>
        set((s) => {
          const count = s.roles.filter((r) => (r.section ?? 'planning') === section).length
          if (count >= 8) return s
          const defaultPerson: Person =
            section === 'other_short' ? mainStagePeriod() ?? defaultFallbackPerson() : defaultFallbackPerson()
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
              const np: Person = usagePeriodPerson(r.usagePeriod) ?? defaultFallbackPerson()
              return { ...r, people: [...r.people, np] }
            }
            if (r.section === 'other_short') {
              const np: Person = mainStagePeriod() ?? defaultFallbackPerson()
              return { ...r, people: [...r.people, np] }
            }
            const last = r.people[r.people.length - 1]
            const np: Person = last ? { s: [...last.s], e: [...last.e] } : defaultFallbackPerson()
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
            const person = usagePeriodPerson(usage)
            return {
              ...r,
              usagePeriod: usage,
              // 사후: 예당일 다음날 ~ 분양완료일 전 일정을 개별이 아닌 집합(인원 전체 공유)으로 표시
              costMode: usage === 'postsales' ? 'aggregate' : r.costMode,
              people: person ? r.people.map(() => ({ ...person })) : r.people,
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

/** 분양기간(단계/오픈일/오픈기간/정당계약기간 등) 변경 시, usagePeriod가 걸린 직무들을 즉시 재계산 */
useProjectStore.subscribe((state, prev) => {
  if (!useLaborStore.getState().hydrated) return
  const relevant =
    state.stages !== prev.stages || state.periodStart !== prev.periodStart || state.periodEnd !== prev.periodEnd
  if (!relevant) return
  const { roles } = useLaborStore.getState()
  if (!roles.some((r) => r.usagePeriod)) return
  useLaborStore.setState({ roles: resyncUsagePeriodRoles(roles) })
})

/* ---------- pure calc selectors ---------- */
export const personExtrasDays = (p: Person, extras: ExtraSlot[]): number =>
  extras.reduce((a, e, ei) => a + (p.extraOv?.[ei] ?? e.days), 0)

export const roleTotalDays = (r: Role, extras: ExtraSlot[]): number =>
  r.people.reduce((a, p) => a + ppdP(p) + personExtrasDays(p, extras), 0)

/** 인건비 산정에 쓰이는 순수 단가표 금액 (일 단가 × 일수). usagePeriod와 무관하게 항상 계산됨. */
export const roleUnitPriceValue = (r: Role, extras: ExtraSlot[]): number => r.daily * roleTotalDays(r, extras)

/** 사후(postsales) 직무는 인건비 자체에서는 0원 — 해당 금액은 식대로 전환되어 반영됨 (mealStore 참고) */
export const roleTotal = (r: Role, extras: ExtraSlot[]): number =>
  r.usagePeriod === 'postsales' ? 0 : roleUnitPriceValue(r, extras)

export const laborTotal = (roles: Role[], extras: ExtraSlot[]): number =>
  roles.reduce((a, r) => a + roleTotal(r, extras), 0)

/** total scheduled work-days across all people, used by meal auto-link */
export const laborWorkDays = (roles: Role[]): number =>
  roles.reduce((a, r) => a + r.people.reduce((b, p) => b + ppdP(p), 0), 0)

export const laborHeadcount = (roles: Role[]): number =>
  roles.reduce((a, r) => a + r.people.length, 0)
