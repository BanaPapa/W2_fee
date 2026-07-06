import { useState, useMemo, useEffect, useRef } from 'react'
import Modal from '../ui/Modal'
import DetailHeader from './DetailHeader'
import { PlusIcon, MinusIcon } from '../icons'
import { won } from '../../lib/format'
import { D, isWorkP, patOf, DOW, projectMonths as computeProjectMonths, toggleWorkDay, clearMonth, fillMonth, monthCellKey, monthKeyOf, type Person, type MonthCell } from '../../lib/schedule'
import {
  useLaborStore,
  laborTotal,
  roleTotal,
  roleMonthHeadcount,
  USAGE_PERIOD_LABELS,
  GRID_COLS,
  type Role,
  type Section,
  type UsagePeriod,
  type CostMode,
} from '../../store/laborStore'
import { useProjectStore, toDate, toIso, MS_DAY } from '../../store/projectStore'

const USAGE_PERIOD_OPTIONS: (UsagePeriod | null)[] = [null, 'all', 'presales', 'open', 'postsales']
const usagePeriodLabel = (u: UsagePeriod | null): string => (u ? USAGE_PERIOD_LABELS[u] : '개별')

const PATTERNS: { v: number; label: string }[] = [
  { v: 7, label: '주 7일' },
  { v: 6, label: '주 6일 (수 휴무)' },
  { v: 5, label: '주 5일' },
]

const SECTION_KEYS: Section[] = ['planning', 'sales', 'other']

/** 직무 카드 덱 치수 — 세로가 긴 카드를 한 행에 최대 GRID_COLS(스토어 공유값)장, 3행 이상은 자동으로 행이 늘어남 */
const CARD_W = 220
const MIN_ROWS = 3

/** 배지 클릭 시 기획 → 영업 → 기타 순으로 구분을 순환 변경 */
const nextSection = (s: Section): Section =>
  SECTION_KEYS[(SECTION_KEYS.indexOf(s) + 1) % SECTION_KEYS.length]

const SECTION_BADGE: Record<Section, { bg: string; fg: string }> = {
  planning: { bg: 'rgba(59,130,246,0.12)', fg: '#2563eb' },
  sales: { bg: 'rgba(34,197,94,0.14)', fg: '#15803d' },
  other: { bg: 'rgba(107,114,128,0.16)', fg: '#6b7280' },
}

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
  const {
    addRole, changeRoleSection, removeRole, reorderRole, renameRole, setDaily, addPerson, removePerson,
    updatePerson, setRoleUsagePeriod, setRoleCostMode, setMonthHeadcount, moveRoleToSlot, swapRoleSlots,
    insertRoleBefore,
  } = useLaborStore()
  const extras = useProjectStore((s) => s.extras)
  const periodStart = useProjectStore((s) => s.periodStart)
  const periodEnd = useProjectStore((s) => s.periodEnd)

  const projectMonths = computeProjectMonths(periodStart, periodEnd)

  const [detailRole, setDetailRole] = useState<number | null>(null)
  const [rateOpen, setRateOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [addTargetSlot, setAddTargetSlot] = useState<number | null>(null)

  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)
  const cardDragOccurred = { current: false }

  const [rateDragIdx, setRateDragIdx] = useState<number | null>(null)
  const [rateDragOver, setRateDragOver] = useState<number | null>(null)
  const rateDragAllowed = { current: false }

  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)
  const [integratedOpen, setIntegratedOpen] = useState(false)
  const [detailMonth, setDetailMonth] = useState<MonthCell | null>(null)

  const total = laborTotal(roles, extras)

  return (
    <div className="flex flex-col min-h-full pb-8" data-c="labor">
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
              인건비 설정
            </button>
          </>
        }
      />

      <div className="px-6 py-8 flex-1 flex items-center justify-center">
        {/*
          카드 덱: 5열 고정 보드. 각 칸은 고정 슬롯이라 이미 카드가 채워진 칸으로는
          드롭할 수 없고, 빈 칸(점선 셀)에만 옮겨놓을 수 있다. 화면 가운데(가로·세로)에 정렬.
        */}
        {(() => {
          // slot(고정 위치) → 배열 인덱스 매핑. slot 미설정 직무는 배열 인덱스를 그대로 slot으로 취급(구버전 호환).
          const slotToIdx = new Map<number, number>()
          roles.forEach((r, i) => slotToIdx.set(r.slot ?? i, i))
          const usedSlots = [...slotToIdx.keys()]
          const maxSlot = usedSlots.length ? Math.max(...usedSlots) : -1
          const maxRowWithData = maxSlot >= 0 ? Math.floor(maxSlot / GRID_COLS) : -1
          const totalRows = Math.max(MIN_ROWS, maxRowWithData + 1)
          const totalCells = totalRows * GRID_COLS
          // 행별로 채워진 카드 수 — 이걸로 "이 행에 여유가 있는지", "이 행의 마지막 칸이
          // 직무 추가 버튼인지"를 판단한다.
          const rowCounts = new Map<number, number>()
          roles.forEach((r, i) => {
            const row = Math.floor((r.slot ?? i) / GRID_COLS)
            rowCounts.set(row, (rowCounts.get(row) ?? 0) + 1)
          })
          // 드래그 중인 카드와 같은 행일 때만 다른 카드 위에 드롭해 순서를 맞바꿀 수 있다.
          const dragRow = dragIdx !== null ? Math.floor((roles[dragIdx]?.slot ?? dragIdx) / GRID_COLS) : null

          return (
            <div
              className="grid gap-5"
              style={{ gridTemplateColumns: `repeat(${GRID_COLS}, ${CARD_W}px)`, gridAutoRows: `${CARD_W * 4 / 3}px` }}
            >
              {Array.from({ length: totalCells }, (_, slot) => {
                const roleIdx = slotToIdx.get(slot)
                if (roleIdx !== undefined) {
                  const r = roles[roleIdx]
                  const sec = r.section ?? 'planning'
                  const badge = SECTION_BADGE[sec]
                  const cellRow = Math.floor(slot / GRID_COLS)
                  const sameRowDrag = dragIdx !== null && dragIdx !== roleIdx && dragRow === cellRow
                  // 다른 행에서 끌어온 카드를 이 카드 위에 놓으면, 이 행에 자리가 있는 한
                  // 이 카드 자리에 끼워 넣고 이 카드(와 뒤 카드들)는 오른쪽으로 밀린다.
                  const crossRowInsert =
                    dragIdx !== null && dragRow !== null && dragRow !== cellRow && (rowCounts.get(cellRow) ?? 0) < GRID_COLS
                  const canDropOnCard = sameRowDrag || crossRowInsert
                  const isSwapTarget = canDropOnCard && dragOver === slot
                  return (
                    <div
                      key={roleIdx}
                      draggable
                      onDragStart={(e) => {
                        if ((e.target as HTMLElement).closest('input,button')) { e.preventDefault(); return }
                        cardDragOccurred.current = true
                        setDragIdx(roleIdx)
                        e.dataTransfer.effectAllowed = 'move'
                      }}
                      onDragEnd={() => {
                        setTimeout(() => { cardDragOccurred.current = false }, 80)
                        setDragIdx(null); setDragOver(null)
                      }}
                      onDragOver={(e) => {
                        if (!canDropOnCard) return
                        e.preventDefault()
                        e.dataTransfer.dropEffect = 'move'
                        setDragOver(slot)
                      }}
                      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(null) }}
                      onDrop={(e) => {
                        if (!canDropOnCard) return
                        e.preventDefault()
                        if (dragIdx !== null) {
                          if (sameRowDrag) swapRoleSlots(dragIdx, roleIdx)
                          else insertRoleBefore(dragIdx, roleIdx)
                        }
                        setDragIdx(null); setDragOver(null)
                      }}
                      onClick={(e) => {
                        if ((e.target as HTMLElement).closest('input,button')) return
                        if (cardDragOccurred.current) return
                        setDetailMonth(null)
                        setDetailRole(roleIdx)
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault()
                        setDeleteConfirm(roleIdx)
                      }}
                      className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow)] flex flex-col justify-between gap-3 transition-opacity select-none"
                      style={{
                        cursor: dragIdx === roleIdx ? 'grabbing' : 'pointer',
                        outline: isSwapTarget ? '2px solid var(--accent)' : undefined,
                        outlineOffset: isSwapTarget ? 2 : undefined,
                        opacity: dragIdx === roleIdx ? 0.35 : 1,
                      }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <button
                          title="클릭하여 구분 변경 (기획 → 영업 → 기타)"
                          onClick={(e) => { e.stopPropagation(); changeRoleSection(roleIdx, nextSection(sec)) }}
                          onMouseDown={(e) => e.stopPropagation()}
                          style={{
                            fontSize: 13.5, fontWeight: 700, padding: '3px 12px', borderRadius: 999,
                            background: badge.bg, color: badge.fg, letterSpacing: '0.04em',
                            border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                          }}
                        >
                          {sectionNames[sec]}
                        </button>
                        <div className="flex items-center gap-1 flex-none">
                          <button
                            className="back-btn !w-6 !h-6"
                            aria-label="인원 감소"
                            disabled={r.people.length === 0}
                            onClick={(e) => { e.stopPropagation(); removePerson(roleIdx) }}
                            onMouseDown={(e) => e.stopPropagation()}
                          >
                            <MinusIcon />
                          </button>
                          <span className="text-[15px] font-bold text-[var(--fg)] tabular" style={{ minWidth: 26, textAlign: 'center' }}>
                            {r.people.length}명
                          </span>
                          <button
                            className="back-btn !w-6 !h-6"
                            aria-label="인원 추가"
                            onClick={(e) => { e.stopPropagation(); addPerson(roleIdx) }}
                            onMouseDown={(e) => e.stopPropagation()}
                          >
                            <PlusIcon />
                          </button>
                        </div>
                      </div>
                      <input
                        className="w-full bg-transparent font-semibold text-[21px] text-[var(--ink)] outline-none border-b border-transparent focus:border-[var(--border)] cursor-text"
                        value={r.name}
                        spellCheck={false}
                        onChange={(e) => renameRole(roleIdx, e.target.value)}
                        onMouseDown={(e) => e.stopPropagation()}
                      />
                      <div className="font-display text-[25px] font-semibold text-[var(--ink)] tabular">
                        {won(roleTotal(r, extras))}
                      </div>
                    </div>
                  )
                }

                // 빈 슬롯 — 카드가 채워진 칸으로는 드롭할 수 없고, 이 빈 칸으로만 옮길 수 있다.
                // 옮기면 그 슬롯 값만 바뀌고 다른 직무는 그대로라, 원래 있던 칸은 그냥 빈 칸으로 남는다.
                const cellRow = Math.floor(slot / GRID_COLS)
                const cellCol = slot % GRID_COLS
                const rowFilled = rowCounts.get(cellRow) ?? 0
                // 왼쪽 정렬 압축 규칙상, 행이 꽉 차지 않았다면 그 행의 마지막 칸은 항상 비어
                // 있다 — 그 자리를 "직무 추가" 버튼으로 고정해서 몇 장이 있든 위치가 안정적이다.
                const isAddCell = cellCol === GRID_COLS - 1 && rowFilled < GRID_COLS
                const isDropTarget = dragOver === slot

                const dragHandlers = {
                  onDragOver: (e: React.DragEvent) => {
                    if (dragIdx === null) return
                    e.preventDefault()
                    e.dataTransfer.dropEffect = 'move'
                    setDragOver(slot)
                  },
                  onDragLeave: (e: React.DragEvent) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(null) },
                  onDrop: (e: React.DragEvent) => {
                    e.preventDefault()
                    if (dragIdx !== null) moveRoleToSlot(dragIdx, slot)
                    setDragIdx(null); setDragOver(null)
                  },
                }

                if (isAddCell) {
                  return (
                    <button
                      key={`add-${slot}`}
                      {...dragHandlers}
                      className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-2)] p-5 flex flex-col items-center justify-center gap-2 text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
                      style={{
                        borderColor: isDropTarget ? 'var(--accent)' : undefined,
                        background: isDropTarget ? 'color-mix(in oklch, var(--accent) 6%, transparent)' : undefined,
                      }}
                      onClick={() => { setAddTargetSlot(slot); setAddOpen(true) }}
                    >
                      <PlusIcon style={{ width: 24, height: 24 }} />
                      <span className="text-[18px] font-semibold">직무 추가</span>
                    </button>
                  )
                }

                return (
                  <div
                    key={`empty-${slot}`}
                    {...dragHandlers}
                    className="rounded-2xl border border-dashed transition-colors"
                    style={{
                      borderColor: isDropTarget ? 'var(--accent)' : 'var(--border)',
                      background: isDropTarget ? 'color-mix(in oklch, var(--accent) 6%, transparent)' : 'transparent',
                    }}
                  />
                )
              })}
            </div>
          )
        })()}
      </div>

      {/* ---- 직무 추가 모달 (구분 선택) ---- */}
      <Modal
        open={addOpen}
        onClose={() => { setAddOpen(false); setAddTargetSlot(null) }}
        title="직무 추가"
        sub="새 직무의 구분을 선택하세요"
        width={400}
      >
        <div className="flex flex-col gap-2 pt-2">
          {SECTION_KEYS.map((sec) => {
            const badge = SECTION_BADGE[sec]
            return (
              <button
                key={sec}
                onClick={() => { addRole(sec, addTargetSlot ?? undefined); setAddOpen(false); setAddTargetSlot(null) }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '12px 14px', borderRadius: 12,
                  border: '1px solid var(--border)', background: 'var(--surface-2)',
                  cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                }}
              >
                <span style={{
                  fontSize: 13, fontWeight: 700, padding: '3px 10px', borderRadius: 999,
                  background: badge.bg, color: badge.fg,
                }}>
                  {sectionNames[sec]}
                </span>
                <span style={{ fontSize: 15, color: 'var(--muted)' }}>
                  {sec === 'planning' ? '총괄 · 기획 · 상담 등' : sec === 'sales' ? '분양 영업 인력' : '단기 · 지원 인력 등'}
                </span>
              </button>
            )
          })}
        </div>
      </Modal>

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
        className="role-calendar-modal"
        open={detailRole !== null}
        onClose={() => { setDetailRole(null); setDetailMonth(null) }}
        title={detailRole !== null ? roles[detailRole]?.name ?? '' : ''}
        widthCss="60vw"
        heightCss="95vh"
        headerControls={detailRole !== null ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginLeft: 16, width: '100%' }}>
            <span style={{ fontSize: 21, fontWeight: 800, color: 'var(--ink)' }}>{roles[detailRole]?.people.length ?? 0}명</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button className="back-btn !w-7 !h-7" disabled={(roles[detailRole]?.people.length ?? 0) === 0} onClick={() => removePerson(detailRole!)} aria-label="인원 감소">
                <MinusIcon />
              </button>
              <button className="back-btn !w-7 !h-7" onClick={() => addPerson(detailRole!)} aria-label="인원 추가">
                <PlusIcon />
              </button>
            </div>
            {roles[detailRole] && (
              <span style={{ marginLeft: 'auto', marginRight: 28, fontSize: 24, fontWeight: 800, color: 'var(--accent)' }}>
                {won(roleTotal(roles[detailRole], extras))}
              </span>
            )}
          </div>
        ) : undefined}
      >
        {detailRole !== null && roles[detailRole] && (
          <CalendarModal
            role={roles[detailRole]}
            projectMonths={projectMonths}
            onUpdatePerson={(pi, patch) => updatePerson(detailRole, pi, patch)}
            onSetMonthHeadcount={(y, m, c) => setMonthHeadcount(detailRole, y, m, c)}
            scrollToMonth={detailMonth ?? undefined}
          />
        )}
      </Modal>

      {/* ---- 단가표 모달 ---- */}
      <Modal
        open={rateOpen}
        onClose={() => setRateOpen(false)}
        title="인건비 설정"
        sub={`직무 ${roles.length}개 · 단가 · 인원 · 구분 · 사용기간 · 산정방식 설정`}
        widthCss="70vw"
      >
        <table className="data-table mt-2.5">
          <thead>
            <tr>
              <th style={{ width: 28 }}></th>
              <th>직무</th>
              <th style={{ textAlign: 'center' }}>구분</th>
              <th style={{ textAlign: 'right' }}>일 단가</th>
              <th style={{ textAlign: 'center' }}>인원</th>
              <th style={{ textAlign: 'center' }}>사용기간</th>
              <th style={{ textAlign: 'center' }}>산정방식</th>
              <th style={{ textAlign: 'right', minWidth: 120 }}>소계</th>
            </tr>
          </thead>
          <tbody>
            {SECTION_KEYS.map((sec, si) => {
              const secRolesInModal = roles.flatMap((r, i) =>
                (r.section ?? 'planning') === sec ? [{ r, i }] : []
              )
              if (secRolesInModal.length === 0) return null
              return (
                <>
                  <tr key={`sec-header-${sec}`}>
                    <td colSpan={8} style={{ padding: si === 0 ? '4px 0 6px' : '14px 0 6px', fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)', borderTop: si > 0 ? '2px solid var(--border)' : undefined }}>
                      {sectionNames[sec]}
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
                      <td style={{ textAlign: 'center' }}>
                        <select
                          className="field-input"
                          style={{ width: 80, cursor: 'pointer' }}
                          value={r.section ?? 'planning'}
                          onChange={(e) => changeRoleSection(i, e.target.value as Section)}
                          title="직무의 구분(기획/영업/기타)을 변경합니다"
                        >
                          {SECTION_KEYS.map((s) => (
                            <option key={s} value={s}>{sectionNames[s]}</option>
                          ))}
                        </select>
                      </td>
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
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                          <button
                            className="back-btn !w-7 !h-7"
                            aria-label="인원 감소"
                            disabled={r.people.length === 0}
                            onClick={() => removePerson(i)}
                          >
                            <MinusIcon />
                          </button>
                          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--fg)', minWidth: 34, textAlign: 'center' }}>
                            {r.people.length}명
                          </span>
                          <button className="back-btn !w-7 !h-7" aria-label="인원 추가" onClick={() => addPerson(i)}>
                            <PlusIcon />
                          </button>
                        </div>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <select
                          className="field-input"
                          style={{ width: 90, cursor: 'pointer' }}
                          value={r.usagePeriod ?? ''}
                          onChange={(e) => setRoleUsagePeriod(i, (e.target.value || null) as UsagePeriod | null)}
                          title="기간을 선택하면 이 직무의 모든 인원 근무기간이 해당 기간으로 일괄 설정됩니다"
                        >
                          {USAGE_PERIOD_OPTIONS.map((opt) => (
                            <option key={opt ?? 'none'} value={opt ?? ''}>{usagePeriodLabel(opt)}</option>
                          ))}
                        </select>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <select
                          className="field-input"
                          style={{ width: 80, cursor: 'pointer' }}
                          value={r.costMode ?? 'individual'}
                          onChange={(e) => setRoleCostMode(i, e.target.value as CostMode)}
                          title="집합: 인원 전체가 같은 일정을 공유하고, 달력에서 달마다 투입 인원을 조정할 수 있습니다"
                        >
                          <option value="individual">개별</option>
                          <option value="aggregate">집합</option>
                        </select>
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

/** s~e 전체 구간(해가 넘어가도)에 동일한 패턴 값을 채운 pat 맵을 만든다 */
const buildPattern = (s: Person['s'], e: Person['e'], v: number): Record<string, number> => {
  const pat: Record<string, number> = {}
  let y = s[0]
  let m = s[1]
  const endKey = e[0] * 12 + e[1]
  while (y * 12 + m <= endKey) {
    pat[monthKeyOf(y, m)] = v
    m++
    if (m > 11) { m = 0; y++ }
  }
  return pat
}

function CalendarModal({
  role,
  projectMonths,
  onUpdatePerson,
  onSetMonthHeadcount,
  scrollToMonth,
}: {
  role: Role
  projectMonths: MonthCell[]
  onUpdatePerson: (pi: number, patch: Partial<Person>) => void
  onSetMonthHeadcount: (year: number, month: number, count: number) => void
  scrollToMonth?: MonthCell
}) {
  const monthRefs = useRef<Record<number, HTMLDivElement | null>>({})
  useEffect(() => {
    if (scrollToMonth == null) return
    monthRefs.current[monthCellKey(scrollToMonth)]?.scrollIntoView({ block: 'start' })
  }, [scrollToMonth])

  const [monthOpenOverride, setMonthOpenOverride] = useState<Record<number, boolean>>({})
  const toggleMonth = (mKey: number, autoOpen: boolean) =>
    setMonthOpenOverride((o) => ({ ...o, [mKey]: !(o[mKey] ?? autoOpen) }))

  const toggleDay = (pi: number, year: number, month: number, day: number) => {
    onUpdatePerson(pi, toggleWorkDay(role.people[pi], year, month, day))
  }

  const setPattern = (pi: number, v: number) => {
    const p = role.people[pi]
    onUpdatePerson(pi, { pat: buildPattern(p.s, p.e, v), ov: {} })
  }

  const setPatternAll = (v: number) => {
    role.people.forEach((p, pi) => {
      onUpdatePerson(pi, { pat: buildPattern(p.s, p.e, v), ov: {} })
    })
  }

  const clearRoleMonth = (year: number, m: number) => {
    role.people.forEach((p, pi) => {
      onUpdatePerson(pi, clearMonth(p, year, m))
    })
  }

  const fillRoleMonth = (year: number, m: number) => {
    role.people.forEach((p, pi) => {
      onUpdatePerson(pi, fillMonth(p, year, m))
    })
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
    const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    const inPersonRange = date >= D(p.s) && date <= D(p.e)
    if (keyDates.has(iso) && inPersonRange) return true
    return isWorkP(date, p)
  }

  const isAggregate = role.costMode === 'aggregate'
  const displayPeople = isAggregate ? role.people.slice(0, 1) : role.people

  // 인력 사용기간이 '전체'가 아니면(사전/오픈/사후/미설정), 인원수와 상관없이 근무 패턴은 하나로 통일
  const unifyPattern = isAggregate || role.usagePeriod !== 'all'
  const patternPeople = unifyPattern ? role.people.slice(0, 1) : role.people

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, marginTop: 10 }}>
      {/* 인원별 근무 패턴 */}
      {role.people.length > 0 && (
        <div style={{ flexShrink: 0, paddingBottom: 10, marginBottom: 4, borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {patternPeople.map((p, pi) => (
              <div key={pi} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: 'var(--surface-2)', borderRadius: 8, padding: '4px 8px',
              }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--fg)', minWidth: 26 }}>
                  {unifyPattern ? `전체 ${role.people.length}명` : `#${pi + 1}`}
                </span>
                <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                  <select
                    style={{
                      fontSize: 16, padding: '3px 26px 3px 8px', height: 30,
                      background: 'var(--surface-2)', border: '1px solid var(--border)',
                      borderRadius: 6, color: 'var(--fg)', appearance: 'none',
                      WebkitAppearance: 'none', cursor: 'pointer', fontFamily: 'inherit',
                    }}
                    value={patOf(p, p.s[0], p.s[1])}
                    onChange={(e) => unifyPattern ? setPatternAll(Number(e.target.value)) : setPattern(pi, Number(e.target.value))}
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
        {projectMonths.map(({ year, month: m }) => {
          const mKey = monthCellKey({ year, month: m })
          const daysInM = new Date(year, m + 1, 0).getDate()
          const days = Array.from({ length: daysInM }, (_, i) => i + 1)
          const monthHc = roleMonthHeadcount(role, year, m)
          const dayTotal = (d: number) =>
            isAggregate
              ? role.people[0] && effectivelyWorks(new Date(year, m, d), role.people[0]) ? monthHc : 0
              : role.people.filter((p) => effectivelyWorks(new Date(year, m, d), p)).length
          const personMonthDays = (pi: number) =>
            days.filter((d) => effectivelyWorks(new Date(year, m, d), role.people[pi])).length
          const grandTotal = days.reduce((n, d) => n + dayTotal(d), 0)
          const autoOpen = !(grandTotal === 0 && role.usagePeriod !== 'all')
          const isOpen = monthOpenOverride[mKey] ?? autoOpen

          return (
            <div key={mKey} ref={(el) => { monthRefs.current[mKey] = el }}>
              {/* 월 라벨 */}
              <div
                style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7, cursor: 'pointer', userSelect: 'none' }}
                onClick={() => toggleMonth(mKey, autoOpen)}
              >
                <span style={{ fontSize: 12, color: 'var(--muted)', transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s', display: 'inline-block' }}>
                  ▸
                </span>
                <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent)', whiteSpace: 'nowrap' }}>
                  {year}년 {m + 1}월
                </span>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                {isAggregate && (
                  <span
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' }}
                    title="이 달에 투입되는 인원수 — 기본 인원과 다르게 조정할 수 있습니다"
                  >
                    <span style={{ fontSize: 14, color: 'var(--muted)' }}>이 달 인원</span>
                    <button
                      className="back-btn !w-6 !h-6"
                      aria-label="이 달 인원 감소"
                      disabled={monthHc === 0}
                      onClick={(e) => { e.stopPropagation(); onSetMonthHeadcount(year, m, monthHc - 1) }}
                    >
                      <MinusIcon />
                    </button>
                    <span style={{
                      fontSize: 15, fontWeight: 800, minWidth: 36, textAlign: 'center',
                      color: monthHc !== role.people.length ? 'var(--accent)' : 'var(--fg)',
                    }}>
                      {monthHc}명
                    </span>
                    <button
                      className="back-btn !w-6 !h-6"
                      aria-label="이 달 인원 추가"
                      onClick={(e) => { e.stopPropagation(); onSetMonthHeadcount(year, m, monthHc + 1) }}
                    >
                      <PlusIcon />
                    </button>
                  </span>
                )}
                <span style={{ fontSize: 16, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                  합계 {grandTotal}명·일
                </span>
                <button
                  className="pill"
                  title="이 달을 선택된 주간 패턴(5·6·7일)에 맞춰 채웁니다"
                  onClick={(e) => { e.stopPropagation(); fillRoleMonth(year, m) }}
                  style={{ fontSize: 13, padding: '2px 10px' }}
                >
                  이 달 채우기
                </button>
                <button
                  className="pill"
                  disabled={grandTotal === 0}
                  title="이 달에 배정된 근무일을 전부 비웁니다"
                  onClick={(e) => { e.stopPropagation(); clearRoleMonth(year, m) }}
                  style={{ fontSize: 13, padding: '2px 10px', opacity: grandTotal === 0 ? 0.4 : 1, cursor: grandTotal === 0 ? 'default' : 'pointer' }}
                >
                  이 달 비우기
                </button>
              </div>

              {/* 전체 너비 테이블 (최소 680px 이하면 가로 스크롤) */}
              {isOpen && (
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
                        const dow = new Date(year, m, d).getDay()
                        const isSat = dow === 6, isSun = dow === 0
                        const iso = `${year}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
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
                    {displayPeople.map((p, pi) => (
                      <tr key={pi} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '4px 10px 4px 0', fontWeight: 700, color: 'var(--fg)', fontSize: 16, whiteSpace: 'nowrap' }}>
                          {isAggregate ? `전체 ${monthHc}명` : `#${pi + 1}`}
                        </td>
                        {days.map((d) => {
                          const date = new Date(year, m, d)
                          const inRange = date >= D(p.s) && date <= D(p.e)
                          const iso = `${year}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
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
                              onClick={() => toggleDay(pi, year, m, d)}
                              title={!inRange ? '클릭: 근무일로 추가' : works ? '클릭: 휴무 처리' : '클릭: 근무 처리'}
                              style={{
                                height: 28, textAlign: 'center', padding: '2px 1px',
                                cursor: 'pointer',
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
              )}
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
  projectMonths: MonthCell[]
  onOpenRoleCalendar: (roleIndex: number, month: MonthCell) => void
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
    const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    const inPersonRange = date >= D(p.s) && date <= D(p.e)
    if (keyDates.has(iso) && inPersonRange) return true
    return isWorkP(date, p)
  }

  const roleWorksInPeriod = (role: Role): boolean =>
    projectMonths.some(({ year, month: m }) => {
      const daysInM = new Date(year, m + 1, 0).getDate()
      for (let d = 1; d <= daysInM; d++) {
        const date = new Date(year, m, d)
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
    year: number
    m: number
    d: number
    top: number
    left: number
  } | null>(null)
  const popoverRole = popover ? roles[popover.roleIndex] : null

  const togglePersonDay = (roleIndex: number, personIndex: number, year: number, m: number, d: number, p: Person) => {
    updatePerson(roleIndex, personIndex, toggleWorkDay(p, year, m, d))
  }

  return (
    <div ref={wrapperRef} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, marginTop: 10, position: 'relative' }}>
      <div
        onScroll={() => setPopover(null)}
        style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 22, paddingTop: 14, paddingBottom: 12, paddingLeft: 25, paddingRight: 25, scrollbarGutter: 'stable' } as React.CSSProperties}>
        {projectMonths.map(({ year, month: m }) => {
          const mKey = monthCellKey({ year, month: m })
          const daysInM = new Date(year, m + 1, 0).getDate()
          const days = Array.from({ length: daysInM }, (_, i) => i + 1)

          const roleCount = (role: Role, d: number): number => {
            const date = new Date(year, m, d)
            if (role.costMode === 'aggregate') {
              const template = role.people[0]
              return template && effectivelyWorks(date, template) ? roleMonthHeadcount(role, year, m) : 0
            }
            return role.people.filter((p) => effectivelyWorks(date, p)).length
          }

          const dayGrandTotal = (d: number): number =>
            visibleRoles.reduce((sum, { role }) => sum + roleCount(role, d), 0)

          const roleMonthTotal = (role: Role): number =>
            days.reduce((sum, d) => sum + roleCount(role, d), 0)

          const grandTotal = days.reduce((sum, d) => sum + dayGrandTotal(d), 0)

          return (
            <div key={mKey}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
                <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent)', whiteSpace: 'nowrap' }}>
                  {year}년 {m + 1}월
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
                        const dow = new Date(year, m, d).getDay()
                        const isSat = dow === 6, isSun = dow === 0
                        const iso = `${year}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
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
                            const dow = new Date(year, m, d).getDay()
                            const isSat = dow === 6, isSun = dow === 0
                            const iso = `${year}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
                            const kdEntry = keyDates.get(iso)
                            const kdc = kdEntry ? KEY_DATE_COLORS[kdEntry.type] : null

                            const intensity = maxPeople > 0 ? Math.min(1, count / maxPeople) : 0
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
                                    roleIndex: ri, year, m, d,
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
                        const dow = new Date(year, m, d).getDay()
                        const isSat = dow === 6, isSun = dow === 0
                        const iso = `${year}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
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
              {popoverRole!.name} · {popover.year}년 {popover.m + 1}월 {popover.d}일
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {(popoverRole!.costMode === 'aggregate' ? popoverRole!.people.slice(0, 1) : popoverRole!.people).map((p, pi) => {
                const date = new Date(popover.year, popover.m, popover.d)
                const inRange = date >= D(p.s) && date <= D(p.e)
                const works = isWorkP(date, p)
                return (
                  <button
                    key={pi}
                    onClick={() => togglePersonDay(popover.roleIndex, pi, popover.year, popover.m, popover.d, p)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14,
                      padding: '5px 8px', borderRadius: 6, border: 'none', textAlign: 'left',
                      background: works ? 'rgba(34,197,94,0.16)' : 'var(--surface-2)',
                      color: 'var(--fg)',
                      cursor: 'pointer',
                      fontSize: 14, fontWeight: 600, fontFamily: 'inherit',
                    }}
                  >
                    <span>
                      {popoverRole!.costMode === 'aggregate'
                        ? `전체 ${roleMonthHeadcount(popoverRole!, popover.year, popover.m)}명`
                        : `#${pi + 1}`}
                    </span>
                    <span>{!inRange ? '기간 외 · 클릭시 추가' : works ? '근무' : '휴무'}</span>
                  </button>
                )
              })}
            </div>
            <button
              onClick={() => {
                onOpenRoleCalendar(popover.roleIndex, { year: popover.year, month: popover.m })
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
