import { query, mutation } from './_generated/server'
import { v } from 'convex/values'
import { stage, eventBlock, extraSlot } from './validators'

export const get = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query('project').first()
  },
})

export const set = mutation({
  args: {
    title: v.string(),
    pm: v.string(),
    periodStart: v.string(),
    periodEnd: v.string(),
    extras: v.array(extraSlot),
    stages: v.array(stage),
    eventBlocks: v.array(eventBlock),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query('project').first()
    if (existing) {
      await ctx.db.patch(existing._id, args)
    } else {
      await ctx.db.insert('project', args)
    }
  },
})
