import { create } from 'zustand'
import type { Person, YMD } from '../lib/schedule'
import { ppdP, dayKeyOf, monthKeyOf, monthWorkP, monthsOf } from '../lib/schedule'
import type { ExtraSlot } from './projectStore'
import { useProjectStore } from './projectStore'
import { api } from '../../convex/_generated/api'
import { persistMutation } from '../lib/convexClient'
import { debounce } from '../lib/debounce'

/** 인건비 카드 덱의 열 수 — 슬롯 행/열 계산과 화면 렌더링이 이 값을 공유한다 */
export const GRID_COLS = 5

export type Section = 'planning' | 'sales' | 'other'

export const DEFAULT_SECTION_NAMES: Record<Section, string> = {
  planning: '기획',
  sales: '영업',
  other: '기타',
}

/** 구버전 문서의 기타_단기/기타_장기 섹션은 '기타' 하나로 통합한다 */
const migrateSection = (s: string | undefined): Section =>
  s === 'sales' ? 'sales' : s === 'other' || s === 'other_short' || s === 'other_long' ? 'other' : 'planning'

const migrateSectionNames = (raw: Record<string, string>): Record<Section, string> => ({
  planning: raw.planning ?? DEFAULT_SECTION_NAMES.planning,
  sales: raw.sales ?? DEFAULT_SECTION_NAMES.sales,
  other: raw.other ?? DEFAULT_SECTION_NAMES.other,
})

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

/** default person period for new hires in the "기타" section: the main-sales (본영업) window */
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
  /**
   * 인건비 카드 덱에서의 고정 위치(0-based, row-major). 카드를 다른 칸으로 옮기면 이 값만
   * 바뀌고 다른 직무의 slot은 그대로 유지된다 — 옮긴 자리는 빈 칸으로 남고 뒤 카드가
   * 앞으로 당겨오지 않는다. 미설정이면 배열 순서를 그대로 slot으로 취급한다(구버전 호환).
   */
  slot?: number
  /** 인력 사용기간 프리셋. 미설정이면 자유롭게 개별 편집 (기존 동작) */
  usagePeriod?: UsagePeriod
  /** 인건비 산정방식. 미설정이면 개별(기존 동작)로 취급 */
  costMode?: CostMode
  /**
   * 집합(aggregate) 산정방식 전용: 특정 달의 투입 인원을 기본 인원수(people.length)와
   * 다르게 잡는 오버라이드. 키는 monthKeyOf(year, month0) 형식("2026-6").
   * 키가 없는 달은 people.length를 그대로 쓴다.
   */
  monthlyHeadcount?: Record<string, number>
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
  /** slot을 지정하면 그 칸에 정확히 배정하고, 생략하면 가장 작은 빈 슬롯에 배정한다 */
  addRole: (section: Section, slot?: number) => void
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
  setMonthHeadcount: (i: number, year: number, month: number, count: number) => void
  /**
   * 카드 덱에서 직무를 다른 행/빈 칸으로 옮긴다. 목표 행에서는 항상 그 행의 맨 앞 빈 자리에
   * 배치되고(왼쪽 정렬 유지), 원래 있던 행은 뒤 칸이 앞으로 당겨져 빈틈 없이 압축된다.
   */
  moveRoleToSlot: (i: number, slot: number) => void
  /** 같은 행 안에서 두 직무의 위치를 맞바꾼다(순서 변경). 다른 행끼리는 사용하지 않는다. */
  swapRoleSlots: (i: number, j: number) => void
  /**
   * 다른 행에 있는 카드를 beforeIdx 카드의 자리에 끼워 넣는다. beforeIdx와 그 뒤(같은 행,
   * 같은 칸 이상)의 카드들은 한 칸씩 오른쪽으로 밀린다. 목표 행이 이미 5장 꽉 찼으면
   * 아무 일도 하지 않는다. 원래 있던 행은 뒤 칸이 앞으로 당겨져 압축된다.
   */
  insertRoleBefore: (fromIdx: number, beforeIdx: number) => void
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
  const withFields = roles.map((r) => ({
    ...r,
    section: migrateSection(r.section),
    people: r.people.map((p) => migratePerson(p, year)),
  }))
  return assignMissingSlots(withFields)
}

/** slot이 없는(구버전) 직무들에게, 이미 쓰인 슬롯을 피해 가장 작은 빈 슬롯부터 순서대로 배정한다 */
const assignMissingSlots = (roles: Role[]): Role[] => {
  const used = new Set(roles.flatMap((r) => (r.slot != null ? [r.slot] : [])))
  let next = 0
  const nextFree = () => {
    while (used.has(next)) next++
    used.add(next)
    return next
  }
  return roles.map((r) => (r.slot != null ? r : { ...r, slot: nextFree() }))
}

/** 현재 쓰이지 않는 슬롯 중 가장 작은 값 — 새 직무 추가 시 배정 */
const nextFreeSlot = (roles: Role[]): number => {
  const used = new Set(roles.map((r, i) => r.slot ?? i))
  let n = 0
  while (used.has(n)) n++
  return n
}

const slotOf = (r: Role, idx: number): number => r.slot ?? idx
const rowOf = (slot: number): number => Math.floor(slot / GRID_COLS)

/** 해당 행에 있는 직무들을 원래 순서(열 오름차순) 그대로, 왼쪽부터 빈틈 없이 다시 채운다 */
const compactRow = (roles: Role[], row: number): Role[] => {
  const inRow = roles
    .map((r, idx) => ({ idx, slot: slotOf(r, idx) }))
    .filter(({ slot }) => rowOf(slot) === row)
    .sort((a, b) => a.slot - b.slot)
  const rowStart = row * GRID_COLS
  const newSlotByIdx = new Map(inRow.map(({ idx }, i) => [idx, rowStart + i]))
  return roles.map((r, idx) => (newSlotByIdx.has(idx) ? { ...r, slot: newSlotByIdx.get(idx) } : r))
}

export const useLaborStore = create<LaborState>()(
    (set) => ({
      hydrated: false,
      roles: SEED,
      sectionNames: DEFAULT_SECTION_NAMES,
      hydrate: (doc) =>
        set({
          hydrated: true,
          roles: resyncUsagePeriodRoles(migrateRoles(doc.roles)),
          sectionNames: migrateSectionNames(doc.sectionNames),
        }),
      addRole: (section, slot) =>
        set((s) => {
          const defaultPerson: Person =
            section === 'other' ? mainStagePeriod() ?? defaultFallbackPerson() : defaultFallbackPerson()
          return {
            roles: [
              ...s.roles,
              {
                name: '새 직무 ' + (s.roles.length + 1),
                daily: 200000,
                section,
                slot: slot ?? nextFreeSlot(s.roles),
                people: [defaultPerson],
              },
            ],
          }
        }),
      changeRoleSection: (i, section) =>
        set((s) => ({
          roles: s.roles.map((r, idx) => (idx === i ? { ...r, section } : r)),
        })),
      removeRole: (i) =>
        set((s) => {
          const removedSlot = slotOf(s.roles[i], i)
          const rest = s.roles.filter((_, idx) => idx !== i)
          return { roles: compactRow(rest, rowOf(removedSlot)) }
        }),
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
            if (r.section === 'other') {
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
            // 개별로 돌아가면 집합 전용 월별 인원 오버라이드는 의미가 없으므로 버린다
            return { ...r, costMode: mode, monthlyHeadcount: undefined }
          }),
        })),
      setMonthHeadcount: (i, year, month, count) =>
        set((s) => ({
          roles: s.roles.map((r, idx) => {
            if (idx !== i) return r
            const key = monthKeyOf(year, month)
            const next = { ...(r.monthlyHeadcount ?? {}) }
            if (count === r.people.length) {
              delete next[key]
            } else {
              next[key] = Math.max(0, count)
            }
            return { ...r, monthlyHeadcount: Object.keys(next).length > 0 ? next : undefined }
          }),
        })),
      moveRoleToSlot: (i, slot) =>
        set((s) => {
          const role = s.roles[i]
          if (!role) return s
          const fromSlot = slotOf(role, i)
          const fromRow = rowOf(fromSlot)
          const toRow = rowOf(slot)
          if (fromRow === toRow) return s // 같은 행 이동은 swapRoleSlots로 처리한다

          const occupantsInTargetRow = s.roles.filter((r, idx) => idx !== i && rowOf(slotOf(r, idx)) === toRow).length
          if (occupantsInTargetRow >= GRID_COLS) return s // 목표 행이 이미 가득 찼으면 옮길 수 없다
          // 목표 행에서는 어떤 빈 칸에 놓아도 그 행의 맨 앞 빈 자리(왼쪽 정렬)에 배치한다
          const actualSlot = toRow * GRID_COLS + occupantsInTargetRow

          let next = s.roles.map((r, idx) => (idx === i ? { ...r, slot: actualSlot } : r))
          next = compactRow(next, fromRow) // 원래 있던 행은 뒤 칸이 앞으로 당겨진다
          return { roles: next }
        }),
      swapRoleSlots: (i, j) =>
        set((s) => {
          const a = s.roles[i]
          const b = s.roles[j]
          if (!a || !b) return s
          const slotA = slotOf(a, i)
          const slotB = slotOf(b, j)
          if (rowOf(slotA) !== rowOf(slotB)) return s // 다른 행끼리는 맞바꾸지 않는다
          return {
            roles: s.roles.map((r, idx) =>
              idx === i ? { ...r, slot: slotB } : idx === j ? { ...r, slot: slotA } : r,
            ),
          }
        }),
      insertRoleBefore: (fromIdx, beforeIdx) =>
        set((s) => {
          const fromRole = s.roles[fromIdx]
          const beforeRole = s.roles[beforeIdx]
          if (!fromRole || !beforeRole) return s
          const fromSlot = slotOf(fromRole, fromIdx)
          const beforeSlot = slotOf(beforeRole, beforeIdx)
          const fromRow = rowOf(fromSlot)
          const targetRow = rowOf(beforeSlot)
          if (fromRow === targetRow) return s // 같은 행은 swapRoleSlots로 처리한다

          const occupantsInTargetRow = s.roles.filter((r, idx) => idx !== fromIdx && rowOf(slotOf(r, idx)) === targetRow).length
          if (occupantsInTargetRow >= GRID_COLS) return s // 목표 행이 이미 가득 찼으면 끼워 넣을 수 없다

          const targetCol = beforeSlot % GRID_COLS
          // beforeIdx와 그 뒤(같은 행, 같은 칸 이상)의 카드들을 한 칸씩 오른쪽으로 민다
          let next = s.roles.map((r, idx) => {
            if (idx === fromIdx) return r
            const slot = slotOf(r, idx)
            return rowOf(slot) === targetRow && slot % GRID_COLS >= targetCol ? { ...r, slot: slot + 1 } : r
          })
          next = next.map((r, idx) => (idx === fromIdx ? { ...r, slot: targetRow * GRID_COLS + targetCol } : r))
          next = compactRow(next, fromRow) // 원래 있던 행은 뒤 칸이 앞으로 당겨진다
          return { roles: next }
        }),
    }),
)

const pushLabor = debounce((state: LaborState) => {
  persistMutation(api.labor.set, { roles: state.roles, sectionNames: state.sectionNames })
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

/** 해당 (연, 월)에 이 직무가 투입하는 인원수. 집합 모드면 월별 오버라이드를 우선 적용. */
export const roleMonthHeadcount = (r: Role, year: number, month: number): number =>
  r.costMode === 'aggregate'
    ? r.monthlyHeadcount?.[monthKeyOf(year, month)] ?? r.people.length
    : r.people.length

/** 해당 (연, 월)의 총 근무 명·일 수. 집합 모드면 대표 일정 × 그 달 인원수. */
export const roleMonthDays = (r: Role, year: number, month: number): number => {
  if (r.costMode === 'aggregate') {
    const template = r.people[0]
    if (!template) return 0
    return monthWorkP(template, year, month) * roleMonthHeadcount(r, year, month)
  }
  return r.people.reduce((a, p) => a + monthWorkP(p, year, month), 0)
}

/** 추가 슬롯(extras)을 제외한 순수 스케줄 근무 명·일 수 */
export const roleScheduleDays = (r: Role): number => {
  if (r.costMode === 'aggregate') {
    const template = r.people[0]
    if (!template) return 0
    return monthsOf(template).reduce((a, { year, month }) => a + roleMonthDays(r, year, month), 0)
  }
  return r.people.reduce((a, p) => a + ppdP(p), 0)
}

export const roleTotalDays = (r: Role, extras: ExtraSlot[]): number =>
  roleScheduleDays(r) + r.people.reduce((a, p) => a + personExtrasDays(p, extras), 0)

/** 인건비 산정에 쓰이는 순수 단가표 금액 (일 단가 × 일수). usagePeriod와 무관하게 항상 계산됨. */
export const roleUnitPriceValue = (r: Role, extras: ExtraSlot[]): number => r.daily * roleTotalDays(r, extras)

/** 사후(postsales) 직무는 인건비 자체에서는 0원 — 해당 금액은 식대로 전환되어 반영됨 (mealStore 참고) */
export const roleTotal = (r: Role, extras: ExtraSlot[]): number =>
  r.usagePeriod === 'postsales' ? 0 : roleUnitPriceValue(r, extras)

export const laborTotal = (roles: Role[], extras: ExtraSlot[]): number =>
  roles.reduce((a, r) => a + roleTotal(r, extras), 0)

/** total scheduled work-days across all people, used by meal auto-link */
export const laborWorkDays = (roles: Role[]): number =>
  roles.reduce((a, r) => a + roleScheduleDays(r), 0)

export const laborHeadcount = (roles: Role[]): number =>
  roles.reduce((a, r) => a + r.people.length, 0)
