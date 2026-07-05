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
  section: v.union(v.literal('planning'), v.literal('sales'), v.literal('other_short'), v.literal('other_long')),
  usagePeriod: v.optional(v.union(v.literal('all'), v.literal('presales'), v.literal('open'), v.literal('postsales'))),
  costMode: v.optional(v.union(v.literal('individual'), v.literal('aggregate'))),
})

export const feePeriod = v.object({
  key: v.string(),
  label: v.string(),
  date: v.optional(v.string()),
  ratePct: v.number(),
  stage: v.union(v.literal('desk'), v.literal('s1'), v.literal('s2'), v.literal('s3')),
})

// bill은 구버전 문서 호환용 — 청구수수료는 이제 billAmount로 직접 입력한다.
export const feeStageRates = v.object({ bill: v.optional(v.number()), org: v.number() })

export const feeFields = {
  totalUnits: v.number(),
  billAmount: v.optional(v.number()),
  periods: v.array(feePeriod),
  stageRates: v.object({
    desk: feeStageRates,
    s1: feeStageRates,
    s2: feeStageRates,
    s3: feeStageRates,
  }),
  mgmUnitPrice: v.number(),
  mgmRatePct: v.number(),
  mgmBasis: v.union(v.literal('contract'), v.literal('alt')),
}

export const lineItem = v.object({
  id: v.string(),
  name: v.string(),
  amount: v.number(),
  qty: v.number(),
  period: v.string(),
  type: v.union(v.literal('1회성'), v.literal('일별'), v.literal('월별'), v.literal('수동')),
  status: v.union(v.literal('확정'), v.literal('검토중'), v.literal('작성중')),
})
