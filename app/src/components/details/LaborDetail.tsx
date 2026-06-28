import { useState, useRef } from 'react'
import Modal from '../ui/Modal'
import DetailHeader from './DetailHeader'
import { PlusIcon, MinusIcon, ExpandIcon } from '../icons'
import { won, wonCompact, fmtMD } from '../../lib/format'
import { ppdP, type Person, type MD } from '../../lib/schedule'
import {
  useLaborStore,
  laborTotal,
  roleTotal,
  roleTotalDays,
  personExtrasDays,
  type Section,
} from '../../store/laborStore'
import { useProjectStore } from '../../store/projectStore'

const MONTHS = [5, 6, 7, 8, 9] // 0-based: 6월..10월
const monthLabel = (m: number) => `${m + 1}월`
const PATTERNS: { v: number; label: string }[] = [
  { v: 7, label: '주 7일' },
  { v: 6, label: '주 6일 (수 휴무)' },
  { v: 5, label: '주 5일' },
]

const SECTIONS = [
  { key: 'planning' as const },
  { key: 'sales' as const },
  { key: 'other' as const },
]

const GripSVG = () => (
  <svg viewBox="0 0 10 16" fill="currentColor" width="10" height="16" style={{ pointerEvents: 'none' }}>
    <circle cx="3" cy="3" r="1.5" /><circle cx="7" cy="3" r="1.5" />
    <circle cx="3" cy="8" r="1.5" /><circle cx="7" cy="8" r="1.5" />
    <circle cx="3" cy="13" r="1.5" /><circle cx="7" cy="13" r="1.5" />
  </svg>
)

function RateInput({ value, onCommit }: { value: number; onCommit: (v: number) => void }) {
  const [editing, setEditing] = useState(false)
  const [raw, setRaw] = useState('')
  return (
    <input
      className="field-input w-[140px]"
      type="text"
      inputMode="numeric"
      value={editing ? raw : value.toLocaleString('ko-KR')}
      onFocus={() => { setEditing(true); setRaw(value > 0 ? String(value) : '') }}
      onChange={(e) => {
        const s = e.target.value.replace(/[^0-9]/g, '')
        setRaw(s)
        onCommit(parseInt(s) || 0)
      }}
      onBlur={() => setEditing(false)}
    />
  )
}

export default function LaborDetail() {
  const roles = useLaborStore((s) => s.roles)
  const sectionNames = useLaborStore((s) => s.sectionNames)
  const { addRole, changeRoleSection, removeRole, reorderRole, renameRole, setDaily, addPerson, removePerson, updatePerson, renameSection } =
    useLaborStore()
  const extras = useProjectStore((s) => s.extras)

  const [detailRole, setDetailRole] = useState<number | null>(null)
  const [rateOpen, setRateOpen] = useState(false)
  const [rateDailyModal, setRateDailyModal] = useState<number | null>(null)

  // section name editing
  const [editingSection, setEditingSection] = useState<Section | null>(null)
  const [editSectionVal, setEditSectionVal] = useState('')

  // card drag state
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)
  const [dragOverSection, setDragOverSection] = useState<Section | null>(null)
  const cardDragOccurred = useRef(false)

  // rate table drag state
  const [rateDragIdx, setRateDragIdx] = useState<number | null>(null)
  const [rateDragOver, setRateDragOver] = useState<number | null>(null)
  const rateDragAllowed = useRef(false)

  // delete confirm modal
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)

  const total = laborTotal(roles, extras)

  return (
    <div className="pb-8" data-c="labor">
      <DetailHeader
        title="인건비"
        subtitle={`직무 ${roles.length}개`}
        total={total}
        actions={
          <button className="pill" onClick={() => setRateOpen(true)}>
            단가표
          </button>
        }
      />

      <div className="px-6 pt-5">
        {SECTIONS.map((sec, si) => {
          const secRoles = roles.flatMap((r, i) =>
            (r.section ?? 'planning') === sec.key ? [{ r, i }] : []
          )
          const secTotal = secRoles.reduce((sum, { r }) => sum + roleTotal(r, extras), 0)
          const isDropTarget = dragOverSection === sec.key && dragIdx !== null && (roles[dragIdx]?.section ?? 'planning') !== sec.key
          return (
            <div key={sec.key}>
              {si > 0 && (
                <div style={{ borderTop: '1px solid var(--border)', margin: '2px 0' }} />
              )}
              <div
                className="py-4"
                onDragOver={(e) => {
                  e.preventDefault()
                  if (dragIdx !== null && (roles[dragIdx]?.section ?? 'planning') !== sec.key) {
                    setDragOverSection(sec.key)
                  }
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverSection(null)
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  if (dragIdx !== null && (roles[dragIdx]?.section ?? 'planning') !== sec.key) {
                    changeRoleSection(dragIdx, sec.key)
                  }
                  setDragIdx(null); setDragOver(null); setDragOverSection(null)
                }}
                style={{
                  borderRadius: 12,
                  background: isDropTarget ? 'color-mix(in oklch, var(--accent) 5%, transparent)' : undefined,
                  outline: isDropTarget ? '2px dashed var(--accent)' : undefined,
                  outlineOffset: isDropTarget ? -2 : undefined,
                  transition: 'background 0.15s, outline 0.15s',
                }}
              >
                <div className="flex items-center gap-3 mb-3">
                  {editingSection === sec.key ? (
                    <input
                      autoFocus
                      className="text-[14px] font-bold tracking-widest uppercase bg-transparent outline-none border-b-2"
                      style={{ color: 'var(--muted)', borderColor: 'var(--accent)', minWidth: 60 }}
                      value={editSectionVal}
                      onChange={(e) => setEditSectionVal(e.target.value)}
                      onBlur={() => {
                        renameSection(sec.key, editSectionVal.trim() || sectionNames[sec.key])
                        setEditingSection(null)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          renameSection(sec.key, editSectionVal.trim() || sectionNames[sec.key])
                          setEditingSection(null)
                        }
                        if (e.key === 'Escape') setEditingSection(null)
                      }}
                    />
                  ) : (
                    <div
                      className="text-[14px] font-bold tracking-widest uppercase select-none cursor-default"
                      style={{ color: 'var(--muted)' }}
                      title="더블클릭하여 이름 수정"
                      onDoubleClick={() => {
                        setEditingSection(sec.key)
                        setEditSectionVal(sectionNames[sec.key] ?? '')
                      }}
                    >
                      {sectionNames[sec.key]}
                    </div>
                  )}
                  {secTotal > 0 && (
                    <div className="text-[16px] font-semibold tabular" style={{ color: 'var(--fg)' }}>
                      {won(secTotal)}
                    </div>
                  )}
                </div>
                <div className="grid gap-3.5" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                  {secRoles.map(({ r, i }) => (
                    <div
                      key={i}
                      draggable
                      onDragStart={(e) => {
                        if ((e.target as HTMLElement).closest('input,button')) { e.preventDefault(); return }
                        cardDragOccurred.current = true
                        setDragIdx(i)
                        e.dataTransfer.effectAllowed = 'move'
                      }}
                      onDragEnd={() => {
                        setTimeout(() => { cardDragOccurred.current = false }, 80)
                        setDragIdx(null); setDragOver(null); setDragOverSection(null)
                      }}
                      onClick={(e) => {
                        if ((e.target as HTMLElement).closest('input,button')) return
                        if (cardDragOccurred.current) return
                        setRateDailyModal(i)
                      }}
                      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (dragIdx !== i) setDragOver(i) }}
                      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(null) }}
                      onDrop={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        if (dragIdx !== null) {
                          const fromSection = roles[dragIdx]?.section ?? 'planning'
                          if (fromSection !== sec.key) {
                            changeRoleSection(dragIdx, sec.key)
                          } else if (dragIdx !== i) {
                            reorderRole(dragIdx, i)
                          }
                        }
                        setDragIdx(null); setDragOver(null); setDragOverSection(null)
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault()
                        setDeleteConfirm(i)
                      }}
                      className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow)] flex flex-col gap-3 transition-opacity select-none"
                      style={{
                        cursor: dragIdx === i ? 'grabbing' : 'pointer',
                        opacity: dragIdx === i ? 0.35 : 1,
                        outline: dragOver === i ? '2px solid var(--accent)' : undefined,
                        outlineOffset: dragOver === i ? 2 : undefined,
                      }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <input
                            className="w-full bg-transparent font-semibold text-[18px] text-[var(--ink)] outline-none border-b border-transparent focus:border-[var(--border)] cursor-text"
                            value={r.name}
                            spellCheck={false}
                            onChange={(e) => renameRole(i, e.target.value)}
                            onMouseDown={(e) => e.stopPropagation()}
                          />
                          <div className="text-[15px] text-[var(--muted)] mt-1">
                            {roleTotalDays(r, extras)}일 · <b className="text-[var(--fg)]">{r.people.length}명</b>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-none">
                          <button
                            className="back-btn !w-8 !h-8"
                            aria-label="인원 감소"
                            disabled={r.people.length === 0}
                            onClick={() => removePerson(i)}
                          >
                            <MinusIcon />
                          </button>
                          <button className="back-btn !w-8 !h-8" aria-label="인원 추가" onClick={() => addPerson(i)}>
                            <PlusIcon />
                          </button>
                          <button className="back-btn !w-8 !h-8" aria-label="상세 보기" onClick={() => setDetailRole(i)}>
                            <ExpandIcon />
                          </button>
                        </div>
                      </div>
                      <div className="font-display text-[23px] font-semibold text-[var(--ink)] tabular">
                        {won(roleTotal(r, extras))}
                      </div>
                      <div className="text-[14.5px] text-[var(--muted)] font-mono">
                        일 {wonCompact(r.daily)} × {roleTotalDays(r, extras)}일
                      </div>
                    </div>
                  ))}
                  {secRoles.length < 8 && (
                    <button
                      className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-2)] p-4 min-h-[120px] flex flex-col items-center justify-center gap-2 text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
                      onClick={() => addRole(sec.key)}
                    >
                      <PlusIcon style={{ width: 20, height: 20 }} />
                      <span className="text-[17px] font-semibold">직무 추가</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* ---- card rate modal ---- */}
      <Modal
        open={rateDailyModal !== null}
        onClose={() => setRateDailyModal(null)}
        title={rateDailyModal !== null ? roles[rateDailyModal]?.name ?? '' : ''}
        sub="일 단가 조정"
        width={360}
      >
        {rateDailyModal !== null && (() => {
          const r = roles[rateDailyModal]
          if (!r) return null
          const totalDays = roleTotalDays(r, extras)
          return (
            <div className="flex flex-col gap-4 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-[16px] text-[var(--muted)]">일 단가</span>
                <RateInput value={r.daily} onCommit={(v) => setDaily(rateDailyModal, v)} />
              </div>
              <div className="flex items-center justify-between text-[15px]">
                <span className="text-[var(--muted)]">총 근무일</span>
                <span className="font-mono font-semibold">{totalDays}일</span>
              </div>
              <div className="flex items-center justify-between pt-3" style={{ borderTop: '1px solid var(--border)' }}>
                <span className="text-[16px] text-[var(--muted)]">합계</span>
                <span className="font-display text-[24px] font-bold tabular">{won(roleTotal(r, extras))}</span>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={() => setRateDailyModal(null)}
                  style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 10, padding: '8px 20px', fontWeight: 700, fontSize: 16, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  확인
                </button>
              </div>
            </div>
          )
        })()}
      </Modal>

      {/* ---- delete confirm modal ---- */}
      <Modal
        open={deleteConfirm !== null}
        onClose={() => setDeleteConfirm(null)}
        title="직무 삭제"
        width={360}
      >
        {deleteConfirm !== null && (
          <div className="flex flex-col gap-5 pt-1">
            <p className="text-[16px] text-[var(--fg)]">
              <b>'{roles[deleteConfirm]?.name}'</b> 직무를 삭제할까요?<br />
              <span className="text-[var(--muted)] text-[14px]">이 작업은 되돌릴 수 없습니다.</span>
            </p>
            <div className="flex gap-2 justify-end">
              <button
                className="back-btn px-4 h-9 text-[15px]"
                onClick={() => setDeleteConfirm(null)}
              >
                취소
              </button>
              <button
                onClick={() => { removeRole(deleteConfirm); setDeleteConfirm(null) }}
                style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: 10, padding: '0 20px', height: 36, fontWeight: 700, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                삭제
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ---- role detail modal ---- */}
      <Modal
        open={detailRole !== null}
        onClose={() => setDetailRole(null)}
        title={detailRole !== null ? roles[detailRole].name : ''}
        sub="인원별 근무 기간 · 패턴"
        width={640}
      >
        {detailRole !== null && (
          <RoleBody
            roleIndex={detailRole}
            person={roles[detailRole].people}
            daily={roles[detailRole].daily}
            extras={extras}
            onAddPerson={() => addPerson(detailRole)}
            onRemovePerson={() => removePerson(detailRole)}
            onUpdatePerson={(pi, patch) => updatePerson(detailRole, pi, patch)}
          />
        )}
      </Modal>

      {/* ---- rate table modal ---- */}
      <Modal
        open={rateOpen}
        onClose={() => setRateOpen(false)}
        title="단가표"
        sub={`직무 ${roles.length}개 · 일 단가 조정`}
        width={520}
      >
        <table className="data-table mt-2.5">
          <thead>
            <tr>
              <th style={{ width: 28 }}></th>
              <th>직무</th>
              <th style={{ textAlign: 'right' }}>일 단가</th>
              <th style={{ textAlign: 'right', minWidth: 120 }}>소계</th>
            </tr>
          </thead>
          <tbody>
            {roles.map((r, i) => (
              <tr
                key={i}
                draggable
                onDragStart={(e) => {
                  if (!rateDragAllowed.current) { e.preventDefault(); return }
                  setRateDragIdx(i)
                  e.dataTransfer.effectAllowed = 'move'
                }}
                onDragEnd={() => { rateDragAllowed.current = false; setRateDragIdx(null); setRateDragOver(null) }}
                onDragOver={(e) => { e.preventDefault(); if (rateDragIdx !== i) setRateDragOver(i) }}
                onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setRateDragOver(null) }}
                onDrop={(e) => {
                  e.preventDefault()
                  if (rateDragIdx !== null && rateDragIdx !== i) reorderRole(rateDragIdx, i)
                  setRateDragIdx(null); setRateDragOver(null)
                }}
                style={{
                  opacity: rateDragIdx === i ? 0.35 : 1,
                  background: rateDragOver === i ? 'color-mix(in oklch, var(--accent) 8%, white)' : undefined,
                  outline: rateDragOver === i ? '2px solid var(--accent)' : undefined,
                }}
              >
                <td
                  style={{ cursor: 'grab', textAlign: 'center', color: 'var(--muted)', padding: '6px 4px', width: 28 }}
                  onMouseDown={() => { rateDragAllowed.current = true }}
                  onMouseUp={() => { rateDragAllowed.current = false }}
                >
                  <GripSVG />
                </td>
                <td
                  style={{ fontWeight: 600, cursor: 'grab' }}
                  onMouseDown={() => { rateDragAllowed.current = true }}
                  onMouseUp={() => { rateDragAllowed.current = false }}
                >{r.name}</td>
                <td style={{ textAlign: 'right' }}>
                  <RateInput value={r.daily} onCommit={(v) => setDaily(i, v)} />
                </td>
                <td className="num" style={{ fontSize: 13, color: 'var(--muted)', minWidth: 120 }}>
                  {won(roleTotal(r, extras))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ position: 'sticky', bottom: 0, background: 'var(--surface)', padding: '12px 0 2px', borderTop: '1px solid var(--border)', marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={() => setRateOpen(false)}
            style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 10, padding: '8px 20px', fontWeight: 700, fontSize: 16, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            저장
          </button>
        </div>
      </Modal>
    </div>
  )
}

function RoleBody({
  person,
  daily,
  extras,
  onAddPerson,
  onRemovePerson,
  onUpdatePerson,
}: {
  roleIndex: number
  person: Person[]
  daily: number
  extras: { name: string; days: number }[]
  onAddPerson: () => void
  onRemovePerson: () => void
  onUpdatePerson: (pi: number, patch: Partial<Person>) => void
}) {
  const setMD = (pi: number, field: 's' | 'e', which: 0 | 1, val: number) => {
    const cur = person[pi][field]
    const next: MD = which === 0 ? [val, cur[1]] : [cur[0], val]
    onUpdatePerson(pi, { [field]: next } as Partial<Person>)
  }

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[16px] text-[var(--muted)]">인원 {person.length}명</span>
        <div className="flex gap-1.5">
          <button className="back-btn !w-8 !h-8" onClick={onRemovePerson} disabled={person.length === 0} aria-label="인원 감소">
            <MinusIcon />
          </button>
          <button className="back-btn !w-8 !h-8" onClick={onAddPerson} aria-label="인원 추가">
            <PlusIcon />
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2 max-h-[52vh] overflow-auto pr-1">
        {person.map((p, pi) => {
          const days = ppdP(p) + personExtrasDays(p, extras)
          return (
            <div key={pi} className="rounded-xl border border-[var(--border)] p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[16px] font-semibold">#{pi + 1}</span>
                <span className="text-[15px] font-mono text-[var(--muted)]">
                  {days}일 · {won(daily * days)}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[16px]">
                <DateField label="시작" md={p.s} onMonth={(v) => setMD(pi, 's', 0, v)} onDay={(v) => setMD(pi, 's', 1, v)} />
                <span className="text-[var(--muted)]">~</span>
                <DateField label="종료" md={p.e} onMonth={(v) => setMD(pi, 'e', 0, v)} onDay={(v) => setMD(pi, 'e', 1, v)} />
                <select
                  className="field-input !text-left"
                  value={p.pat?.[p.s[0]] ?? 6}
                  onChange={(e) => {
                    const v = Number(e.target.value)
                    const pat: Record<number, number> = {}
                    for (let m = p.s[0]; m <= p.e[0]; m++) pat[m] = v
                    onUpdatePerson(pi, { pat })
                  }}
                >
                  {PATTERNS.map((pt) => (
                    <option key={pt.v} value={pt.v}>
                      {pt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function DateField({
  label,
  md,
  onMonth,
  onDay,
}: {
  label: string
  md: MD
  onMonth: (v: number) => void
  onDay: (v: number) => void
}) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="text-[14px] text-[var(--muted)]">{label}</span>
      <select className="field-input !text-left !px-2" value={md[0]} onChange={(e) => onMonth(Number(e.target.value))}>
        {MONTHS.map((m) => (
          <option key={m} value={m}>
            {monthLabel(m)}
          </option>
        ))}
      </select>
      <input
        className="field-input w-[56px]"
        type="number"
        min={1}
        max={31}
        value={md[1]}
        onChange={(e) => onDay(Number(e.target.value) || 1)}
      />
      <span className="text-[14px] text-[var(--muted)]">{fmtMD(md[0], md[1])}</span>
    </span>
  )
}
