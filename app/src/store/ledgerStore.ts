import { create } from 'zustand'
import { api } from '../../convex/_generated/api'
import { convexClient } from '../lib/convexClient'
import { debounce } from '../lib/debounce'

export type LineType = '1회성' | '일별' | '월별' | '수동'
export type LedgerCategory = 'ad' | 'operating' | 'misc'
export const LINE_TYPES: LineType[] = ['1회성', '일별', '월별', '수동']

export interface LineItem {
  id: string
  name: string
  amount: number // unit amount (or fixed amount when type === '수동')
  qty: number
  period: string
  type: LineType
  status: '확정' | '검토중' | '작성중'
}

export interface LedgerDoc {
  items: LineItem[]
  chips: string[]
}

export interface LedgerState extends LedgerDoc {
  hydrated: boolean
  hydrate: (doc: LedgerDoc) => void
  addItem: (preset?: Partial<LineItem>) => void
  updateItem: (id: string, patch: Partial<LineItem>) => void
  removeItem: (id: string) => void
  reorderItem: (from: number, to: number) => void
}

export const lineTotal = (it: LineItem): number =>
  it.type === '수동' ? it.amount : it.amount * it.qty

export const ledgerTotal = (items: LineItem[]): number => items.reduce((a, it) => a + lineTotal(it), 0)

const uid = () => Math.random().toString(36).slice(2, 9)

/** factory: builds a Convex-synced ledger store with seed rows */
export function makeLedgerStore(category: LedgerCategory, seed: Omit<LineItem, 'id'>[], chips: string[]) {
  const store = create<LedgerState>()(
    (set) => ({
      hydrated: false,
      chips,
      items: seed.map((s) => ({ ...s, id: uid() })),
      hydrate: (doc) => set({ hydrated: true, items: doc.items, chips: doc.chips }),
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
    }),
  )

  const push = debounce((state: LedgerState) => {
    convexClient.mutation(api.ledger.set, { category, items: state.items, chips: state.chips })
  }, 400)

  store.subscribe((state, prev) => {
    if (!prev.hydrated) return
    push(state)
  })

  return store
}

/* ---------------- advertising ---------------- */
export const useAdStore = makeLedgerStore(
  'ad',
  [
    { name: '온라인 광고 (포털/SNS)', amount: 8000000, qty: 4, period: '7~10월', type: '월별', status: '확정' },
    { name: '전단지 제작·배포', amount: 6800000, qty: 4, period: '7~10월', type: '월별', status: '확정' },
    { name: '현수막·옥외', amount: 12000000, qty: 1, period: '8월', type: '1회성', status: '검토중' },
    { name: '모델하우스 운영', amount: 450000, qty: 60, period: '8~9월', type: '일별', status: '확정' },
  ],
  ['온라인 광고', '전단지', '현수막', '버스/지하철', '문자 발송', '블로그 체험단'],
)

/* ---------------- operating ---------------- */
export const useOperatingStore = makeLedgerStore(
  'operating',
  [
    { name: '홍보관 운영', amount: 3000000, qty: 4, period: '7~10월', type: '월별', status: '검토중' },
    { name: 'PC 렌탈', amount: 150000, qty: 4, period: '7~10월', type: '월별', status: '검토중' },
    { name: '집기류 렌탈', amount: 300000, qty: 4, period: '7~10월', type: '월별', status: '검토중' },
    { name: '사무용품비', amount: 200000, qty: 4, period: '7~10월', type: '월별', status: '검토중' },
    { name: 'CRM', amount: 500000, qty: 4, period: '7~10월', type: '월별', status: '검토중' },
    { name: '지문인식기', amount: 800000, qty: 1, period: '7월', type: '1회성', status: '검토중' },
    { name: '출퇴근 인증 시스템', amount: 1200000, qty: 1, period: '7월', type: '1회성', status: '검토중' },
    { name: '세움터 등록', amount: 300000, qty: 1, period: '7월', type: '1회성', status: '검토중' },
    { name: '유류대', amount: 400000, qty: 4, period: '7~10월', type: '월별', status: '검토중' },
    { name: '예비비', amount: 5000000, qty: 1, period: '전 기간', type: '수동', status: '검토중' },
  ],
  [],
)

/* ---------------- miscellaneous ---------------- */
export const useMiscStore = makeLedgerStore(
  'misc',
  [
    { name: '현장 예비비', amount: 8000000, qty: 1, period: '전 기간', type: '수동', status: '검토중' },
    { name: '소모품', amount: 1175000, qty: 4, period: '7~10월', type: '월별', status: '확정' },
    { name: '추가 인력 지원', amount: 5000000, qty: 1, period: '9월', type: '1회성', status: '작성중' },
  ],
  ['현장 예비비', '소모품', '추가 지원', '경조사', '간담회', '기타'],
)
