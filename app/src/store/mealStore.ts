import { create } from 'zustand'
import { roleUnitPriceValue, roleScheduleDays, type Role } from './laborStore'
import type { ExtraSlot } from './projectStore'
import { api } from '../../convex/_generated/api'
import { persistMutation } from '../lib/convexClient'
import { debounce } from '../lib/debounce'

export const DEFAULT_MEAL_TAB_NAMES: Record<string, string> = {
  lunch: '중식비',
  dinner: '석식비',
  woesing: '회식',
  postsales: '조직 일비',
}

export interface MealDoc {
  lunchPerDay: number
  dinnerPerDay: number
  woesing: number
  dinnerRoleOverrides: Record<string, boolean>
  /** 탭 카드 이름 오버라이드 (더블클릭으로 수정). 없으면 기본 이름 사용 */
  tabNames?: Record<string, string>
}

export interface MealState extends MealDoc {
  tabNames: Record<string, string>
  hydrated: boolean
  hydrate: (doc: MealDoc) => void
  setLunch: (v: number) => void
  setDinner: (v: number) => void
  setWoesing: (v: number) => void
  setDinnerRoleOverride: (name: string, val: boolean) => void
  resetDinnerOverrides: () => void
  renameTab: (id: string, name: string) => void
}

export const useMealStore = create<MealState>()(
    (set) => ({
      hydrated: false,
      lunchPerDay: 9000,
      dinnerPerDay: 12000,
      woesing: 1000000,
      dinnerRoleOverrides: {},
      tabNames: {},
      hydrate: (doc) => set({ hydrated: true, ...doc, tabNames: doc.tabNames ?? {} }),
      setLunch: (v) => set({ lunchPerDay: v }),
      setDinner: (v) => set({ dinnerPerDay: v }),
      setWoesing: (v) => set({ woesing: v }),
      setDinnerRoleOverride: (name, val) =>
        set((s) => ({ dinnerRoleOverrides: { ...s.dinnerRoleOverrides, [name]: val } })),
      resetDinnerOverrides: () => set({ dinnerRoleOverrides: {} }),
      renameTab: (id, name) =>
        set((s) => ({ tabNames: { ...s.tabNames, [id]: name } })),
    }),
)

export const mealTabName = (tabNames: Record<string, string>, id: string): string =>
  tabNames[id]?.trim() || DEFAULT_MEAL_TAB_NAMES[id] || id

const pushMeal = debounce((state: MealState) => {
  persistMutation(api.meal.set, {
    lunchPerDay: state.lunchPerDay,
    dinnerPerDay: state.dinnerPerDay,
    woesing: state.woesing,
    dinnerRoleOverrides: state.dinnerRoleOverrides,
    tabNames: state.tabNames,
  })
}, 400)

useMealStore.subscribe((state, prev) => {
  if (!prev.hydrated) return
  pushMeal(state)
})

export const isDinnerRole = (role: Role, overrides: Record<string, boolean>): boolean => {
  if (role.name in overrides) return overrides[role.name]
  return (role.section ?? 'planning') === 'planning'
}

/** 사후(postsales) 직무는 인건비에서 0원 처리되는 대신, 단가표 금액이 식대로 전환되어 반영됨 */
export const postsalesRoles = (roles: Role[]): Role[] => roles.filter((r) => r.usagePeriod === 'postsales')

export const postsalesMealAmount = (roles: Role[], extras: ExtraSlot[]): number =>
  postsalesRoles(roles).reduce((a, r) => a + roleUnitPriceValue(r, extras), 0)

export const mealTotal = (
  s: Pick<MealState, 'lunchPerDay' | 'dinnerPerDay' | 'woesing' | 'dinnerRoleOverrides'>,
  roles: Role[],
  operatingMonths: number,
  extras: ExtraSlot[],
): number => {
  const lunchDays = roles.reduce((a, r) => a + roleScheduleDays(r), 0)
  const dinnerDays = roles
    .filter((r) => isDinnerRole(r, s.dinnerRoleOverrides))
    .reduce((a, r) => a + roleScheduleDays(r), 0)
  return (
    s.lunchPerDay * lunchDays +
    s.dinnerPerDay * dinnerDays +
    s.woesing * operatingMonths +
    postsalesMealAmount(roles, extras)
  )
}
