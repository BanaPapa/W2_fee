import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { ppdP } from '../lib/schedule'
import type { Role } from './laborStore'

export interface MealState {
  lunchPerDay: number
  dinnerPerDay: number
  woesing: number
  dinnerRoleOverrides: Record<string, boolean>
  setLunch: (v: number) => void
  setDinner: (v: number) => void
  setWoesing: (v: number) => void
  setDinnerRoleOverride: (name: string, val: boolean) => void
  resetDinnerOverrides: () => void
}

export const useMealStore = create<MealState>()(
  persist(
    (set) => ({
      lunchPerDay: 9000,
      dinnerPerDay: 12000,
      woesing: 1000000,
      dinnerRoleOverrides: {},
      setLunch: (v) => set({ lunchPerDay: v }),
      setDinner: (v) => set({ dinnerPerDay: v }),
      setWoesing: (v) => set({ woesing: v }),
      setDinnerRoleOverride: (name, val) =>
        set((s) => ({ dinnerRoleOverrides: { ...s.dinnerRoleOverrides, [name]: val } })),
      resetDinnerOverrides: () => set({ dinnerRoleOverrides: {} }),
    }),
    { name: 'ec-meal' },
  ),
)

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
