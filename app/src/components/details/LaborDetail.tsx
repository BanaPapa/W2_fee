import { useState, useMemo, useEffect, useRef } from 'react'
import Modal from '../ui/Modal'
import DetailHeader from './DetailHeader'
import { PlusIcon, MinusIcon } from '../icons'
import { won, wonCompact } from '../../lib/format'
import { YEAR, D, isWorkP, patOf, DOW, type Person } from '../../lib/schedule'
import {
  useLaborStore,
  laborTotal,
  roleTotal,
  roleTotalDays,
  type Role,
  type Section,
} from '../../store/laborStore'
import { useProjectStore, toDate, toIso, MS_DAY } from '../../store/projectStore'

const PATTERNS: { v: number; label: string }[] = [
  { v: 7, label: '주 7일' },
  { v: 6, label: '주 6일 (수 휴무)' },
  { v: 5, label: '주 5일' },
]

const SECTIONS = [
  { key: 'planning' as const, maxCards: 4 },
  { key: 'sales' as const, maxCards: 4 },
  { key: 'other' as const, maxCards: 8 },
]

type KeyDateType = 'open' | 'contract' | 'alt'

const KEY_DATE_COLORS: Record<KeyDateType, {
  headerBg: string; headerFg: string
  workedBg: string; offBg: string; dot: string; totalFg: string
}> = {
  open:     { headerBg: 'rgba(251,191,36,0.22)',  headerFg: '#92400e', workedBg: 'rgba(251,191,36,0.45)', offBg: 'rgba(251,191,36,0.09)', dot: '#b45309', totalFg: '#b45309' },
  contract: { headerBg: 'rgba(34,197,94,0.16)',   headerFg: '#166534', workedBg: 'rgba(34,197,94,0.32)',  offBg: 'rgba(34,197,94,0.07)',  dot: '#15803d', totalFg: '#15803d' },
  alt:      { headerBg: 'rgba(168,85,247,0.16)',  headerFg: '#6b21a8', workedBg: 'rgba(168,85,247,0.30)', offBg: 'rgba(168,85,247,0.07)', dot: '#7e22ce', totalFg: '#7e22ce' },
}

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
  const periodStart = useProjectStore((s) => s.periodStart)
  const periodEnd = useProjectStore((s) => s.periodEnd)

  const projectMonths: number[] = []
  const sm = new Date(periodStart).getMonth()
  const em = new Date(periodEnd).getMonth()
  for (let m = sm; m <= em; m++) projectMonths.push(m)

  const [detailRole, setDetailRole] = useState<number | null>(null)
  const [rateOpen, setRateOpen] = useState(false)

  const [editingSection, setEditingSection] = useState<Section | null>(null)
  const [editSectionVal, setEditSectionVal] = useState('')

  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)
  const [dragOverSection, setDragOverSection] = useState<Section | null>(null)
  const cardDragOccurred = { current: false }

  const [rateDragIdx, setRateDragIdx] = useState<number | null>(null)
  const [rateDragOver, setRateDragOver] = useState<number | null>(null)
  const rateDragAllowed = { current: false }

  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)
  const [integratedOpen, setIntegratedOpen] = useState(false)
  const [detailMonth, setDetailMonth] = useState<number | null>(null)

  const total = laborTotal(roles, extras)

  return (
    <div className="pb-8" data-c="labor">
      <DetailHeader
        title="인건비"
        subtitle={`직무 ${roles.length}개`}
        total={total}
        actions={
          <>
            <button className="pill" onClick={() => setIntegratedOpen(true)}>
              통합 달력
            </button>
            <button className="pill" onClick={() => setRateOpen(true)}>
              단가표
            </button>
          </>
        }
      />

      <div className="px-6 pt-5">
        {SECTIONS.map((sec, si) => {
          const secRoles = roles.flatMap((r, i) =>
            (r.section ?? 'planning') === sec.key ? [{ r, i }] : []
          )
          const { maxCards } = sec
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
                        setDetailMonth(null)
                        setDetailRole(i)
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
                  {secRoles.length < maxCards && (
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

      {/* ---- 삭제 확인 모달 ---- */}
      <Modal
        open={deleteConfirm !== null}
        onClose={() => setDeleteConfirm(null)}
        title="직무 삭제"
        width={432}
      >
        {deleteConfirm !== null && (
          <div className="flex flex-col gap-5 pt-1">
            <p className="text-[18px] text-[var(--fg)]">
              <b>'{roles[deleteConfirm]?.name}'</b> 직무를 삭제할까요?<br />
              <span className="text-[var(--muted)] text-[16px]">이 작업은 되돌릴 수 없습니다.</span>
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setDeleteConfirm(null)}
                style={{ background: 'var(--surface-2)', color: 'var(--fg)', border: 'none', borderRadius: 10, padding: '0 20px', height: 36, fontWeight: 700, fontSize: 17, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                취소
              </button>
              <button
                onClick={() => { removeRole(deleteConfirm); setDeleteConfirm(null) }}
                style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: 10, padding: '0 20px', height: 36, fontWeight: 700, fontSize: 17, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                삭제
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ---- 통합 달력 모달 ---- */}
      <Modal
        open={integratedOpen}
        onClose={() => setIntegratedOpen(false)}
        title="전체 직무 통합 달력"
        widthCss="60vw"
        heightCss="95vh"
      >
        {integratedOpen && (
          <IntegratedCalendarModal
            roles={roles}
            projectMonths={projectMonths}
            onOpenRoleCalendar={(ri, m) => { setDetailMonth(m); setDetailRole(ri) }}
          />
        )}
      </Modal>

      {/* ---- 달력 상세 모달 (통합 달력 위에 뜰 수 있어 아래에 배치) ---- */}
      <Modal
        open={detailRole !== null}
        onClose={() => { setDetailRole(null); setDetailMonth(null) }}
        title={detailRole !== null ? roles[detailRole]?.name ?? '' : ''}
        widthCss="60vw"
        heightCss="95vh"
        headerControls={detailRole !== null ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginLeft: 16 }}>
            <span style={{ fontSize: 21, fontWeight: 800, color: 'var(--ink)' }}>{roles[detailRole]?.people.length ?? 0}명</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button className="back-btn !w-7 !h-7" disabled={(roles[detailRole]?.people.length ?? 0) === 0} onClick={() => removePerson(detailRole!)} aria-label="인원 감소">
                <MinusIcon />
              </button>
              <button className="back-btn !w-7 !h-7" onClick={() => addPerson(detailRole!)} aria-label="인원 추가">
                <PlusIcon />
              </button>
            </div>
          </div>
        ) : undefined}
      >
        {detailRole !== null && roles[detailRole] && (
          <CalendarModal
            role={roles[detailRole]}
            projectMonths={projectMonths}
            onUpdatePerson={(pi, patch) => updatePerson(detailRole, pi, patch)}
            scrollToMonth={detailMonth ?? undefined}
          />
        )}
      </Modal>

      {/* ---- 단가표 모달 ---- */}
      <Modal
        open={rateOpen}
        onClose={() => setRateOpen(false)}
        title="단가표"
        sub={`직무 ${roles.length}개 · 일 단가 조정`}
        width={749}
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
            {SECTIONS.map((sec, si) => {
              const secRolesInModal = roles.flatMap((r, i) =>
                (r.section ?? 'planning') === sec.key ? [{ r, i }] : []
              )
              if (secRolesInModal.length === 0) return null
              return (
                <>
                  <tr key={`sec-header-${sec.key}`}>
                    <td colSpan={4} style={{ padding: si === 0 ? '4px 0 6px' : '14px 0 6px', fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)', borderTop: si > 0 ? '2px solid var(--border)' : undefined }}>
                      {sectionNames[sec.key]}
                    </td>
                  </tr>
                  {secRolesInModal.map(({ r, i }) => (
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
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                            <button
                              onClick={() => setDaily(i, r.daily + 10000)}
                              style={{ width: 22, height: 18, border: '1px solid var(--border)', borderRadius: 4, background: 'var(--surface-2)', color: 'var(--muted)', fontSize: 9, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, lineHeight: 1 }}
                              title="+1만원"
                            >▲</button>
                            <button
                              onClick={() => setDaily(i, Math.max(0, r.daily - 10000))}
                              style={{ width: 22, height: 18, border: '1px solid var(--border)', borderRadius: 4, background: 'var(--surface-2)', color: 'var(--muted)', fontSize: 9, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, lineHeight: 1 }}
                              title="-1만원"
                            >▼</button>
                          </div>
                          <RateInput value={r.daily} onCommit={(v) => setDaily(i, v)} />
                        </div>
                      </td>
                      <td className="num" style={{ color: 'var(--muted)', minWidth: 120 }}>
                        <span style={{ fontSize: 15 }}>{Math.round(roleTotal(r, extras)).toLocaleString('ko-KR')}</span>
                        <span style={{ fontSize: 13 }}> 원</span>
                      </td>
                    </tr>
                  ))}
                </>
              )
            })}
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

function CalendarModal({
  role,
  projectMonths,
  onUpdatePerson,
  scrollToMonth,
}: {
  role: Role
  projectMonths: number[]
  onUpdatePerson: (pi: number, patch: Partial<Person>) => void
  scrollToMonth?: number
}) {
  const monthRefs = useRef<Record<number, HTMLDivElement | null>>({})
  useEffect(() => {
    if (scrollToMonth == null) return
    monthRefs.current[scrollToMonth]?.scrollIntoView({ block: 'start' })
  }, [scrollToMonth])

  const toggleDay = (pi: number, month: number, day: number) => {
    const p = role.people[pi]
    const date = new Date(YEAR, month, day)
    const currently = isWorkP(date, p)
    const key = `${month}-${day}`
    onUpdatePerson(pi, { ov: { ...(p.ov ?? {}), [key]: !currently } })
  }

  const setPattern = (pi: number, v: number) => {
    const p = role.people[pi]
    const pat: Record<number, number> = {}
    for (let m = p.s[0]; m <= p.e[0]; m++) pat[m] = v
    onUpdatePerson(pi, { pat, ov: {} })
  }

  const stages = useProjectStore((s) => s.stages)
  const keyDates = useMemo(() => {
    const map = new Map<string, { label: string; type: KeyDateType }>()
    const main = stages.find((s) => s.id === 'main')
    if (!main) return map
    const contractDays = main.contractDays ?? 3
    for (const kd of main.keyDates ?? []) {
      if (kd.key === 'open') {
        map.set(kd.date, { label: kd.label, type: 'open' })
      } else if (kd.key === 'alt') {
        map.set(kd.date, { label: kd.label, type: 'alt' })
      } else if (kd.key === 'contract') {
        const startMs = toDate(kd.date).getTime()
        for (let i = 0; i < contractDays; i++) {
          map.set(toIso(startMs + i * MS_DAY), { label: i === 0 ? kd.label : '정당계약', type: 'contract' })
        }
      }
    }
    return map
  }, [stages])

  const effectivelyWorks = (date: Date, p: Person): boolean => {
    const iso = `${YEAR}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    const inPersonRange = date >= D(p.s) && date <= D(p.e)
    if (keyDates.has(iso) && inPersonRange) return true
    return isWorkP(date, p)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, marginTop: 10 }}>
      {/* 인원별 근무 패턴 */}
      {role.people.length > 0 && (
        <div style={{ flexShrink: 0, paddingBottom: 10, marginBottom: 4, borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {role.people.map((p, pi) => (
              <div key={pi} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: 'var(--surface-2)', borderRadius: 8, padding: '4px 8px',
              }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--fg)', minWidth: 26 }}>#{pi + 1}</span>
                <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                  <select
                    style={{
                      fontSize: 16, padding: '3px 26px 3px 8px', height: 30,
                      background: 'var(--surface-2)', border: '1px solid var(--border)',
                      borderRadius: 6, color: 'var(--fg)', appearance: 'none',
                      WebkitAppearance: 'none', cursor: 'pointer', fontFamily: 'inherit',
                    }}
                    value={patOf(p, p.s[0])}
                    onChange={(e) => setPattern(pi, Number(e.target.value))}
                  >
                    {PATTERNS.map((pt) => (
                      <option key={pt.v} value={pt.v}>{pt.label}</option>
                    ))}
                  </select>
                  <span style={{ position: 'absolute', right: 7, pointerEvents: 'none', fontSize: 11, color: 'var(--muted)', lineHeight: 1 }}>▾</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 월별 달력 — 세로 스크롤 */}
      <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 22, paddingTop: 14, paddingBottom: 12, paddingLeft: 25, paddingRight: 25, scrollbarGutter: 'stable' } as React.CSSProperties}>
        {projectMonths.map((m) => {
          const daysInM = new Date(YEAR, m + 1, 0).getDate()
          const days = Array.from({ length: daysInM }, (_, i) => i + 1)
          const dayTotal = (d: number) =>
            role.people.filter((p) => effectivelyWorks(new Date(YEAR, m, d), p)).length
          const personMonthDays = (pi: number) =>
            days.filter((d) => effectivelyWorks(new Date(YEAR, m, d), role.people[pi])).length
          const grandTotal = days.reduce((n, d) => n + dayTotal(d), 0)

          return (
            <div key={m} ref={(el) => { monthRefs.current[m] = el }}>
              {/* 월 라벨 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
                <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent)', whiteSpace: 'nowrap' }}>
                  {m + 1}월
                </span>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                <span style={{ fontSize: 16, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                  합계 {grandTotal}명·일
                </span>
              </div>

              {/* 전체 너비 테이블 (최소 680px 이하면 가로 스크롤) */}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ borderCollapse: 'collapse', tableLayout: 'fixed', width: '100%', minWidth: 680 }}>
                  <thead>
                    <tr>
                      <th style={{
                        width: 44, padding: '3px 6px 7px 0', textAlign: 'left',
                        color: 'var(--muted)', fontSize: 15, fontWeight: 600,
                        borderBottom: '2px solid var(--border)', whiteSpace: 'nowrap',
                      }}>
                        인원
                      </th>
                      {days.map((d) => {
                        const dow = new Date(YEAR, m, d).getDay()
                        const isSat = dow === 6, isSun = dow === 0
                        const iso = `${YEAR}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
                        const kdEntry = keyDates.get(iso)
                        const kdc = kdEntry ? KEY_DATE_COLORS[kdEntry.type] : null
                        return (
                          <th key={d} style={{
                            padding: '2px 1px 7px', textAlign: 'center',
                            fontSize: 14, fontWeight: 700,
                            color: kdc ? kdc.headerFg : isSat ? '#3b82f6' : isSun ? '#ef4444' : 'var(--muted)',
                            borderBottom: '2px solid var(--border)',
                            background: kdc ? kdc.headerBg : isSat ? 'rgba(59,130,246,0.06)' : isSun ? 'rgba(239,68,68,0.06)' : undefined,
                          }}>
                            <div>{d}</div>
                            <div style={{ fontSize: 13, fontWeight: 400, marginTop: 1 }}>{DOW[dow]}</div>
                            {kdEntry && (
                              <div style={{ fontSize: 10, fontWeight: 800, marginTop: 2, color: kdc!.headerFg, lineHeight: 1.1, whiteSpace: 'nowrap' }}>
                                {kdEntry.label}
                              </div>
                            )}
                          </th>
                        )
                      })}
                      <th style={{
                        width: 52, padding: '3px 0 7px 6px', textAlign: 'right',
                        color: 'var(--accent)', fontSize: 15, fontWeight: 700,
                        borderBottom: '2px solid var(--border)', whiteSpace: 'nowrap',
                      }}>
                        계
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {role.people.map((p, pi) => (
                      <tr key={pi} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '4px 10px 4px 0', fontWeight: 700, color: 'var(--fg)', fontSize: 16, whiteSpace: 'nowrap' }}>
                          #{pi + 1}
                        </td>
                        {days.map((d) => {
                          const date = new Date(YEAR, m, d)
                          const inRange = date >= D(p.s) && date <= D(p.e)
                          const iso = `${YEAR}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
                          const kdEntry = keyDates.get(iso)
                          const kdc = kdEntry ? KEY_DATE_COLORS[kdEntry.type] : null
                          const works = effectivelyWorks(date, p)
                          const dow = date.getDay()
                          const isSat = dow === 6, isSun = dow === 0

                          const bg = !inRange ? undefined
                            : works
                              ? kdc ? kdc.workedBg
                                : isSat ? 'rgba(59,130,246,0.22)'
                                : isSun ? 'rgba(239,68,68,0.22)'
                                : 'rgba(107,114,128,0.18)'
                              : kdc ? kdc.offBg
                                : isSat ? 'rgba(59,130,246,0.05)'
                                : isSun ? 'rgba(239,68,68,0.05)'
                                : undefined
                          const color = !inRange ? 'var(--border)'
                            : works
                              ? kdc ? kdc.dot
                                : isSat ? '#3b82f6'
                                : isSun ? '#ef4444'
                                : '#6b7280'
                            : 'transparent'

                          return (
                            <td
                              key={d}
                              onClick={() => inRange && toggleDay(pi, m, d)}
                              title={!inRange ? '근무 기간 외' : works ? '클릭: 휴무 처리' : '클릭: 근무 처리'}
                              style={{
                                height: 28, textAlign: 'center', padding: '2px 1px',
                                cursor: inRange ? 'pointer' : 'default',
                                borderRadius: 3, background: bg, color,
                                fontSize: 18, fontWeight: 900, userSelect: 'none',
                                transition: 'background 0.1s',
                              }}
                            >
                              {works ? '●' : inRange ? '' : '·'}
                            </td>
                          )
                        })}
                        <td style={{ padding: '4px 0 4px 10px', textAlign: 'right', fontWeight: 700, color: 'var(--accent)', fontSize: 16, whiteSpace: 'nowrap' }}>
                          {personMonthDays(pi)}
                        </td>
                      </tr>
                    ))}

                    {/* 일별 합계 행 */}
                    <tr style={{ borderTop: '2px solid var(--border)' }}>
                      <td style={{ padding: '5px 10px 3px 0', fontWeight: 700, color: 'var(--ink)', fontSize: 16 }}>합계</td>
                      {days.map((d) => {
                        const t = dayTotal(d)
                        return (
                          <td key={d} style={{
                            textAlign: 'center', fontSize: 16, fontWeight: 700,
                            color: t > 0 ? 'var(--ink)' : 'var(--border)', padding: '5px 1px 3px',
                          }}>
                            {t > 0 ? t : ''}
                          </td>
                        )
                      })}
                      <td style={{ padding: '5px 0 3px 10px', textAlign: 'right', fontWeight: 800, color: 'var(--ink)', fontSize: 17, whiteSpace: 'nowrap' }}>
                        {grandTotal}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )
        })}

        {/* 범례 */}
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', paddingTop: 8, borderTop: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 16, color: 'var(--muted)' }}>
            <span style={{ color: 'var(--accent)', fontWeight: 900, fontSize: 17 }}>●</span> 근무
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 16, color: 'var(--muted)' }}>
            <span style={{ color: 'var(--border)', fontSize: 17 }}>·</span> 기간 외
          </div>
        </div>
      </div>
    </div>
  )
}

function IntegratedCalendarModal({
  roles,
  projectMonths,
  onOpenRoleCalendar,
}: {
  roles: Role[]
  projectMonths: number[]
  onOpenRoleCalendar: (roleIndex: number, month: number) => void
}) {
  const updatePerson = useLaborStore((s) => s.updatePerson)
  const stages = useProjectStore((s) => s.stages)

  const keyDates = useMemo(() => {
    const map = new Map<string, { label: string; type: KeyDateType }>()
    const main = stages.find((s) => s.id === 'main')
    if (!main) return map
    const contractDays = main.contractDays ?? 3
    for (const kd of main.keyDates ?? []) {
      if (kd.key === 'open') {
        map.set(kd.date, { label: kd.label, type: 'open' })
      } else if (kd.key === 'alt') {
        map.set(kd.date, { label: kd.label, type: 'alt' })
      } else if (kd.key === 'contract') {
        const startMs = toDate(kd.date).getTime()
        for (let i = 0; i < contractDays; i++) {
          map.set(toIso(startMs + i * MS_DAY), { label: i === 0 ? kd.label : '정당계약', type: 'contract' })
        }
      }
    }
    return map
  }, [stages])

  const effectivelyWorks = (date: Date, p: Person): boolean => {
    const iso = `${YEAR}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    const inPersonRange = date >= D(p.s) && date <= D(p.e)
    if (keyDates.has(iso) && inPersonRange) return true
    return isWorkP(date, p)
  }

  const roleWorksInPeriod = (role: Role): boolean =>
    projectMonths.some((m) => {
      const daysInM = new Date(YEAR, m + 1, 0).getDate()
      for (let d = 1; d <= daysInM; d++) {
        const date = new Date(YEAR, m, d)
        if (role.people.some((p) => effectivelyWorks(date, p))) return true
      }
      return false
    })

  const visibleRoles = roles
    .map((role, ri) => ({ role, ri }))
    .filter(({ role }) => roleWorksInPeriod(role))

  const wrapperRef = useRef<HTMLDivElement>(null)
  const [popover, setPopover] = useState<{
    roleIndex: number
    m: number
    d: number
    top: number
    left: number
  } | null>(null)
  const popoverRole = popover ? roles[popover.roleIndex] : null

  const togglePersonDay = (roleIndex: number, personIndex: number, m: number, d: number, p: Person) => {
    const date = new Date(YEAR, m, d)
    const currently = isWorkP(date, p)
    const key = `${m}-${d}`
    updatePerson(roleIndex, personIndex, { ov: { ...(p.ov ?? {}), [key]: !currently } })
  }

  return (
    <div ref={wrapperRef} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, marginTop: 10, position: 'relative' }}>
      <div
        onScroll={() => setPopover(null)}
        style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 22, paddingTop: 14, paddingBottom: 12, paddingLeft: 25, paddingRight: 25, scrollbarGutter: 'stable' } as React.CSSProperties}>
        {projectMonths.map((m) => {
          const daysInM = new Date(YEAR, m + 1, 0).getDate()
          const days = Array.from({ length: daysInM }, (_, i) => i + 1)

          const roleCount = (role: Role, d: number): number => {
            const date = new Date(YEAR, m, d)
            return role.people.filter((p) => effectivelyWorks(date, p)).length
          }

          const dayGrandTotal = (d: number): number =>
            visibleRoles.reduce((sum, { role }) => sum + roleCount(role, d), 0)

          const roleMonthTotal = (role: Role): number =>
            days.reduce((sum, d) => sum + roleCount(role, d), 0)

          const grandTotal = days.reduce((sum, d) => sum + dayGrandTotal(d), 0)

          return (
            <div key={m}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
                <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent)', whiteSpace: 'nowrap' }}>
                  {m + 1}월
                </span>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                <span style={{ fontSize: 16, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                  합계 {grandTotal}명·일
                </span>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ borderCollapse: 'collapse', tableLayout: 'fixed', width: '100%', minWidth: 680 }}>
                  <thead>
                    <tr>
                      <th style={{
                        width: 76, padding: '3px 6px 7px 0', textAlign: 'left',
                        color: 'var(--muted)', fontSize: 15, fontWeight: 600,
                        borderBottom: '2px solid var(--border)', whiteSpace: 'nowrap',
                      }}>
                        직무
                      </th>
                      {days.map((d) => {
                        const dow = new Date(YEAR, m, d).getDay()
                        const isSat = dow === 6, isSun = dow === 0
                        const iso = `${YEAR}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
                        const kdEntry = keyDates.get(iso)
                        const kdc = kdEntry ? KEY_DATE_COLORS[kdEntry.type] : null
                        return (
                          <th key={d} style={{
                            padding: '2px 1px 7px', textAlign: 'center',
                            fontSize: 14, fontWeight: 700,
                            color: kdc ? kdc.headerFg : isSat ? '#3b82f6' : isSun ? '#ef4444' : 'var(--muted)',
                            borderBottom: '2px solid var(--border)',
                            background: kdc ? kdc.headerBg : isSat ? 'rgba(59,130,246,0.06)' : isSun ? 'rgba(239,68,68,0.06)' : undefined,
                          }}>
                            <div>{d}</div>
                            <div style={{ fontSize: 13, fontWeight: 400, marginTop: 1 }}>{DOW[dow]}</div>
                            {kdEntry && (
                              <div style={{ fontSize: 10, fontWeight: 800, marginTop: 2, color: kdc!.headerFg, lineHeight: 1.1, whiteSpace: 'nowrap' }}>
                                {kdEntry.label}
                              </div>
                            )}
                          </th>
                        )
                      })}
                      <th style={{
                        width: 52, padding: '3px 0 7px 6px', textAlign: 'right',
                        color: 'var(--accent)', fontSize: 15, fontWeight: 700,
                        borderBottom: '2px solid var(--border)', whiteSpace: 'nowrap',
                      }}>
                        계
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRoles.map(({ role, ri }) => {
                      const monthTotal = roleMonthTotal(role)
                      return (
                        <tr key={ri} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{
                            padding: '4px 8px 4px 0', fontWeight: 700, color: 'var(--fg)',
                            fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden',
                            textOverflow: 'ellipsis', maxWidth: 76,
                          }}>
                            {role.name}
                          </td>
                          {days.map((d) => {
                            const count = roleCount(role, d)
                            const maxPeople = role.people.length
                            const dow = new Date(YEAR, m, d).getDay()
                            const isSat = dow === 6, isSun = dow === 0
                            const iso = `${YEAR}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
                            const kdEntry = keyDates.get(iso)
                            const kdc = kdEntry ? KEY_DATE_COLORS[kdEntry.type] : null

                            const intensity = maxPeople > 0 ? count / maxPeople : 0
                            const bg = count === 0 ? undefined
                              : kdc ? (() => { const [r2,g2,b2] = kdc.workedBg.match(/\d+/g)!.map(Number); return `rgba(${r2},${g2},${b2},${(0.12 + intensity * 0.28).toFixed(2)})` })()
                              : isSat ? `rgba(59,130,246,${(0.07 + intensity * 0.18).toFixed(2)})`
                              : isSun ? `rgba(239,68,68,${(0.07 + intensity * 0.18).toFixed(2)})`
                              : `rgba(107,114,128,${(0.07 + intensity * 0.15).toFixed(2)})`
                            const color = count === 0 ? 'transparent'
                              : kdc ? kdc.dot
                              : isSat ? '#3b82f6'
                              : isSun ? '#ef4444'
                              : 'var(--fg)'

                            return (
                              <td
                                key={d}
                                onClick={(e) => {
                                  const cellRect = e.currentTarget.getBoundingClientRect()
                                  const wrapRect = wrapperRef.current!.getBoundingClientRect()
                                  setPopover({
                                    roleIndex: ri, m, d,
                                    top: cellRect.bottom - wrapRect.top + 6,
                                    left: Math.min(cellRect.left - wrapRect.left, wrapRect.width - 200),
                                  })
                                }}
                                style={{
                                  height: 26, textAlign: 'center', padding: '2px 1px',
                                  background: bg, color,
                                  fontSize: 14, fontWeight: 700, userSelect: 'none',
                                  borderRadius: 2, cursor: 'pointer',
                                }}
                              >
                                {count > 0 ? count : ''}
                              </td>
                            )
                          })}
                          <td style={{ padding: '4px 0 4px 10px', textAlign: 'right', fontWeight: 700, color: 'var(--accent)', fontSize: 16, whiteSpace: 'nowrap' }}>
                            {monthTotal}
                          </td>
                        </tr>
                      )
                    })}

                    <tr style={{ borderTop: '2px solid var(--border)' }}>
                      <td style={{ padding: '5px 8px 3px 0', fontWeight: 700, color: 'var(--ink)', fontSize: 15 }}>합계</td>
                      {days.map((d) => {
                        const t = dayGrandTotal(d)
                        const dow = new Date(YEAR, m, d).getDay()
                        const isSat = dow === 6, isSun = dow === 0
                        const iso = `${YEAR}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
                        const kdc = (() => { const e = keyDates.get(iso); return e ? KEY_DATE_COLORS[e.type] : null })()
                        return (
                          <td key={d} style={{
                            textAlign: 'center', fontSize: 16, fontWeight: 800,
                            color: t > 0
                              ? kdc ? kdc.totalFg : isSat ? '#3b82f6' : isSun ? '#ef4444' : 'var(--ink)'
                              : 'var(--border)',
                            padding: '5px 1px 3px',
                          }}>
                            {t > 0 ? t : ''}
                          </td>
                        )
                      })}
                      <td style={{ padding: '5px 0 3px 10px', textAlign: 'right', fontWeight: 800, color: 'var(--ink)', fontSize: 17, whiteSpace: 'nowrap' }}>
                        {grandTotal}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )
        })}
      </div>

      {popover && (
        <>
          <div style={{ position: 'absolute', inset: 0, zIndex: 40 }} onClick={() => setPopover(null)} />
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'absolute', top: popover.top, left: Math.max(0, popover.left), zIndex: 41,
              background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
              boxShadow: 'var(--shadow)', padding: 10, minWidth: 190,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)', marginBottom: 6, whiteSpace: 'nowrap' }}>
              {popoverRole!.name} · {popover.m + 1}월 {popover.d}일
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {popoverRole!.people.map((p, pi) => {
                const date = new Date(YEAR, popover.m, popover.d)
                const inRange = date >= D(p.s) && date <= D(p.e)
                const works = isWorkP(date, p)
                return (
                  <button
                    key={pi}
                    disabled={!inRange}
                    onClick={() => togglePersonDay(popover.roleIndex, pi, popover.m, popover.d, p)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14,
                      padding: '5px 8px', borderRadius: 6, border: 'none', textAlign: 'left',
                      background: works ? 'rgba(34,197,94,0.16)' : 'var(--surface-2)',
                      color: inRange ? 'var(--fg)' : 'var(--border)',
                      cursor: inRange ? 'pointer' : 'not-allowed',
                      fontSize: 14, fontWeight: 600, fontFamily: 'inherit',
                    }}
                  >
                    <span>#{pi + 1}</span>
                    <span>{!inRange ? '기간 외' : works ? '근무' : '휴무'}</span>
                  </button>
                )
              })}
            </div>
            <button
              onClick={() => {
                onOpenRoleCalendar(popover.roleIndex, popover.m)
                setPopover(null)
              }}
              style={{
                marginTop: 8, width: '100%', padding: '6px 8px', borderRadius: 6,
                border: '1px solid var(--border)', background: 'var(--surface-2)',
                color: 'var(--accent)', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                fontFamily: 'inherit', whiteSpace: 'nowrap',
              }}
            >
              이 직무 달력 전체 열기
            </button>
          </div>
        </>
      )}
    </div>
  )
}
