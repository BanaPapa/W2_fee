import { query, mutation } from './_generated/server'
import { v } from 'convex/values'
import { lineItem, ledgerGroup } from './validators'

const category = v.union(v.literal('ad'), v.literal('operating'), v.literal('misc'))

export const get = query({
  args: { category },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('ledgers')
      .withIndex('by_category', (q) => q.eq('category', args.category))
      .first()
  },
})

export const set = mutation({
  args: {
    category,
    items: v.array(lineItem),
    chips: v.array(v.string()),
    groups: v.optional(v.array(ledgerGroup)),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('ledgers')
      .withIndex('by_category', (q) => q.eq('category', args.category))
      .first()
    if (existing) {
      await ctx.db.patch(existing._id, args)
    } else {
      await ctx.db.insert('ledgers', args)
    }
  },
})
