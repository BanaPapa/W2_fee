import { useState } from 'react'
import type { StoreApi, UseBoundStore } from 'zustand'
import DetailHeader from './DetailHeader'
import { PlusIcon, TrashIcon, GripIcon } from '../icons'
import { won } from '../../lib/format'
import {
  type LedgerState,
  type LineItem,
  LINE_TYPES,
  lineTotal,
  ledgerTotal,
} from '../../store/ledgerStore'

function AmountInput({ value, onUpdate }: { value: number; onUpdate: (v: number) => void }) {
  const [editing, setEditing] = useState(false)
  const [raw, setRaw] = useState('')
  return (
    <input
      className="field-input w-[110px] text-right"
      type="text"
      inputMode="numeric"
      value={editing ? raw : value.toLocaleString('ko-KR')}
      onFocus={() => { setEditing(true); setRaw(String(value)) }}
      onChange={(e) => {
        const s = e.target.value.replace(/[^0-9]/g, '')
        setRaw(s)
        onUpdate(parseInt(s) || 0)
      }}
      onBlur={() => setEditing(false)}
    />
  )
}

type LedgerStore = UseBoundStore<StoreApi<LedgerState>>

interface Props {
  title: string
  cId: string
  useStore: LedgerStore
  /** show the quick-add chip row (default true) */
  chips?: boolean
  /** allow drag-and-drop reordering of rows (default false) */
  sortable?: boolean
}

export default function LedgerDetail({ title, cId, useStore, chips = true, sortable = false }: Props) {
  const items = useStore((s) => s.items)
  const chipList = useStore((s) => s.chips)
  const { addItem, updateItem, removeItem, reorderItem } = useStore()
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)

  const total = ledgerTotal(items)

  return (
    <div className="pb-8" data-c={cId}>
      <DetailHeader title={title} subtitle={`${items.length}개 항목`} total={total} />

      <div className="px-6 pt-5 flex flex-col gap-4">
        {chips ? (
          <div className="flex flex-wrap gap-2">
            {chipList.map((c) => (
              <button key={c} className="pill" onClick={() => addItem({ name: c })}>
                <PlusIcon style={{ width: 13, height: 13 }} /> {c}
              </button>
            ))}
          </div>
        ) : (
          <div>
            <button className="pill" onClick={() => addItem()}>
              <PlusIcon style={{ width: 13, height: 13 }} /> 항목 추가
            </button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                {sortable && <th></th>}
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
              {items.map((it, i) => (
                <Row
                  key={it.id}
                  it={it}
                  onUpdate={(p) => updateItem(it.id, p)}
                  onRemove={() => removeItem(it.id)}
                  sortable={sortable}
                  dragging={dragIdx === i}
                  dragOver={dragOver === i}
                  onDragStart={() => setDragIdx(i)}
                  onDragEnd={() => { setDragIdx(null); setDragOver(null) }}
                  onDragOverRow={() => { if (dragIdx !== null && dragIdx !== i) setDragOver(i) }}
                  onDrop={() => {
                    if (dragIdx !== null && dragIdx !== i) reorderItem(dragIdx, i)
                    setDragIdx(null); setDragOver(null)
                  }}
                />
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
  sortable,
  dragging,
  dragOver,
  onDragStart,
  onDragEnd,
  onDragOverRow,
  onDrop,
}: {
  it: LineItem
  onUpdate: (patch: Partial<LineItem>) => void
  onRemove: () => void
  sortable: boolean
  dragging: boolean
  dragOver: boolean
  onDragStart: () => void
  onDragEnd: () => void
  onDragOverRow: () => void
  onDrop: () => void
}) {
  const manual = it.type === '수동'
  return (
    <tr
      style={{
        opacity: dragging ? 0.4 : 1,
        outline: dragOver ? '2px solid var(--accent)' : undefined,
      }}
      onDragOver={sortable ? (e) => { e.preventDefault(); onDragOverRow() } : undefined}
      onDrop={sortable ? (e) => { e.preventDefault(); onDrop() } : undefined}
    >
      {sortable && (
        <td className="w-[24px]">
          <span
            draggable
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            className="cursor-grab text-[var(--muted)] inline-flex"
            aria-label="순서 변경"
          >
            <GripIcon style={{ width: 16, height: 16 }} />
          </span>
        </td>
      )}
      <td>
        <input
          className="bg-transparent outline-none w-[160px] text-[17px]"
          value={it.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
        />
      </td>
      <td className="num">
        <AmountInput value={it.amount} onUpdate={(v) => onUpdate({ amount: v })} />
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
