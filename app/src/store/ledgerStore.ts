import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type LineType = '1회성' | '일별' | '월별' | '수동'
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

export interface LedgerState {
  items: LineItem[]
  addItem: (preset?: Partial<LineItem>) => void
  updateItem: (id: string, patch: Partial<LineItem>) => void
  removeItem: (id: string) => void
}

export const lineTotal = (it: LineItem): number =>
  it.type === '수동' ? it.amount : it.amount * it.qty

export const ledgerTotal = (items: LineItem[]): number => items.reduce((a, it) => a + lineTotal(it), 0)

const uid = () => Math.random().toString(36).slice(2, 9)

/** factory: builds a persisted ledger store with seed rows */
export function makeLedgerStore(name: string, seed: Omit<LineItem, 'id'>[], chips: string[]) {
  const store = create<LedgerState & { chips: string[] }>()(
    persist(
      (set) => ({
        chips,
        items: seed.map((s) => ({ ...s, id: uid() })),
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
      }),
      { name },
    ),
  )
  return store
}

/* ---------------- advertising ---------------- */
export const useAdStore = makeLedgerStore(
  'ec-ad',
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
  'ec-op',
  [
    { name: '사무실 임대', amount: 9200000, qty: 4, period: '7~10월', type: '월별', status: '확정' },
    { name: '장비 임대 (PC·프린터)', amount: 4200000, qty: 4, period: '7~10월', type: '월별', status: '확정' },
    { name: '교통·주차', amount: 9100000, qty: 1, period: '전 기간', type: '수동', status: '검토중' },
    { name: '통신·인터넷', amount: 320000, qty: 4, period: '7~10월', type: '월별', status: '확정' },
  ],
  ['사무실 임대', '장비 임대', '교통', '통신', '소모품', '수도광열'],
)

/* ---------------- miscellaneous ---------------- */
export const useMiscStore = makeLedgerStore(
  'ec-etc',
  [
    { name: '현장 예비비', amount: 8000000, qty: 1, period: '전 기간', type: '수동', status: '검토중' },
    { name: '소모품', amount: 1175000, qty: 4, period: '7~10월', type: '월별', status: '확정' },
    { name: '추가 인력 지원', amount: 5000000, qty: 1, period: '9월', type: '1회성', status: '작성중' },
  ],
  ['현장 예비비', '소모품', '추가 지원', '경조사', '간담회', '기타'],
)
