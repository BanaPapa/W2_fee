import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'
import { stage, eventBlock, extraSlot, role, lineItem, ledgerGroup, feeFields } from './validators'

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
    tabNames: v.optional(v.record(v.string(), v.string())),
  }),

  fee: defineTable(feeFields),

  ledgers: defineTable({
    category: v.union(v.literal('ad'), v.literal('operating'), v.literal('misc')),
    items: v.array(lineItem),
    chips: v.array(v.string()),
    groups: v.optional(v.array(ledgerGroup)),
  }).index('by_category', ['category']),

  // 사용자가 메인 화면에 직접 추가하는 카드들 — 카드마다 별도 테이블/문서를 두는 대신
  // 전체를 카드ID로 키를 삼아 문서 하나에 같이 저장한다 (다른 싱글-도큐먼트 테이블과 동일한 패턴).
  customCards: defineTable({
    cards: v.array(v.object({ id: v.string(), name: v.string() })),
    itemsByCard: v.record(v.string(), v.array(lineItem)),
    groupsByCard: v.record(v.string(), v.array(ledgerGroup)),
    /** 고정 카드 6개 + 사용자 카드 전체의 표시 순서 (id 목록) */
    order: v.optional(v.array(v.string())),
  }),
})
