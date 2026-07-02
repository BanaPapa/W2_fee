import { query, mutation } from './_generated/server'
import { v } from 'convex/values'
import { role } from './validators'

export const get = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query('labor').first()
  },
})

export const set = mutation({
  args: {
    roles: v.array(role),
    sectionNames: v.record(v.string(), v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query('labor').first()
    if (existing) {
      await ctx.db.patch(existing._id, args)
    } else {
      await ctx.db.insert('labor', args)
    }
  },
})
