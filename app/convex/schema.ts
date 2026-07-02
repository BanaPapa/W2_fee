import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'
import { stage, eventBlock, extraSlot, role, lineItem } from './validators'

export default defineSchema({
  project: defineTable({
    title: v.string(),
    pm: v.string(),
    periodStart: v.string(),
    periodEnd: v.string(),
    extras: v.array(extraSlot),
    stages: v.array(stage),
    eventBlocks: v.array(eventBlock),
  }),

  labor: defineTable({
    roles: v.array(role),
    sectionNames: v.record(v.string(), v.string()),
  }),

  meal: defineTable({
    lunchPerDay: v.number(),
    dinnerPerDay: v.number(),
    woesing: v.number(),
    dinnerRoleOverrides: v.record(v.string(), v.boolean()),
  }),

  ledgers: defineTable({
    category: v.union(v.literal('ad'), v.literal('operating'), v.literal('misc')),
    items: v.array(lineItem),
    chips: v.array(v.string()),
  }).index('by_category', ['category']),
})
