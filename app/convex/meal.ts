import { query, mutation } from './_generated/server'
import { v } from 'convex/values'

export const get = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query('meal').first()
  },
})

export const set = mutation({
  args: {
    lunchPerDay: v.number(),
    dinnerPerDay: v.number(),
    woesing: v.number(),
    dinnerRoleOverrides: v.record(v.string(), v.boolean()),
    tabNames: v.optional(v.record(v.string(), v.string())),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query('meal').first()
    if (existing) {
      await ctx.db.patch(existing._id, args)
    } else {
      await ctx.db.insert('meal', args)
    }
  },
})
