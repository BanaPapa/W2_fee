import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Person } from '../lib/schedule'
import { ppdP } from '../lib/schedule'
import type { ExtraSlot } from './projectStore'

export type Section = 'planning' | 'sales' | 'other'

export const DEFAULT_SECTION_NAMES: Record<Section, string> = {
  planning: '기획',
  sales: '영업',
  other: '기타',
}

export interface Role {
  name: string
  daily: number
  people: Person[]
  section: Section
}

interface LaborState {
  roles: Role[]
  sectionNames: Record<Section, string>
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
  persist(
    (set) => ({
      roles: SEED,
      sectionNames: { planning: '기획', sales: '영업', other: '기타' },
      addRole: (section) =>
        set((s) => {
          const count = s.roles.filter((r) => (r.section ?? 'planning') === section).length
          if (count >= 8) return s
          return {
            roles: [
              ...s.roles,
              { name: '새 직무 ' + (s.roles.length + 1), daily: 200000, section, people: [{ s: [6, 1], e: [9, 31] }] },
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
          roles: s.roles.map((r, idx) =>
            idx === roleI
              ? { ...r, people: r.people.map((p, pi) => (pi === personI ? { ...p, ...patch } : p)) }
              : r,
          ),
        })),
      renameSection: (section, name) =>
        set((s) => ({ sectionNames: { ...s.sectionNames, [section]: name } })),
    }),
    { name: 'ec-labor' },
  ),
)

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
