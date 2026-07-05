import { query, mutation } from './_generated/server'
import { feeFields } from './validators'

export const get = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query('fee').first()
  },
})

export const set = mutation({
  args: feeFields,
  handler: async (ctx, args) => {
    const existing = await ctx.db.query('fee').first()
    if (existing) {
      await ctx.db.patch(existing._id, args)
    } else {
      await ctx.db.insert('fee', args)
    }
  },
})
