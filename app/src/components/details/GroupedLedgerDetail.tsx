import { useState } from 'react'
import DetailHeader from './DetailHeader'
import Modal from '../ui/Modal'
import { PlusIcon, TrashIcon, GripIcon, GearIcon } from '../icons'
import { won } from '../../lib/format'
import { lineTotal, ledgerTotal, type LineItem, type LineType, type LedgerGroup } from '../../store/ledgerStore'
import { useProjectStore, toDate, toIso, type Stage } from '../../store/projectStore'
import { projectMonths } from '../../lib/schedule'

/** 항목 유형은 월별/1회성 두 가지만 쓴다 (일별·수동은 구버전 데이터 호환용으로만 남아있음) */
const LEDGER_TYPES: LineType[] = ['월별', '1회성']

function AmountInput({ value, onUpdate, width = 110 }: { value: number; onUpdate: (v: number) => void; width?: number }) {
  const [editing, setEditing] = useState(false)
  const [raw, setRaw] = useState('')
  return (
    <input
      className="field-input text-right"
      style={{ width }}
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

/** iso + n개월. 말일 넘침은 그 달의 마지막 날로 보정 */
const addMonthsClamped = (iso: string, n: number): string => {
  const d = toDate(iso)
  const t = new Date(d.getFullYear(), d.getMonth() + n, d.getDate())
  if (t.getDate() !== d.getDate()) t.setDate(0)
  return toIso(t.getTime())
}

/** 컴팩트 날짜 라벨 (YY.MM) — 막대 양끝에 붙이는 용도 */
const shortDate = (iso: string): string => `${iso.slice(2, 4)}.${iso.slice(5, 7)}`

const SEG_DEFS: { id: string; label: string; color: string }[] = [
  { id: 'presales', label: '사전영업', color: '#14b8a6' },
  { id: 'main', label: '본영업', color: 'var(--accent)' },
  { id: 'postsales', label: '사후영업', color: '#6b7280' },
]

/**
 * 항목의 사용기간을 시각화하는 막대바.
 * 배경 트랙은 분양기간 전체를 사전영업/본영업/사후영업 3개 구획으로만 색을 구분해 보여준다
 * (개월 단위로 잘게 쪼개지 않음). 그 위에 실제 이 항목이 쓰이는 기간(분양시점부터 qty만큼)을
 * 강조 막대로 겹쳐 그린다. 1회성 항목은 기간 개념이 없으므로 막대를 비활성(회색) 처리한다.
 */
function PeriodBar({ item, periodStart, periodEnd, stages }: { item: LineItem; periodStart: string; periodEnd: string; stages: Stage[] }) {
  const startMs = toDate(periodStart).getTime()
  const endMs = toDate(periodEnd).getTime()
  const totalMs = Math.max(1, endMs - startMs)
  const pctOf = (iso: string) => Math.min(100, Math.max(0, ((toDate(iso).getTime() - startMs) / totalMs) * 100))

  const segments = SEG_DEFS.flatMap((def) => {
    const st = stages.find((s) => s.id === def.id && s.enabled)
    if (!st) return []
    const left = pctOf(st.start)
    const width = Math.max(0, pctOf(st.end) - left)
    return [{ ...def, left, width, start: st.start, end: st.end }]
  })

  const disabled = item.type === '1회성'
  const highlightWidth = disabled || item.qty <= 0 ? 0 : pctOf(addMonthsClamped(periodStart, item.qty))
  const highlightLabel = disabled ? '1회성 · 기간 미적용' : item.qty > 0 ? `분양시점부터 ${item.qty}개월` : ''

  return (
    <div style={{ width: '100%', minWidth: 140 }}>
      <div
        style={{
          position: 'relative', height: 27, borderRadius: 8, overflow: 'hidden',
          background: 'var(--surface-2)', border: '1px solid var(--border)',
          opacity: disabled ? 0.5 : 1,
          filter: disabled ? 'grayscale(0.6)' : undefined,
        }}
        title={[
          ...segments.map((s) => `${s.label} ${shortDate(s.start)}~${shortDate(s.end)}`),
          highlightLabel && `사용: ${highlightLabel}`,
        ].filter(Boolean).join(' · ')}
      >
        {segments.map((s, i) => (
          <div
            key={s.id}
            style={{
              position: 'absolute', top: 0, bottom: 0,
              left: `${s.left}%`, width: `${s.width}%`,
              background: `color-mix(in oklch, ${s.color} 30%, transparent)`,
              borderRight: i < segments.length - 1 ? '1px solid color-mix(in oklch, var(--ink) 18%, transparent)' : undefined,
            }}
          />
        ))}
        {!disabled && highlightWidth > 0 && (
          <div
            style={{
              position: 'absolute', top: 0, bottom: 0, left: 0, width: `${highlightWidth}%`,
              background: 'color-mix(in oklch, var(--accent) 55%, transparent)',
            }}
          />
        )}
      </div>
    </div>
  )
}

export interface GroupedLedgerDetailProps {
  title: string
  cId: string
  items: LineItem[]
  groups: LedgerGroup[]
  addItem: (preset?: Partial<LineItem>) => void
  updateItem: (id: string, patch: Partial<LineItem>) => void
  removeItem: (id: string) => void
  moveItem: (fromId: string, toId: string) => void
  setItemGroup: (id: string, groupKey: string) => void
  addGroup: (name: string) => void
  removeGroup: (key: string) => void
  reorderGroup: (from: number, to: number) => void
  /** 사용자 추가 카드 전용 — 헤더에 "카드 삭제" 액션을 보여준다 */
  onDeleteCard?: () => void
}

/**
 * 구획(그룹) + 드래그 이동 + 기간 막대바를 갖춘 장부 상세 화면.
 * 운영비/광고비/기타비, 그리고 사용자가 추가하는 카드가 전부 이 컴포넌트 하나를 공유한다.
 */
export default function GroupedLedgerDetail({
  title,
  cId,
  items,
  groups,
  addItem,
  updateItem,
  removeItem,
  moveItem,
  setItemGroup,
  addGroup,
  removeGroup,
  reorderGroup,
  onDeleteCard,
}: GroupedLedgerDetailProps) {
  const periodStart = useProjectStore((s) => s.periodStart)
  const periodEnd = useProjectStore((s) => s.periodEnd)
  const stages = useProjectStore((s) => s.stages)
  // 기간은 분양시작~분양종료를 넘어 무한히 늘어날 수 없다 — 최대 개월수로 캡을 건다
  const maxMonths = Math.max(1, projectMonths(periodStart, periodEnd).length)

  const [dragId, setDragId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [dragOverGroup, setDragOverGroup] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [groupDragIdx, setGroupDragIdx] = useState<number | null>(null)
  const [groupDragOverIdx, setGroupDragOverIdx] = useState<number | null>(null)
  const [deleteGroupKey, setDeleteGroupKey] = useState<string | null>(null)
  const [deleteCardConfirm, setDeleteCardConfirm] = useState(false)

  const total = ledgerTotal(items)

  return (
    <div className="pb-8" data-c={cId}>
      <DetailHeader
        title={title}
        subtitle={`${items.length}개 항목 · ${groups.length}개 구획`}
        total={total}
        actions={
          <>
            <button className="pill" onClick={() => setMenuOpen(true)}>
              <GearIcon style={{ width: 13, height: 13 }} /> 구획 설정
            </button>
            <button className="pill" onClick={() => addItem({ groupKey: groups[0]?.key, type: '월별', qty: Math.min(4, maxMonths) })}>
              <PlusIcon style={{ width: 13, height: 13 }} /> 항목 추가
            </button>
          </>
        }
      />

      <div className="px-6 pt-5 flex flex-col gap-6">
        {groups.map((g) => {
          const groupItems = items.filter((it) => it.groupKey === g.key)
          const groupTotal = ledgerTotal(groupItems)
          const isDropTarget = dragOverGroup === g.key
          return (
            <div key={g.key}>
              <div className="flex items-center gap-3 mb-2">
                <div className="text-[17px] font-bold tracking-widest uppercase" style={{ color: 'var(--muted)' }}>
                  {g.name}
                </div>
                {groupTotal > 0 && (
                  <div className="text-[15px] font-semibold tabular" style={{ color: 'var(--fg)' }}>
                    {won(groupTotal)}
                  </div>
                )}
              </div>
              <div
                onDragOver={(e) => { if (dragId !== null) { e.preventDefault(); setDragOverGroup(g.key) } }}
                onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverGroup(null) }}
                onDrop={(e) => {
                  e.preventDefault()
                  if (dragId !== null) setItemGroup(dragId, g.key)
                  setDragId(null); setDragOverId(null); setDragOverGroup(null)
                }}
                className="overflow-x-auto rounded-xl"
                style={{
                  outline: isDropTarget ? '2px dashed var(--accent)' : '1px solid transparent',
                  outlineOffset: -1,
                  background: isDropTarget ? 'color-mix(in oklch, var(--accent) 4%, transparent)' : undefined,
                  minHeight: 44,
                  transition: 'background 0.12s, outline 0.12s',
                }}
              >
                <table className="data-table" style={{ tableLayout: 'auto' }}>
                  <thead>
                    <tr>
                      <th style={{ width: 20, padding: '8px 8px' }}></th>
                      <th style={{ width: 190 }}>항목</th>
                      <th style={{ width: 150, textAlign: 'center', padding: '8px 14px' }}>금액</th>
                      <th style={{ width: 136, textAlign: 'center', padding: '8px 14px' }}>단가</th>
                      <th style={{ width: 88, textAlign: 'center', padding: '8px 14px' }}>수량</th>
                      <th style={{ textAlign: 'center' }}>기간</th>
                      <th style={{ width: 80, textAlign: 'center', padding: '8px 14px' }}>유형</th>
                      <th style={{ width: 28, padding: '8px 8px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupItems.length === 0 && (
                      <tr>
                        <td colSpan={8} style={{ padding: '10px 0', color: 'var(--muted)', fontSize: 14 }}>
                          비어 있음 — 항목을 여기로 끌어놓을 수 있습니다.
                        </td>
                      </tr>
                    )}
                    {groupItems.map((it) => (
                      <tr
                        key={it.id}
                        style={{
                          opacity: dragId === it.id ? 0.4 : 1,
                          outline: dragOverId === it.id ? '2px solid var(--accent)' : undefined,
                        }}
                        onDragOver={(e) => {
                          if (dragId === null || dragId === it.id) return
                          e.preventDefault()
                          setDragOverId(it.id)
                          setDragOverGroup(null)
                        }}
                        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverId(null) }}
                        onDrop={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          if (dragId !== null && dragId !== it.id) moveItem(dragId, it.id)
                          setDragId(null); setDragOverId(null); setDragOverGroup(null)
                        }}
                      >
                        <td style={{ padding: '8px 8px' }}>
                          <span
                            draggable
                            onDragStart={() => setDragId(it.id)}
                            onDragEnd={() => { setDragId(null); setDragOverId(null); setDragOverGroup(null) }}
                            className="cursor-grab text-[var(--muted)] inline-flex"
                            aria-label="드래그로 이동"
                          >
                            <GripIcon style={{ width: 16, height: 16 }} />
                          </span>
                        </td>
                        <td>
                          <input
                            className="bg-transparent outline-none w-[130px] text-[17px]"
                            value={it.name}
                            onChange={(e) => updateItem(it.id, { name: e.target.value })}
                          />
                        </td>
                        <td className="num font-semibold text-[var(--ink)]" style={{ textAlign: 'center', padding: '8px 14px' }}>
                          {won(lineTotal(it))}
                        </td>
                        <td className="num" style={{ padding: '8px 14px' }}>
                          <AmountInput value={it.amount} onUpdate={(v) => updateItem(it.id, { amount: v })} width={112} />
                        </td>
                        <td className="num" style={{ padding: '8px 14px' }}>
                          <input
                            className="field-input w-[64px]"
                            type="number"
                            min={0}
                            max={it.type === '월별' ? maxMonths : undefined}
                            value={it.qty}
                            onChange={(e) => {
                              const raw = Number(e.target.value) || 0
                              const qty = it.type === '월별' ? Math.min(maxMonths, Math.max(0, raw)) : Math.max(0, raw)
                              updateItem(it.id, { qty })
                            }}
                          />
                        </td>
                        <td>
                          <PeriodBar item={it} periodStart={periodStart} periodEnd={periodEnd} stages={stages} />
                        </td>
                        <td style={{ padding: '8px 14px' }}>
                          <select
                            className="field-input !text-left !px-2"
                            value={it.type}
                            onChange={(e) => {
                              const type = e.target.value as LineType
                              const qty = type === '월별' ? Math.min(Math.max(1, it.qty), maxMonths) : it.qty
                              updateItem(it.id, { type, qty })
                            }}
                          >
                            {LEDGER_TYPES.map((t) => (
                              <option key={t} value={t}>{t}</option>
                            ))}
                          </select>
                        </td>
                        <td style={{ padding: '8px 8px' }}>
                          <button className="x" aria-label="삭제" onClick={() => removeItem(it.id)}>
                            <TrashIcon />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        })}
      </div>

      {/* ---- 구획 설정 모달 ---- */}
      <Modal
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        title="구획 설정"
        sub="항목을 묶는 구획을 추가·삭제하거나 드래그로 순서를 바꿉니다"
        width={572}
        disableBackdropClose
      >
        <div className="flex flex-col gap-2 pt-1">
          {groups.map((g, i) => {
            const count = items.filter((it) => it.groupKey === g.key).length
            return (
              <div
                key={g.key}
                draggable
                onDragStart={(e) => {
                  if ((e.target as HTMLElement).closest('button')) { e.preventDefault(); return }
                  setGroupDragIdx(i)
                  e.dataTransfer.effectAllowed = 'move'
                }}
                onDragEnd={() => { setGroupDragIdx(null); setGroupDragOverIdx(null) }}
                onDragOver={(e) => { if (groupDragIdx !== null) { e.preventDefault(); setGroupDragOverIdx(i) } }}
                onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setGroupDragOverIdx(null) }}
                onDrop={(e) => {
                  e.preventDefault()
                  if (groupDragIdx !== null && groupDragIdx !== i) reorderGroup(groupDragIdx, i)
                  setGroupDragIdx(null); setGroupDragOverIdx(null)
                }}
                className="flex items-center gap-3"
                style={{
                  padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface-2)',
                  opacity: groupDragIdx === i ? 0.4 : 1,
                  outline: groupDragOverIdx === i && groupDragIdx !== i ? '2px solid var(--accent)' : undefined,
                  outlineOffset: -1,
                  cursor: 'grab',
                }}
              >
                <span className="text-[var(--muted)] inline-flex flex-none" aria-hidden>
                  <GripIcon style={{ width: 16, height: 16 }} />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[16px] font-semibold" style={{ color: 'var(--fg)' }}>{g.name}</div>
                  <div className="text-[13px]" style={{ color: 'var(--muted)' }}>{count}개 항목</div>
                </div>
                <button
                  className="x"
                  aria-label="구획 삭제"
                  disabled={groups.length <= 1}
                  title={groups.length <= 1 ? '구획은 최소 1개가 필요합니다' : count > 0 ? `${count}개 항목이 있습니다 — 삭제 전 확인` : '삭제'}
                  onClick={() => (count > 0 ? setDeleteGroupKey(g.key) : removeGroup(g.key))}
                  style={{ opacity: groups.length <= 1 ? 0.4 : 1, cursor: groups.length <= 1 ? 'default' : 'pointer' }}
                >
                  <TrashIcon />
                </button>
              </div>
            )
          })}
          <form
            className="flex gap-2 mt-2"
            onSubmit={(e) => {
              e.preventDefault()
              const name = newGroupName.trim()
              if (!name) return
              addGroup(name)
              setNewGroupName('')
            }}
          >
            <input
              className="field-input flex-1"
              placeholder="새 구획 이름"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
            />
            <button
              type="submit"
              style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 10, padding: '0 18px', fontWeight: 700, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              추가
            </button>
          </form>

          {onDeleteCard && (
            <>
              <div style={{ borderTop: '1px solid var(--border)', margin: '10px 0 2px' }} />
              <button
                className="pill"
                style={{ color: '#ef4444', borderColor: 'color-mix(in oklch, #ef4444 40%, var(--border))', alignSelf: 'flex-start' }}
                onClick={() => setDeleteCardConfirm(true)}
              >
                <TrashIcon style={{ width: 13, height: 13 }} /> 이 카드 삭제
              </button>
            </>
          )}
        </div>
      </Modal>

      {/* ---- 구획 삭제 경고 ---- */}
      <Modal open={deleteGroupKey !== null} onClose={() => setDeleteGroupKey(null)} title="구획 삭제" width={400}>
        {deleteGroupKey !== null && (() => {
          const g = groups.find((gr) => gr.key === deleteGroupKey)
          const count = items.filter((it) => it.groupKey === deleteGroupKey).length
          const fallback = groups[0]?.key === deleteGroupKey ? groups[1] : groups[0]
          return (
            <div className="flex flex-col gap-5 pt-1">
              <p className="text-[17px] text-[var(--fg)]">
                <b>'{g?.name}'</b> 구획에 <b>{count}개 항목</b>이 들어 있습니다.<br />
                <span className="text-[var(--muted)] text-[15px]">
                  삭제하면 그 항목들은 '{fallback?.name}' 구획으로 옮겨집니다.
                </span>
              </p>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setDeleteGroupKey(null)}
                  style={{ background: 'var(--surface-2)', color: 'var(--fg)', border: 'none', borderRadius: 10, padding: '0 20px', height: 36, fontWeight: 700, fontSize: 16, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  취소
                </button>
                <button
                  onClick={() => { removeGroup(deleteGroupKey); setDeleteGroupKey(null) }}
                  style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: 10, padding: '0 20px', height: 36, fontWeight: 700, fontSize: 16, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  삭제
                </button>
              </div>
            </div>
          )
        })()}
      </Modal>

      {/* ---- 카드 삭제 경고 (사용자 추가 카드 전용) ---- */}
      {onDeleteCard && (
        <Modal open={deleteCardConfirm} onClose={() => setDeleteCardConfirm(false)} title="카드 삭제" width={400}>
          <div className="flex flex-col gap-5 pt-1">
            <p className="text-[17px] text-[var(--fg)]">
              <b>'{title}'</b> 카드를 삭제할까요?<br />
              <span className="text-[var(--muted)] text-[15px]">
                안에 있는 {items.length}개 항목이 모두 함께 삭제되며, 되돌릴 수 없습니다.
              </span>
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setDeleteCardConfirm(false)}
                style={{ background: 'var(--surface-2)', color: 'var(--fg)', border: 'none', borderRadius: 10, padding: '0 20px', height: 36, fontWeight: 700, fontSize: 16, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                취소
              </button>
              <button
                onClick={() => { onDeleteCard(); setDeleteCardConfirm(false) }}
                style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: 10, padding: '0 20px', height: 36, fontWeight: 700, fontSize: 16, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                삭제
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
