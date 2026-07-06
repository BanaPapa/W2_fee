import { query, mutation } from './_generated/server'
import { v } from 'convex/values'
import { lineItem, ledgerGroup } from './validators'

export const get = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query('customCards').first()
  },
})

export const set = mutation({
  args: {
    cards: v.array(v.object({ id: v.string(), name: v.string() })),
    itemsByCard: v.record(v.string(), v.array(lineItem)),
    groupsByCard: v.record(v.string(), v.array(ledgerGroup)),
    order: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query('customCards').first()
    if (existing) {
      await ctx.db.patch(existing._id, args)
    } else {
      await ctx.db.insert('customCards', args)
    }
  },
})
