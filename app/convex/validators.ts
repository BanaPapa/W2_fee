import { v } from 'convex/values'

export const keyDate = v.object({ key: v.string(), label: v.string(), date: v.string() })
export const subPeriod = v.object({ key: v.string(), label: v.string(), start: v.string(), end: v.string() })

export const stage = v.object({
  id: v.string(),
  name: v.string(),
  start: v.string(),
  end: v.string(),
  color: v.string(),
  enabled: v.boolean(),
  durationDays: v.optional(v.number()),
  openDays: v.optional(v.union(v.literal(3), v.literal(10))),
  contractDays: v.optional(v.number()),
  keyDates: v.optional(v.array(keyDate)),
  subPeriods: v.optional(v.array(subPeriod)),
})

export const eventBlock = v.object({
  id: v.string(),
  name: v.string(),
  enabled: v.boolean(),
  days: v.number(),
  daysOptions: v.array(v.number()),
})

export const extraSlot = v.object({ name: v.string(), days: v.number() })

export const person = v.object({
  s: v.array(v.number()),
  e: v.array(v.number()),
  pat: v.optional(v.record(v.string(), v.number())),
  ov: v.optional(v.record(v.string(), v.boolean())),
  extraOv: v.optional(v.record(v.string(), v.number())),
})

export const role = v.object({
  name: v.string(),
  daily: v.number(),
  people: v.array(person),
  section: v.union(v.literal('planning'), v.literal('sales'), v.literal('other')),
})

export const lineItem = v.object({
  id: v.string(),
  name: v.string(),
  amount: v.number(),
  qty: v.number(),
  period: v.string(),
  type: v.union(v.literal('1회성'), v.literal('일별'), v.literal('월별'), v.literal('수동')),
  status: v.union(v.literal('확정'), v.literal('검토중'), v.literal('작성중')),
})
