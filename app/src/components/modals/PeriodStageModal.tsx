import React, { useEffect, useMemo, useRef, useState } from 'react'
import Modal from '../ui/Modal'
import {
  useProjectStore, toDate, toIso,
  MS_DAY, nearestFriday, calcMainKeyDates, calcAnnounceDate,
  type Stage, type EventBlock,
} from '../../store/projectStore'
import { HIDDEN_KEYS, KEY_DATE_MARKER_COLOR } from '../../lib/periodMarkers'
import { useKoreanHolidays } from '../../lib/holidays'
import CombinedPeriodCalendar from './CombinedPeriodCalendar'

const SEG_COLOR: Record<string, string> = {
  teal:   'var(--teal)',
  accent: 'var(--accent)',
  violet: 'var(--violet)',
  slate:  'var(--slate)',
  amber:  'var(--amber)',
}

const SEG_GRAD: Record<string, string> = {
  teal:   'linear-gradient(100deg,#2fcdb8,#23b8a6)',
  accent: 'linear-gradient(100deg,#6fa0f5,#5b8def)',
  violet: 'linear-gradient(100deg,#a986f2,#9b6cf0)',
  slate:  'linear-gradient(100deg,#8e96b4,#7b86a8)',
  amber:  'linear-gradient(100deg,#efb45c,#e8a33d)',
}

const TRACK_H    = 46
const OVERVIEW_H = 34
const ROW_GAP    = 40

/* ── MarkerTick — glass flag + stem + pin ────────────────────────── */
function MarkerTick({ pct, label, dateStr, color, draggable, onDragStart }: {
  pct: number; label: string; dateStr: string; color: string
  draggable?: boolean
  onDragStart?: (e: React.MouseEvent) => void
}) {
  const clamped = Math.max(0, Math.min(100, pct))
  return (
    <div
      className={`pd-mk${draggable ? ' drag' : ''}`}
      style={{ left: `${clamped}%`, color }}
    >
      <div className="flag">
        <div className="d">{dateStr.slice(5)}</div>
        <div className="l">{label}</div>
      </div>
      <div className="stem" />
      <div className="pin" onMouseDown={draggable ? onDragStart : undefined} />
    </div>
  )
}

/* ── main ────────────────────────────────────────────────────────── */
export default function PeriodStageModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const {
    periodStart, periodEnd, stages, eventBlocks,
    setPeriod, setAllStages, toggleNoOrder,
    setOpenDate, setOpenDays, setContractDays,
    setEventBlockEnabled, setEventBlockDays,
    updateSubPeriod,
  } = useProjectStore()

  const [openManual, setOpenManual] = useState(false)
  const [calendarView, setCalendarView] = useState(false)

  const startMs     = toDate(periodStart).getTime()
  const endMs       = toDate(periodEnd).getTime()
  const span        = Math.max(1, endMs - startMs)
  const totalDays   = isNaN(span) ? 0 : Math.max(0, Math.round(span / MS_DAY))
  const totalMonths = +(totalDays / 30.4).toFixed(1)

  const overviewRef  = useRef<HTMLDivElement>(null)
  const ovDragRef    = useRef<{
    stageIdx: number; nextStageIdx: number
    stages0: Stage[]
    mouseX0: number; trackW: number; periodSpanMs: number
  } | null>(null)

  const markerDragRef = useRef<{
    type: 'open' | 'sub'
    stageIdx: number; key: string
    stageStartMs: number; stageSpanMs: number
    stageEndMs: number
  } | null>(null)

  const trackRefs = useRef<Map<number, HTMLDivElement>>(new Map())

  /* ── combined drag effect ─────────────────────────────────────── */
  useEffect(() => {
    const mv = (e: MouseEvent) => {
      /* overview boundary drag */
      if (ovDragRef.current) {
        const d = ovDragRef.current
        const deltaDays = Math.round(((e.clientX - d.mouseX0) / d.trackW) * (d.periodSpanMs / MS_DAY))
        const deltaMs   = deltaDays * MS_DAY
        const ns        = d.stages0.map(s => ({ ...s }))
        const origEnd   = toDate(d.stages0[d.stageIdx].end).getTime()
        const newEnd    = origEnd + deltaMs
        const minEnd    = toDate(d.stages0[d.stageIdx].start).getTime() + MS_DAY
        const nextSt    = d.stages0[d.nextStageIdx]

        // 본영업 경계는 더 이상 본영업 자체를 압축하지 않으므로, 최대 이동 범위는
        // "본영업(+무순위) 고정 기간을 확보하고도 사후영업이 최소 하루는 남는 지점"까지다.
        let maxEnd: number
        if (nextSt.id === 'main') {
          const mainDurationMs = toDate(nextSt.end).getTime() - toDate(nextSt.start).getTime()
          const noorderSt = d.stages0.find(s => s.id === 'noorder')
          const noorderReserveMs = noorderSt?.enabled
            ? (toDate(noorderSt.end).getTime() - toDate(noorderSt.start).getTime()) + MS_DAY
            : 0
          const reservedMs = mainDurationMs + MS_DAY + noorderReserveMs + MS_DAY // + 사후영업 최소 1일
          maxEnd = toDate(periodEnd).getTime() - reservedMs
        } else {
          maxEnd = toDate(nextSt.end).getTime() - MS_DAY
        }

        const clamped   = Math.max(minEnd, Math.min(maxEnd, newEnd))
        ns[d.stageIdx] = { ...ns[d.stageIdx], end: toIso(clamped) }
        if (nextSt.id === 'main') {
          // 오픈일 = 사전영업 종료일 + 1일 (본영업 자체 일정 구조는 항상 고정)
          const newStart = toIso(clamped + MS_DAY)
          const newKDs  = calcMainKeyDates(newStart, nextSt.openDays ?? 3, nextSt.contractDays ?? 3)
          const altDate = newKDs.find(k => k.key === 'alt')?.date ?? nextSt.end
          ns[d.nextStageIdx] = { ...nextSt, start: newStart, end: altDate, keyDates: newKDs }

          // 본영업 뒤 단계들을 순서대로 이어붙인다. 무순위(활성화된 경우)는 자기 기간을 확보한 채
          // 유지하고, 마지막 활성 단계(사후영업)가 분양기간 종료일까지 늘거나 줄며 나머지를 흡수한다.
          const restIdx: number[] = []
          for (let i = d.nextStageIdx + 1; i < ns.length; i++) {
            if (ns[i].enabled) restIdx.push(i)
          }
          let cursor = toDate(altDate).getTime() + MS_DAY
          restIdx.forEach((idx, i) => {
            const st = ns[idx]
            const isLast = i === restIdx.length - 1
            if (isLast) {
              ns[idx] = { ...st, start: toIso(cursor), end: periodEnd }
            } else {
              const durMs = toDate(st.end).getTime() - toDate(st.start).getTime()
              ns[idx] = { ...st, start: toIso(cursor), end: toIso(cursor + durMs) }
              cursor = toDate(ns[idx].end).getTime() + MS_DAY
            }
          })
        } else {
          ns[d.nextStageIdx] = { ...ns[d.nextStageIdx], start: toIso(clamped + MS_DAY) }
        }
        setAllStages(ns)
      }
      /* marker drag */
      if (markerDragRef.current) {
        const d  = markerDragRef.current
        const el = trackRefs.current.get(d.stageIdx)
        if (!el) return
        const rect = el.getBoundingClientRect()
        const pct  = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
        const newMs = d.stageStartMs + pct * d.stageSpanMs

        if (d.type === 'open') {
          setOpenDate(toIso(nearestFriday(newMs)))
        } else {
          updateSubPeriod(d.stageIdx, d.key, { start: toIso(newMs) })
        }
      }
    }
    const up = () => {
      ovDragRef.current     = null
      markerDragRef.current = null
      document.body.style.cursor     = ''
      document.body.style.userSelect = ''
    }
    window.addEventListener('mousemove', mv)
    window.addEventListener('mouseup',   up)
    return () => { window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up) }
  }, [setAllStages, stages, updateSubPeriod, periodEnd])

  /* ── overview drag start ──────────────────────────────────────── */
  const startOvDrag = (e: React.MouseEvent, stageIdx: number, nextStageIdx: number) => {
    e.preventDefault()
    const track = overviewRef.current
    if (!track) return
    const rect = track.getBoundingClientRect()
    ovDragRef.current = {
      stageIdx, nextStageIdx,
      stages0: [...stages],
      mouseX0: e.clientX, trackW: rect.width, periodSpanMs: span,
    }
    document.body.style.cursor     = 'ew-resize'
    document.body.style.userSelect = 'none'
  }

  /* ── marker drag start ────────────────────────────────────────── */
  const startMarkerDrag = (
    e: React.MouseEvent,
    type: 'open' | 'sub',
    stageIdx: number,
    key: string,
    stageStartMs: number,
    stageSpanMs: number,
    stageEndMs: number,
  ) => {
    e.preventDefault()
    e.stopPropagation()
    markerDragRef.current = { type, stageIdx, key, stageStartMs, stageSpanMs, stageEndMs }
    document.body.style.cursor     = 'ew-resize'
    document.body.style.userSelect = 'none'
  }

  /* ── derived ─────────────────────────────────────────────────── */
  const noOrder        = stages.find(s => s.id === 'noorder')
  const mainIdx        = stages.findIndex(s => s.id === 'main')
  const mainStage      = stages[mainIdx]
  const presalesStage  = stages.find(s => s.id === 'presales')
  const postsalesStage = stages.find(s => s.id === 'postsales')
  const openKd         = mainStage?.keyDates?.find(k => k.key === 'open')
  const mainOpenDays   = mainStage?.openDays ?? 3
  const mainContractDays = mainStage?.contractDays ?? 3

  const holidays = useKoreanHolidays(
    presalesStage?.start ?? periodStart,
    periodEnd,
  )

  /* 기간 내 금요일 목록 */
  const fridays = useMemo(() => {
    const result: string[] = []
    const d = new Date(2026, 0, 2) // 2026-01-02 = 금요일
    while (d.getFullYear() === 2026) {
      const iso = toIso(d.getTime())
      if (iso >= periodStart && iso <= periodEnd) result.push(iso)
      d.setDate(d.getDate() + 7)
    }
    return result
  }, [periodStart, periodEnd])

  const overviewStages = stages.filter(s => s.enabled)
  // 본영업은 정해진 일정을 확보해야 하므로, 본영업↔다음 단계 경계는 드래그로 조정할 수 없다.
  const ovBoundaries   = overviewStages.slice(0, -1)
    .map((s, i) => ({
      pct:          ((toDate(s.end).getTime() - startMs) / span) * 100,
      stageIdx:     stages.indexOf(s),
      nextStageIdx: stages.indexOf(overviewStages[i + 1]),
    }))
    .filter(({ stageIdx }) => stages[stageIdx].id !== 'main')

  /* ── header controls ─────────────────────────────────────────── */
  const DOW = ['일', '월', '화', '수', '목', '금', '토']

  const headerControls = (
    <div className="pd-toolbar">
      {/* 기간 뱃지 */}
      <span className="pd-badge">총 {totalDays}일 · {totalMonths}개월</span>

      {/* 시작/종료 */}
      <label className="pd-fld pd-fld-hi">
        시작
        <input type="date" value={periodStart} max={periodEnd}
          onChange={e => { if (e.target.value) setPeriod(e.target.value, periodEnd) }} />
      </label>
      <label className="pd-fld pd-fld-hi">
        종료
        <input type="date" value={periodEnd} min={periodStart}
          onChange={e => { if (e.target.value) setPeriod(periodStart, e.target.value) }} />
      </label>

      <span className="pd-divider" style={{ margin: '0 10px' }} />

      {/* 오픈일 + 오픈기간 — 가장 중요한 컨트롤이므로 강조 */}
      <div className="pd-hero">
        {openKd && (
          <label className="pd-fld">
            오픈일
            {openManual ? (
              <>
                <input
                  type="date"
                  value={openKd.date}
                  onChange={e => { if (e.target.value) { setOpenDate(e.target.value); setOpenManual(false) } }}
                  autoFocus
                />
                <button className="pd-ghost" style={{ fontSize: 14, padding: '3px 8px' }} onClick={() => setOpenManual(false)}>금요일</button>
              </>
            ) : (
              <>
                <select
                  value={fridays.includes(openKd.date) ? openKd.date : ''}
                  onChange={e => { if (e.target.value) setOpenDate(e.target.value) }}
                >
                  {!fridays.includes(openKd.date) && (
                    <option value="">
                      {toDate(openKd.date).getMonth() + 1}/{toDate(openKd.date).getDate()}({DOW[toDate(openKd.date).getDay()]})
                    </option>
                  )}
                  {fridays.map(f => {
                    const d = toDate(f)
                    return <option key={f} value={f}>{d.getMonth() + 1}월 {d.getDate()}일 (금)</option>
                  })}
                </select>
                <button className="pd-ghost" style={{ fontSize: 14, padding: '3px 8px' }} onClick={() => setOpenManual(true)}>직접</button>
              </>
            )}
          </label>
        )}

        {/* 오픈기간 3일/10일 토글 */}
        <div className="pd-seg">
          {([3, 10] as const).map(d => (
            <button key={d} className={mainOpenDays === d ? 'on' : ''} onClick={() => setOpenDays(d)}>
              {d}일
            </button>
          ))}
        </div>
      </div>

      <span className="pd-divider" style={{ margin: '0 10px' }} />

      {/* 정당계약 기간 */}
      <label className="pd-fld">
        정당계약
        <div className="pd-seg">
          {[3, 5, 7, 10, 14].map(d => (
            <button key={d} className={mainContractDays === d ? 'on' : ''} onClick={() => setContractDays(d)}>
              {d}일
            </button>
          ))}
        </div>
      </label>

      <span className="pd-divider" style={{ margin: '0 10px' }} />

      {/* 무순위 ON/OFF */}
      <button className={`pd-ghost vio${noOrder?.enabled ? ' on' : ''}`} onClick={toggleNoOrder}>
        무순위 {noOrder?.enabled ? 'ON' : 'OFF'}
      </button>
    </div>
  )

  return (
    <Modal open={open} onClose={onClose} title="분양 기간"
      widthCss="70vw" heightCss="90vh"
      disableBackdropClose headerControls={headerControls}>

      <div className="flex-1 flex flex-col overflow-y-auto"
        style={{ minHeight: 0, padding: '30px 26px 18px' }}>

        {/* ── 전체 일정 개요 ──────────────────────────────────── */}
        <div style={{ marginBottom: 60 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <div className="pd-lab">전체 일정</div>
            {presalesStage && mainStage && (
              <div className="pd-seg">
                <button className={!calendarView ? 'on' : ''} onClick={() => setCalendarView(false)}>바 보기</button>
                <button className={calendarView ? 'on' : ''} onClick={() => setCalendarView(true)}>달력 보기</button>
              </div>
            )}
          </div>
          {/* 변곡점 날짜 마커 (시작 · 전환점 · 종료) */}
          <div style={{ position: 'relative', height: 18, marginBottom: 3 }}>
            {[
              { key: 'period-start', date: periodStart, pct: 0 },
              ...overviewStages.slice(0, -1).map(s => ({ key: s.id, date: s.end, pct: ((toDate(s.end).getTime() - startMs) / span) * 100 })),
              { key: 'period-end', date: periodEnd, pct: 100 },
            ].map(({ key, date, pct }) => (
              <span key={key} className="pd-turn" style={{ left: `${pct}%` }}>
                {date.slice(5)}
              </span>
            ))}
          </div>
          <div ref={overviewRef} className="pd-ribbon" style={{ position: 'relative', height: OVERVIEW_H }}>
            {overviewStages.map(s => {
              const sMs   = toDate(s.start).getTime()
              const eMs   = toDate(s.end).getTime()
              const left  = ((sMs - startMs) / span) * 100
              const width = ((eMs - sMs) / span) * 100
              return (
                <div key={s.id} className="seg-fill" style={{
                  position: 'absolute',
                  left: `${left}%`, width: `${Math.max(0.4, width)}%`,
                  top: 0, bottom: 0,
                  background: SEG_GRAD[s.color],
                }}>
                  <span className="seg-name">{s.name}</span>
                </div>
              )
            })}
            {ovBoundaries.map(({ stageIdx, nextStageIdx, pct }, i) => (
              <div key={i} className="seg-handle" style={{ left: `${pct}%` }}
                onMouseDown={e => startOvDrag(e, stageIdx, nextStageIdx)}>
                <i />
              </div>
            ))}
          </div>
        </div>

        {/* ── 사전영업·본영업 통합 달력 (달력 보기 선택 시) ──── */}
        {calendarView && presalesStage && mainStage && (
          <div style={{ marginBottom: ROW_GAP * 1.5 }}>
            <CombinedPeriodCalendar
              presales={presalesStage}
              main={mainStage}
              postsales={postsalesStage}
              periodEnd={periodEnd}
              holidays={holidays}
            />
          </div>
        )}

        {/* ── 단계 행들 ─────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: ROW_GAP }}>
          {(calendarView ? stages.filter(s => s.id !== 'presales' && s.id !== 'main') : stages).map((s) => {
            const i = stages.indexOf(s)
            const sMs       = toDate(s.start).getTime()
            const eMs       = toDate(s.end).getTime()
            const stageSpan = Math.max(1, eMs - sMs)
            const days      = isNaN(eMs - sMs) ? 0 : Math.max(0, Math.round((eMs - sMs) / MS_DAY))
            const isDisabled = !s.enabled
            const isMain     = s.id === 'main'
            const isPresales = s.id === 'presales'
            const barColor   = SEG_COLOR[s.color]
            const openDays   = s.openDays ?? 3
            const stageOpenKd = s.keyDates?.find(k => k.key === 'open')
            const hasMarkers  = isPresales || !!(s.keyDates?.filter(k => !HIDDEN_KEYS.has(k.key)).length || s.subPeriods?.length)

            const pctOf = (ms: number) => ((ms - sMs) / stageSpan) * 100

            return (
              // z-index: i+1 ensures overflowing markers are above the row above them
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 16, position: 'relative', zIndex: i + 1 }}>

                {/* 이름 + 일수 열 */}
                <div style={{ width: 104, flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 2 }}>
                    <span style={{
                      width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                      background: isDisabled ? 'var(--border)' : barColor,
                    }} />
                    <span style={{
                      fontSize: 20, fontWeight: 800,
                      color: isDisabled ? 'var(--muted)' : 'var(--ink)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {s.name}
                    </span>
                  </div>
                  <span style={{ fontSize: 16, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums', paddingLeft: 17 }}>
                    {days}일
                  </span>
                </div>

                <div
                  ref={el => { if (el) trackRefs.current.set(i, el); else trackRefs.current.delete(i) }}
                  className={`pd-track select-none${isDisabled ? ' dis' : ''}`}
                  style={{ height: TRACK_H }}>

                  {isDisabled ? (
                    <div className="pd-off">
                      비활성
                      <button className="add" onClick={toggleNoOrder}>+ 활성화</button>
                    </div>
                  ) : (
                    <>
                      {/* 오픈 기간 하이라이트 */}
                      {isMain && stageOpenKd && (() => {
                        const openPct  = pctOf(toDate(stageOpenKd.date).getTime())
                        const wPct     = (openDays * MS_DAY / stageSpan) * 100
                        return (
                          <div className="pd-openhl" style={{
                            left: `${Math.max(0, openPct)}%`,
                            width: `${Math.max(0, wPct)}%`,
                          }} />
                        )
                      })()}

                      {/* 바 */}
                      <div className="pd-bar" style={{ left: 0, right: 0, background: SEG_GRAD[s.color] }}>
                        {!hasMarkers && (
                          <>
                            <span className="edge" style={{ left: 12 }}>{s.start.slice(5)}</span>
                            <span className="edge" style={{ right: 12 }}>{s.end.slice(5)}</span>
                          </>
                        )}
                      </div>

                      {/* 마커 */}
                      {hasMarkers && (
                        <div style={{ position: 'absolute', inset: 0, zIndex: 15, pointerEvents: 'none', overflow: 'visible' }}>
                          {/* 사전영업 서브기간 시작점 (draggable) */}
                          {isPresales && s.subPeriods?.map(sp => (
                            <MarkerTick key={sp.key}
                              pct={pctOf(toDate(sp.start).getTime())}
                              label={sp.label}
                              color={barColor}
                              dateStr={sp.start}
                              draggable
                              onDragStart={e => startMarkerDrag(e, 'sub', i, sp.key, sMs, stageSpan, eMs)}
                            />
                          ))}
                          {/* 모집공고일 — 사전영업은 이후에도 계속되므로 종료일이 아닌 법정 계산일에 마커만 표시 */}
                          {isPresales && (() => {
                            const mainOpenKd = mainStage?.keyDates?.find(k => k.key === 'open')
                            if (!mainOpenKd) return null
                            const announceDate = calcAnnounceDate(mainOpenKd.date, mainStage?.openDays ?? 3)
                            return (
                              <MarkerTick pct={pctOf(toDate(announceDate).getTime())} label="모집공고일" color={barColor} dateStr={announceDate} />
                            )
                          })()}

                          {/* 본영업 키 날짜 — 모두 non-draggable (오픈일/3일10일 입력으로만 변경) */}
                          {isMain && s.keyDates
                            ?.filter(kd => !HIDDEN_KEYS.has(kd.key))
                            .map(kd => (
                              <MarkerTick key={kd.key}
                                pct={pctOf(toDate(kd.date).getTime())}
                                label={kd.label}
                                color={KEY_DATE_MARKER_COLOR[kd.key] ?? barColor}
                                dateStr={kd.date}
                              />
                            ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* ── 추가 일정 (날짜 미정) ──────────────────────────── */}
        {(eventBlocks ?? []).length > 0 && (
          <div style={{ marginTop: ROW_GAP * 2.5, paddingTop: ROW_GAP, borderTop: '1px solid var(--border)' }}>
            <div className="pd-lab" style={{ marginBottom: ROW_GAP }}>추가 일정 <span style={{ fontSize: 15, color: 'var(--muted)', fontWeight: 400 }}>(날짜 미정)</span></div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
              {(eventBlocks ?? []).map((eb: EventBlock) => (
                <div key={eb.id} style={{
                  flex: '1 1 240px', minWidth: 220, maxWidth: 300,
                  border: '1px solid var(--border)', borderRadius: 12, padding: '12px 14px',
                  display: 'flex', flexDirection: 'column', gap: 8,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', flexShrink: 0, background: eb.enabled ? 'var(--violet)' : 'var(--border)' }} />
                    <span style={{ fontSize: 19, fontWeight: 800, color: eb.enabled ? 'var(--ink)' : 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                      {eb.name}
                    </span>
                    <span style={{ fontSize: 15, color: 'var(--muted)' }}>{eb.days}일</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <button
                      className={`pd-ghost vio${eb.enabled ? ' on' : ''}`}
                      onClick={() => setEventBlockEnabled(eb.id, !eb.enabled)}
                    >
                      {eb.enabled ? 'ON' : 'OFF'}
                    </button>
                    <div className="pd-seg">
                      {eb.daysOptions.map(d => (
                        <button key={d} className={eb.days === d ? 'on' : ''} onClick={() => setEventBlockDays(eb.id, d)}>
                          {d}일
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
