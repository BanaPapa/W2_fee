import { create } from 'zustand'
import { saveDoc } from '../lib/firebaseClient'
import { debounce } from '../lib/debounce'
import { ledgerTotal, type LineItem, type LedgerGroup } from './ledgerStore'
import { CATEGORIES } from '../data/categories'

/** 6개 고정 카드의 id — 카드 관리에서 순서는 바꿀 수 있어도 삭제는 못 하게 구분하는 기준 */
const FIXED_CARD_IDS = CATEGORIES.map((c) => c.id)
export const isFixedCardId = (id: string): boolean => FIXED_CARD_IDS.includes(id)

/**
 * 사용자가 메인 화면에 직접 추가하는 카드들. 운영비/광고비/기타비와 같은 "구획이 있는
 * 장부" 시스템을 그대로 쓰지만, 각 카드마다 별도의 zustand 스토어(=별도의 훅)를 만들면
 * 카드 개수가 늘어날 때마다 호출되는 훅 개수가 달라져 React 훅 규칙을 어기게 된다.
 * 그래서 카드가 몇 개든 이 스토어 하나만 구독하면 되도록, 모든 카드의 항목·구획을
 * cardId로 키를 삼아 한 스토어 안에 같이 들고 있는다.
 */
export interface CustomCard {
  id: string
  name: string
}

export interface CustomCardsDoc {
  cards: CustomCard[]
  itemsByCard: Record<string, LineItem[]>
  groupsByCard: Record<string, LedgerGroup[]>
  /** 고정 카드 6개 + 사용자 카드 전체의 표시 순서 (id 목록) */
  order?: string[]
}

/** 저장된 순서에서 더 이상 존재하지 않는 id는 버리고, 아직 순서에 없는(새로 생긴) 고정/사용자 카드는 끝에 붙인다 */
const reconcileOrder = (rawOrder: string[] | undefined, customCards: CustomCard[]): string[] => {
  const validIds = [...FIXED_CARD_IDS, ...customCards.map((c) => c.id)]
  const validSet = new Set(validIds)
  const cleaned = (rawOrder ?? []).filter((id) => validSet.has(id))
  const cleanedSet = new Set(cleaned)
  const missing = validIds.filter((id) => !cleanedSet.has(id))
  return [...cleaned, ...missing]
}

interface CustomCardsState extends CustomCardsDoc {
  order: string[]
  hydrated: boolean
  hydrate: (doc: CustomCardsDoc) => void
  addCard: (name: string) => void
  removeCard: (id: string) => void
  /** order 배열(고정 카드 포함 전체) 안에서 순서를 바꾼다. 고정 카드도 순서는 바꿀 수 있다. */
  reorderCard: (from: number, to: number) => void
  addItem: (cardId: string, preset?: Partial<LineItem>) => void
  updateItem: (cardId: string, itemId: string, patch: Partial<LineItem>) => void
  removeItem: (cardId: string, itemId: string) => void
  moveItem: (cardId: string, fromId: string, toId: string) => void
  setItemGroup: (cardId: string, itemId: string, groupKey: string) => void
  addGroup: (cardId: string, name: string) => void
  removeGroup: (cardId: string, key: string) => void
  reorderGroup: (cardId: string, from: number, to: number) => void
}

const uid = () => Math.random().toString(36).slice(2, 9)

const resolveGroupKey = (groupKey: string | undefined, groups: LedgerGroup[]): string | undefined => {
  if (groups.length === 0) return undefined
  return groups.some((g) => g.key === groupKey) ? groupKey : groups[0].key
}

export const useCustomCardsStore = create<CustomCardsState>()((set) => ({
  hydrated: false,
  cards: [],
  itemsByCard: {},
  groupsByCard: {},
  order: reconcileOrder(undefined, []),

  hydrate: (doc) =>
    set({
      hydrated: true,
      cards: doc.cards ?? [],
      itemsByCard: doc.itemsByCard ?? {},
      groupsByCard: doc.groupsByCard ?? {},
      order: reconcileOrder(doc.order, doc.cards ?? []),
    }),

  addCard: (name) =>
    set((s) => {
      const id = `custom_${uid()}`
      return {
        cards: [...s.cards, { id, name }],
        itemsByCard: { ...s.itemsByCard, [id]: [] },
        groupsByCard: { ...s.groupsByCard, [id]: [{ key: uid(), name: '기타' }] },
        order: [...s.order, id],
      }
    }),

  removeCard: (id) =>
    set((s) => {
      const itemsByCard = { ...s.itemsByCard }
      const groupsByCard = { ...s.groupsByCard }
      delete itemsByCard[id]
      delete groupsByCard[id]
      return {
        cards: s.cards.filter((c) => c.id !== id),
        itemsByCard,
        groupsByCard,
        order: s.order.filter((oid) => oid !== id),
      }
    }),

  reorderCard: (from, to) =>
    set((s) => {
      const order = [...s.order]
      const [moved] = order.splice(from, 1)
      order.splice(to, 0, moved)
      return { order }
    }),

  addItem: (cardId, preset) =>
    set((s) => {
      const groups = s.groupsByCard[cardId] ?? []
      const newItem: LineItem = {
        id: uid(),
        name: preset?.name ?? '신규 항목',
        amount: preset?.amount ?? 0,
        qty: preset?.qty ?? 1,
        period: preset?.period ?? '신규 기간',
        type: preset?.type ?? '월별',
        status: preset?.status ?? '작성중',
        groupKey: resolveGroupKey(preset?.groupKey, groups),
      }
      return { itemsByCard: { ...s.itemsByCard, [cardId]: [...(s.itemsByCard[cardId] ?? []), newItem] } }
    }),

  updateItem: (cardId, itemId, patch) =>
    set((s) => ({
      itemsByCard: {
        ...s.itemsByCard,
        [cardId]: (s.itemsByCard[cardId] ?? []).map((it) => (it.id === itemId ? { ...it, ...patch } : it)),
      },
    })),

  removeItem: (cardId, itemId) =>
    set((s) => ({
      itemsByCard: { ...s.itemsByCard, [cardId]: (s.itemsByCard[cardId] ?? []).filter((it) => it.id !== itemId) },
    })),

  moveItem: (cardId, fromId, toId) =>
    set((s) => {
      if (fromId === toId) return s
      const items = s.itemsByCard[cardId] ?? []
      const fromIdx = items.findIndex((it) => it.id === fromId)
      const toIdx = items.findIndex((it) => it.id === toId)
      if (fromIdx === -1 || toIdx === -1) return s
      const targetGroup = items[toIdx].groupKey
      const next = [...items]
      const [moved] = next.splice(fromIdx, 1)
      const newToIdx = next.findIndex((it) => it.id === toId)
      next.splice(newToIdx, 0, { ...moved, groupKey: targetGroup })
      return { itemsByCard: { ...s.itemsByCard, [cardId]: next } }
    }),

  setItemGroup: (cardId, itemId, groupKey) =>
    set((s) => ({
      itemsByCard: {
        ...s.itemsByCard,
        [cardId]: (s.itemsByCard[cardId] ?? []).map((it) => (it.id === itemId ? { ...it, groupKey } : it)),
      },
    })),

  addGroup: (cardId, name) =>
    set((s) => ({
      groupsByCard: { ...s.groupsByCard, [cardId]: [...(s.groupsByCard[cardId] ?? []), { key: uid(), name }] },
    })),

  removeGroup: (cardId, key) =>
    set((s) => {
      const groups = s.groupsByCard[cardId] ?? []
      if (groups.length <= 1) return s // 최소 1개 구획은 남긴다
      const nextGroups = groups.filter((g) => g.key !== key)
      const fallback = nextGroups[0].key
      return {
        groupsByCard: { ...s.groupsByCard, [cardId]: nextGroups },
        itemsByCard: {
          ...s.itemsByCard,
          [cardId]: (s.itemsByCard[cardId] ?? []).map((it) => (it.groupKey === key ? { ...it, groupKey: fallback } : it)),
        },
      }
    }),

  reorderGroup: (cardId, from, to) =>
    set((s) => {
      const groups = [...(s.groupsByCard[cardId] ?? [])]
      const [moved] = groups.splice(from, 1)
      groups.splice(to, 0, moved)
      return { groupsByCard: { ...s.groupsByCard, [cardId]: groups } }
    }),
}))

const pushCustomCards = debounce((state: CustomCardsState) => {
  saveDoc('customCards', {
    cards: state.cards,
    itemsByCard: state.itemsByCard,
    groupsByCard: state.groupsByCard,
    order: state.order,
  })
}, 400)

useCustomCardsStore.subscribe((state, prev) => {
  if (!prev.hydrated) return
  pushCustomCards(state)
})

export const customCardTotal = (state: Pick<CustomCardsState, 'itemsByCard'>, cardId: string): number =>
  ledgerTotal(state.itemsByCard[cardId] ?? [])

export const customCardsGrandTotal = (state: Pick<CustomCardsState, 'cards' | 'itemsByCard'>): number =>
  state.cards.reduce((a, c) => a + customCardTotal(state, c.id), 0)
