import { create } from 'zustand'
import { api } from '../../convex/_generated/api'
import { persistMutation } from '../lib/convexClient'
import { debounce } from '../lib/debounce'

export type LineType = '1회성' | '일별' | '월별' | '수동'
export type LedgerCategory = 'ad' | 'operating' | 'misc'
export const LINE_TYPES: LineType[] = ['1회성', '일별', '월별', '수동']

/** 항목을 묶는 구획(예: 운영비의 홍보관/렌탈/차량/기타). 구획이 없는 장부(광고비 등)는 빈 배열을 쓴다. */
export interface LedgerGroup {
  key: string
  name: string
}

export interface LineItem {
  id: string
  name: string
  amount: number // unit amount (or fixed amount when type === '수동')
  qty: number
  period: string
  type: LineType
  status: '확정' | '검토중' | '작성중'
  /** 소속 구획 key. 구획이 있는 장부에서만 의미가 있다. */
  groupKey?: string
}

export interface LedgerDoc {
  items: LineItem[]
  chips: string[]
  groups?: LedgerGroup[]
}

export interface LedgerState extends LedgerDoc {
  groups: LedgerGroup[]
  hydrated: boolean
  hydrate: (doc: LedgerDoc) => void
  addItem: (preset?: Partial<LineItem>) => void
  updateItem: (id: string, patch: Partial<LineItem>) => void
  removeItem: (id: string) => void
  reorderItem: (from: number, to: number) => void
  /** fromId를 toId 바로 앞으로 옮기고, toId가 속한 구획으로 함께 옮긴다 (드래그로 자유 이동) */
  moveItem: (fromId: string, toId: string) => void
  /** 특정 구획의 빈 영역에 드롭했을 때 — 배열 순서는 유지하고 구획만 바꾼다 */
  setItemGroup: (id: string, groupKey: string) => void
  addGroup: (name: string) => void
  removeGroup: (key: string) => void
  reorderGroup: (from: number, to: number) => void
}

export const lineTotal = (it: LineItem): number =>
  it.type === '수동' ? it.amount : it.amount * it.qty

export const ledgerTotal = (items: LineItem[]): number => items.reduce((a, it) => a + lineTotal(it), 0)

const uid = () => Math.random().toString(36).slice(2, 9)

/** item의 groupKey가 현재 구획 목록에 없으면 첫 구획으로 보정한다 */
const resolveGroupKey = (groupKey: string | undefined, groups: LedgerGroup[]): string | undefined => {
  if (groups.length === 0) return undefined
  return groups.some((g) => g.key === groupKey) ? groupKey : groups[0].key
}

/** factory: builds a Convex-synced ledger store with seed rows */
export function makeLedgerStore(
  category: LedgerCategory,
  seed: Omit<LineItem, 'id'>[],
  chips: string[],
  initialGroups: LedgerGroup[] = [],
) {
  const store = create<LedgerState>()(
    (set) => ({
      hydrated: false,
      chips,
      groups: initialGroups,
      items: seed.map((s) => ({ ...s, id: uid(), groupKey: resolveGroupKey(s.groupKey, initialGroups) })),
      hydrate: (doc) => {
        const groups = doc.groups && doc.groups.length > 0 ? doc.groups : initialGroups
        set({
          hydrated: true,
          items: doc.items.map((it) => ({ ...it, groupKey: resolveGroupKey(it.groupKey, groups) })),
          chips: doc.chips,
          groups,
        })
      },
      addItem: (preset) =>
        set((st) => ({
          items: [
            ...st.items,
            {
              id: uid(),
              name: preset?.name ?? '신규 항목',
              amount: preset?.amount ?? 0,
              qty: preset?.qty ?? 1,
              period: preset?.period ?? '신규 기간',
              type: preset?.type ?? '1회성',
              status: preset?.status ?? '작성중',
              groupKey: resolveGroupKey(preset?.groupKey, st.groups),
            },
          ],
        })),
      updateItem: (id, patch) =>
        set((st) => ({ items: st.items.map((it) => (it.id === id ? { ...it, ...patch } : it)) })),
      removeItem: (id) => set((st) => ({ items: st.items.filter((it) => it.id !== id) })),
      reorderItem: (from, to) =>
        set((st) => {
          const items = [...st.items]
          const [moved] = items.splice(from, 1)
          items.splice(to, 0, moved)
          return { items }
        }),
      moveItem: (fromId, toId) =>
        set((st) => {
          if (fromId === toId) return st
          const fromIdx = st.items.findIndex((it) => it.id === fromId)
          const toIdx = st.items.findIndex((it) => it.id === toId)
          if (fromIdx === -1 || toIdx === -1) return st
          const targetGroup = st.items[toIdx].groupKey
          const items = [...st.items]
          const [moved] = items.splice(fromIdx, 1)
          const newToIdx = items.findIndex((it) => it.id === toId)
          items.splice(newToIdx, 0, { ...moved, groupKey: targetGroup })
          return { items }
        }),
      setItemGroup: (id, groupKey) =>
        set((st) => ({ items: st.items.map((it) => (it.id === id ? { ...it, groupKey } : it)) })),
      addGroup: (name) =>
        set((st) => ({ groups: [...st.groups, { key: uid(), name }] })),
      removeGroup: (key) =>
        set((st) => {
          if (st.groups.length <= 1) return st // 최소 1개 구획은 남긴다
          const groups = st.groups.filter((g) => g.key !== key)
          const fallback = groups[0].key
          return {
            groups,
            items: st.items.map((it) => (it.groupKey === key ? { ...it, groupKey: fallback } : it)),
          }
        }),
      reorderGroup: (from, to) =>
        set((st) => {
          const groups = [...st.groups]
          const [moved] = groups.splice(from, 1)
          groups.splice(to, 0, moved)
          return { groups }
        }),
    }),
  )

  const push = debounce((state: LedgerState) => {
    persistMutation(api.ledger.set, { category, items: state.items, chips: state.chips, groups: state.groups })
  }, 400)

  store.subscribe((state, prev) => {
    if (!prev.hydrated) return
    push(state)
  })

  return store
}

/* ---------------- advertising ---------------- */
const AD_GROUPS: LedgerGroup[] = [
  { key: 'online', name: '온라인' },
  { key: 'offline', name: '오프라인' },
  { key: 'onsite', name: '현장' },
  { key: 'etc', name: '기타' },
]

export const useAdStore = makeLedgerStore(
  'ad',
  [
    { name: '온라인 광고 (포털/SNS)', amount: 8000000, qty: 4, period: '7~10월', type: '월별', status: '확정', groupKey: 'online' },
    { name: '전단지 제작·배포', amount: 6800000, qty: 4, period: '7~10월', type: '월별', status: '확정', groupKey: 'offline' },
    { name: '현수막·옥외', amount: 12000000, qty: 1, period: '8월', type: '1회성', status: '검토중', groupKey: 'offline' },
    { name: '모델하우스 운영', amount: 13500000, qty: 2, period: '8~9월', type: '월별', status: '확정', groupKey: 'onsite' },
  ],
  [],
  AD_GROUPS,
)

/* ---------------- operating ---------------- */
const OPERATING_GROUPS: LedgerGroup[] = [
  { key: 'hall', name: '홍보관' },
  { key: 'rental', name: '렌탈' },
  { key: 'vehicle', name: '차량' },
  { key: 'etc', name: '기타' },
]

export const useOperatingStore = makeLedgerStore(
  'operating',
  [
    { name: '홍보관 운영', amount: 3000000, qty: 4, period: '7~10월', type: '월별', status: '검토중', groupKey: 'hall' },
    { name: 'PC 렌탈', amount: 150000, qty: 4, period: '7~10월', type: '월별', status: '검토중', groupKey: 'rental' },
    { name: '집기류 렌탈', amount: 300000, qty: 4, period: '7~10월', type: '월별', status: '검토중', groupKey: 'rental' },
    { name: '사무용품비', amount: 200000, qty: 4, period: '7~10월', type: '월별', status: '검토중', groupKey: 'etc' },
    { name: 'CRM', amount: 500000, qty: 4, period: '7~10월', type: '월별', status: '검토중', groupKey: 'etc' },
    { name: '지문인식기', amount: 800000, qty: 1, period: '7월', type: '1회성', status: '검토중', groupKey: 'hall' },
    { name: '출퇴근 인증 시스템', amount: 1200000, qty: 1, period: '7월', type: '1회성', status: '검토중', groupKey: 'hall' },
    { name: '세움터 등록', amount: 300000, qty: 1, period: '7월', type: '1회성', status: '검토중', groupKey: 'etc' },
    { name: '유류대', amount: 400000, qty: 4, period: '7~10월', type: '월별', status: '검토중', groupKey: 'vehicle' },
    { name: '예비비', amount: 5000000, qty: 1, period: '전 기간', type: '1회성', status: '검토중', groupKey: 'etc' },
  ],
  [],
  OPERATING_GROUPS,
)

/* ---------------- miscellaneous ---------------- */
const MISC_GROUPS: LedgerGroup[] = [
  { key: 'reserve', name: '예비비' },
  { key: 'supplies', name: '소모품' },
  { key: 'support', name: '지원' },
  { key: 'etc', name: '기타' },
]

export const useMiscStore = makeLedgerStore(
  'misc',
  [
    { name: '현장 예비비', amount: 8000000, qty: 1, period: '전 기간', type: '1회성', status: '검토중', groupKey: 'reserve' },
    { name: '소모품', amount: 1175000, qty: 4, period: '7~10월', type: '월별', status: '확정', groupKey: 'supplies' },
    { name: '추가 인력 지원', amount: 5000000, qty: 1, period: '9월', type: '1회성', status: '작성중', groupKey: 'support' },
  ],
  [],
  MISC_GROUPS,
)
