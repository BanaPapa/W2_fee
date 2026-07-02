import { create } from 'zustand'
import { ppdP } from '../lib/schedule'
import type { Role } from './laborStore'
import { api } from '../../convex/_generated/api'
import { convexClient } from '../lib/convexClient'
import { debounce } from '../lib/debounce'

export interface MealDoc {
  lunchPerDay: number
  dinnerPerDay: number
  woesing: number
  dinnerRoleOverrides: Record<string, boolean>
}

export interface MealState extends MealDoc {
  hydrated: boolean
  hydrate: (doc: MealDoc) => void
  setLunch: (v: number) => void
  setDinner: (v: number) => void
  setWoesing: (v: number) => void
  setDinnerRoleOverride: (name: string, val: boolean) => void
  resetDinnerOverrides: () => void
}

export const useMealStore = create<MealState>()(
    (set) => ({
      hydrated: false,
      lunchPerDay: 9000,
      dinnerPerDay: 12000,
      woesing: 1000000,
      dinnerRoleOverrides: {},
      hydrate: (doc) => set({ hydrated: true, ...doc }),
      setLunch: (v) => set({ lunchPerDay: v }),
      setDinner: (v) => set({ dinnerPerDay: v }),
      setWoesing: (v) => set({ woesing: v }),
      setDinnerRoleOverride: (name, val) =>
        set((s) => ({ dinnerRoleOverrides: { ...s.dinnerRoleOverrides, [name]: val } })),
      resetDinnerOverrides: () => set({ dinnerRoleOverrides: {} }),
    }),
)

const pushMeal = debounce((state: MealState) => {
  convexClient.mutation(api.meal.set, {
    lunchPerDay: state.lunchPerDay,
    dinnerPerDay: state.dinnerPerDay,
    woesing: state.woesing,
    dinnerRoleOverrides: state.dinnerRoleOverrides,
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

export const mealTotal = (
  s: Pick<MealState, 'lunchPerDay' | 'dinnerPerDay' | 'woesing' | 'dinnerRoleOverrides'>,
  roles: Role[],
  operatingMonths: number,
): number => {
  const lunchDays = roles.reduce((a, r) => a + r.people.reduce((b, p) => b + ppdP(p), 0), 0)
  const dinnerDays = roles
    .filter((r) => isDinnerRole(r, s.dinnerRoleOverrides))
    .reduce((a, r) => a + r.people.reduce((b, p) => b + ppdP(p), 0), 0)
  return s.lunchPerDay * lunchDays + s.dinnerPerDay * dinnerDays + s.woesing * operatingMonths
}
