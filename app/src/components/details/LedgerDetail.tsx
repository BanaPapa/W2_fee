import type { StoreApi, UseBoundStore } from 'zustand'
import DetailHeader from './DetailHeader'
import { PlusIcon, TrashIcon } from '../icons'
import { won } from '../../lib/format'
import {
  type LedgerState,
  type LineItem,
  LINE_TYPES,
  lineTotal,
  ledgerTotal,
} from '../../store/ledgerStore'

type LedgerStore = UseBoundStore<StoreApi<LedgerState & { chips: string[] }>>

interface Props {
  title: string
  cId: string
  useStore: LedgerStore
}

export default function LedgerDetail({ title, cId, useStore }: Props) {
  const items = useStore((s) => s.items)
  const chips = useStore((s) => s.chips)
  const { addItem, updateItem, removeItem } = useStore()

  const total = ledgerTotal(items)

  return (
    <div className="pb-8" data-c={cId}>
      <DetailHeader title={title} subtitle={`${items.length}개 항목`} total={total} />

      <div className="px-6 pt-5 flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          {chips.map((c) => (
            <button key={c} className="pill" onClick={() => addItem({ name: c })}>
              <PlusIcon style={{ width: 13, height: 13 }} /> {c}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>항목</th>
                <th style={{ textAlign: 'right' }}>단가</th>
                <th style={{ textAlign: 'right' }}>수량</th>
                <th>기간</th>
                <th>유형</th>
                <th style={{ textAlign: 'right' }}>계</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <Row key={it.id} it={it} onUpdate={(p) => updateItem(it.id, p)} onRemove={() => removeItem(it.id)} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function Row({
  it,
  onUpdate,
  onRemove,
}: {
  it: LineItem
  onUpdate: (patch: Partial<LineItem>) => void
  onRemove: () => void
}) {
  const manual = it.type === '수동'
  return (
    <tr>
      <td>
        <input
          className="bg-transparent outline-none w-[160px] text-[17px]"
          value={it.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
        />
      </td>
      <td className="num">
        <input
          className="field-input w-[110px]"
          type="number"
          value={it.amount}
          onChange={(e) => onUpdate({ amount: Number(e.target.value) || 0 })}
        />
      </td>
      <td className="num">
        <input
          className="field-input w-[64px]"
          type="number"
          value={it.qty}
          disabled={manual}
          onChange={(e) => onUpdate({ qty: Number(e.target.value) || 0 })}
        />
      </td>
      <td>
        <input
          className="bg-transparent outline-none w-[90px] text-[16px]"
          value={it.period}
          onChange={(e) => onUpdate({ period: e.target.value })}
        />
      </td>
      <td>
        <select
          className="field-input !text-left !px-2"
          value={it.type}
          onChange={(e) => onUpdate({ type: e.target.value as LineItem['type'] })}
        >
          {LINE_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </td>
      <td className="num font-semibold text-[var(--ink)]">{won(lineTotal(it))}</td>
      <td>
        <button className="x" aria-label="삭제" onClick={onRemove}>
          <TrashIcon />
        </button>
      </td>
    </tr>
  )
}
