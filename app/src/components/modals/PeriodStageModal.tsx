import React, { useEffect, useRef, useState } from 'react'
import Modal from '../ui/Modal'
import {
  useProjectStore, toDate, toIso,
  MS_DAY, nearestFriday, calcMainKeyDates,
  type Stage,
} from '../../store/projectStore'

const SEG_COLOR: Record<string, string> = {
  teal:   'var(--teal)',
  accent: 'var(--accent)',
  violet: 'var(--violet)',
  slate:  'var(--slate)',
  amber:  'var(--amber)',
}

const MARKER_COLOR = 'rgba(255,255,255,0.95)'

// legacy keys that old persisted data might still contain
const HIDDEN_KEYS = new Set(['special', 'rank2', 'lottery'])

const TRACK_H    = 44
const FLAG_ABOVE = 50
const OVERVIEW_H = 24
const ROW_GAP    = 50

/* ── MarkerTick ──────────────────────────────────────────────────── */
function MarkerTick({ pct, label, dateStr, draggable, onDragStart }: {
  pct: number; label: string; dateStr: string
  draggable?: boolean
  onDragStart?: (e: React.MouseEvent) => void
}) {
  const [hover, setHover] = useState(false)
  const clamped = Math.max(0, Math.min(100, pct))

  return (
    <div
      style={{
        position: 'absolute',
        left: `${clamped}%`,
        top: -FLAG_ABOVE, bottom: 0,
        transform: 'translateX(-50%)',
        pointerEvents: 'auto', zIndex: 20,
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {/* date */}
      <div style={{
        position: 'absolute', top: 2, left: '50%',
        transform: 'translateX(-50%)',
        fontSize: 15, fontFamily: 'monospace', fontWeight: 700,
        color: MARKER_COLOR, whiteSpace: 'nowrap',
        textShadow: '0 1px 3px rgba(0,0,0,0.9)',
        pointerEvents: 'none',
      }}>
        {dateStr.slice(5)}
      </div>
      {/* label */}
      <div style={{
        position: 'absolute', top: 19, left: '50%',
        transform: 'translateX(-50%)',
        fontSize: 14, fontFamily: 'monospace', fontWeight: 600,
        color: MARKER_COLOR, whiteSpace: 'nowrap',
        textShadow: '0 1px 2px rgba(0,0,0,0.85)',
        background: 'rgba(0,0,0,0.35)', borderRadius: 3, padding: '0 4px',
        pointerEvents: 'none',
      }}>
        {label}
      </div>
      {/* circle — drag handle */}
      <div
        style={{
          position: 'absolute', top: 32, left: '50%',
          width: 14, height: 14, borderRadius: '50%',
          background: MARKER_COLOR, border: '1.5px solid rgba(255,255,255,0.55)',
          transform: 'translate(-50%, 0)',
          boxShadow: '0 1px 4px rgba(0,0,0,0.35)',
          cursor: draggable ? 'ew-resize' : 'default',
        }}
        onMouseDown={draggable ? onDragStart : undefined}
      />
      {/* stem */}
      <div style={{
        position: 'absolute', top: 46, bottom: 0, left: '50%',
        width: 2, background: MARKER_COLOR,
        transform: 'translateX(-50%)', opacity: 0.85,
      }} />
      {/* tooltip */}
      {hover && (
        <div style={{
          position: 'absolute', top: 0, left: 'calc(50% + 14px)',
          background: 'var(--surface-2)', border: '1px solid var(--border)',
          borderRadius: 7, padding: '4px 10px',
          fontSize: 12, fontFamily: 'monospace', whiteSpace: 'nowrap',
          color: 'var(--fg)', zIndex: 200, pointerEvents: 'none',
          boxShadow: '0 3px 10px rgba(0,0,0,0.25)',
        }}>
          {label}: {dateStr.slice(5)}
        </div>
      )}
    </div>
  )
}

/* ── main ────────────────────────────────────────────────────────── */
export default function PeriodStageModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const {
    periodStart, periodEnd, stages,
    setPeriod, setAllStages, resetStages, toggleNoOrder,
    setOpenDate, setOpenDays, updateSubPeriod,
  } = useProjectStore()

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
        const maxEnd    = toDate(d.stages0[d.nextStageIdx].end).getTime() - MS_DAY
        const clamped   = Math.max(minEnd, Math.min(maxEnd, newEnd))
        ns[d.stageIdx] = { ...ns[d.stageIdx], end: toIso(clamped) }
        const newStart  = toIso(clamped + MS_DAY)
        const nextSt    = d.stages0[d.nextStageIdx]
        if (nextSt.id === 'main') {
          // 오픈일 = 본영업.start → 경계 이동 시 key dates + 이후 단계 연동
          const newKDs  = calcMainKeyDates(newStart, nextSt.openDays ?? 3)
          const altDate = newKDs.find(k => k.key === 'alt')?.date ?? nextSt.end
          const delta   = toDate(altDate).getTime() - toDate(nextSt.end).getTime()
          ns[d.nextStageIdx] = { ...nextSt, start: newStart, end: altDate, keyDates: newKDs }
          for (let i = d.nextStageIdx + 1; i < ns.length; i++) {
            ns[i] = {
              ...ns[i],
              start: toIso(toDate(ns[i].start).getTime() + delta),
              end:   toIso(toDate(ns[i].end).getTime()   + delta),
            }
          }
        } else {
          ns[d.nextStageIdx] = { ...ns[d.nextStageIdx], start: newStart }
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
  }, [setAllStages, stages, updateSubPeriod])

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

  /* ── open date (input) ───────────────────────────────────────── */
  const handleOpenDate = (value: string) => {
    if (!value) return
    const snapped = toIso(nearestFriday(toDate(value).getTime()))
    setOpenDate(snapped)
  }

  /* ── derived ─────────────────────────────────────────────────── */
  const noOrder     = stages.find(s => s.id === 'noorder')
  const mainIdx     = stages.findIndex(s => s.id === 'main')
  const mainStage   = stages[mainIdx]
  const openKd      = mainStage?.keyDates?.find(k => k.key === 'open')
  const mainOpenDays = mainStage?.openDays ?? 3

  const overviewStages = stages.filter(s => s.enabled)
  const ovBoundaries   = overviewStages.slice(0, -1).map((s, i) => ({
    pct:          ((toDate(s.end).getTime() - startMs) / span) * 100,
    stageIdx:     stages.indexOf(s),
    nextStageIdx: stages.indexOf(overviewStages[i + 1]),
  }))

  /* ── header controls ─────────────────────────────────────────── */
  const DOW = ['일', '월', '화', '수', '목', '금', '토']

  const headerControls = (
    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6, flex: 1 }}>
      {/* 기간 뱃지 */}
      <span style={{
        fontSize: 15, fontWeight: 600, padding: '3px 10px', borderRadius: 7,
        background: 'color-mix(in oklch,var(--accent) 12%,transparent)',
        color: 'var(--accent)', whiteSpace: 'nowrap', flexShrink: 0,
      }}>
        총 {totalDays}일 · {totalMonths}개월
      </span>

      {/* 시작/종료 */}
      <label style={{ fontSize: 14, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
        시작
        <input className="field-input" style={{ fontSize: 13, padding: '2px 5px' }} type="date"
          value={periodStart} onChange={e => setPeriod(e.target.value, periodEnd)} />
      </label>
      <label style={{ fontSize: 14, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
        종료
        <input className="field-input" style={{ fontSize: 13, padding: '2px 5px' }} type="date"
          value={periodEnd} onChange={e => setPeriod(periodStart, e.target.value)} />
      </label>

      {/* 균등배분 */}
      <button style={{ fontSize: 13, padding: '2px 8px', flexShrink: 0 }}
        className="rounded border border-[var(--border)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
        onClick={resetStages}>
        균등배분
      </button>

      {/* 구분 */}
      <span style={{ width: 1, height: 20, background: 'var(--border)', flexShrink: 0 }} />

      {/* 오픈일 */}
      {openKd && (
        <label style={{ fontSize: 14, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          오픈일
          <input className="field-input" style={{ fontSize: 13, padding: '2px 5px' }} type="date"
            value={openKd.date}
            onChange={e => handleOpenDate(e.target.value)} />
          <span style={{ fontFamily: 'monospace', fontSize: 13, color: 'var(--fg)' }}>
            ({DOW[toDate(openKd.date).getDay()]})
          </span>
        </label>
      )}

      {/* 오픈기간 3일/10일 토글 */}
      <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
        {([3, 10] as const).map(d => (
          <button key={d}
            style={{ fontSize: 13, padding: '2px 8px' }}
            className={`rounded border transition-colors ${
              mainOpenDays === d
                ? 'border-[var(--accent)] text-[var(--accent)] bg-[color-mix(in_oklch,var(--accent)_14%,transparent)]'
                : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]'
            }`}
            onClick={() => setOpenDays(d)}>
            {d}일
          </button>
        ))}
      </div>

      {/* 무순위 ON/OFF */}
      <button
        style={{ fontSize: 13, padding: '2px 10px', flexShrink: 0 }}
        className={`rounded border transition-colors ${
          noOrder?.enabled
            ? 'border-[var(--violet)] text-[var(--violet)] bg-[color-mix(in_oklch,var(--violet)_12%,transparent)]'
            : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--violet)] hover:text-[var(--violet)]'
        }`}
        onClick={toggleNoOrder}>
        무순위 {noOrder?.enabled ? 'ON' : 'OFF'}
      </button>
    </div>
  )

  return (
    <Modal open={open} onClose={onClose} title="분양 기간"
      widthCss="min(66vw, 1020px)" heightCss="90vh"
      disableBackdropClose headerControls={headerControls}>

      <div className="flex-1 flex flex-col overflow-y-auto"
        style={{ minHeight: 0, padding: '40px 24px 10px' }}>

        {/* ── 전체 일정 개요 ──────────────────────────────────── */}
        <div style={{ marginBottom: 144 }}>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 5, fontFamily: 'monospace' }}>
            전체 일정
          </div>
          <div ref={overviewRef} className="relative rounded-xl shrink-0"
            style={{ height: OVERVIEW_H, background: 'var(--surface-2)' }}>
            {overviewStages.map(s => {
              const sMs   = toDate(s.start).getTime()
              const eMs   = toDate(s.end).getTime()
              const left  = ((sMs - startMs) / span) * 100
              const width = ((eMs - sMs) / span) * 100
              return (
                <div key={s.id} style={{
                  position: 'absolute',
                  left: `${left}%`, width: `${Math.max(0.4, width)}%`,
                  top: 2, bottom: 2,
                  background: SEG_COLOR[s.color], borderRadius: 4,
                  opacity: 0.88, overflow: 'hidden',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  pointerEvents: 'none',
                }}>
                  <span style={{ fontSize: 13, fontFamily: 'monospace', color: 'rgba(255,255,255,0.95)', whiteSpace: 'nowrap' }}>
                    {s.name}
                  </span>
                </div>
              )
            })}
            {ovBoundaries.map(({ stageIdx, nextStageIdx, pct }, i) => (
              <div key={i} style={{
                position: 'absolute',
                left: `${pct}%`, top: 0, bottom: 0,
                width: 14, transform: 'translateX(-50%)',
                cursor: 'ew-resize', zIndex: 10,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
              onMouseDown={e => startOvDrag(e, stageIdx, nextStageIdx)}>
                <div style={{ width: 3, height: '55%', background: 'rgba(255,255,255,0.7)', borderRadius: 2 }} />
              </div>
            ))}
          </div>
        </div>

        {/* ── 단계 행들 ─────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: ROW_GAP }}>
          {stages.map((s, i) => {
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
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12, position: 'relative', zIndex: i + 1 }}>

                {/* 이름 + 일수 열 */}
                <div style={{ width: 96, flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <span style={{
                      width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                      background: isDisabled ? 'var(--border)' : barColor,
                    }} />
                    <span style={{
                      fontSize: 20, fontWeight: 700,
                      color: isDisabled ? 'var(--muted)' : 'var(--fg)',
                      textDecoration: isDisabled ? 'line-through' : 'none',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {s.name}
                    </span>
                  </div>
                  <span style={{ fontSize: 17, color: 'var(--muted)', fontFamily: 'monospace', paddingLeft: 16 }}>
                    {days}일
                  </span>
                </div>

                <div
                  ref={el => { if (el) trackRefs.current.set(i, el); else trackRefs.current.delete(i) }}
                  className="relative flex-1 rounded-xl select-none"
                  style={{
                    height: TRACK_H,
                    background: isDisabled
                      ? 'color-mix(in oklch,var(--surface-2) 55%,transparent)'
                      : 'var(--surface-2)',
                    overflow: 'visible',
                  }}>

                  {isDisabled ? (
                    <div style={{
                      position: 'absolute', inset: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 14, color: 'var(--muted)',
                    }}>
                      비활성
                    </div>
                  ) : (
                    <>
                      {/* 오픈 기간 하이라이트 */}
                      {isMain && stageOpenKd && (() => {
                        const openPct  = pctOf(toDate(stageOpenKd.date).getTime())
                        const wPct     = (openDays * MS_DAY / stageSpan) * 100
                        return (
                          <div style={{
                            position: 'absolute',
                            left: `${Math.max(0, openPct)}%`,
                            width: `${Math.max(0, wPct)}%`,
                            top: 3, bottom: 3,
                            background: 'rgba(255,255,255,0.2)',
                            borderRadius: 6, pointerEvents: 'none', zIndex: 5,
                          }} />
                        )
                      })()}

                      {/* 바 */}
                      <div style={{
                        position: 'absolute', top: 1, bottom: 1, left: 0, right: 0,
                        borderRadius: 10, background: barColor, opacity: 0.9,
                        zIndex: 10, overflow: 'hidden',
                      }}>

                        {/* start / end labels (when no markers) */}
                        {!hasMarkers && (
                          <>
                            <span style={{
                              position: 'absolute', left: 10, top: '50%',
                              transform: 'translateY(-50%)',
                              fontSize: 17, fontFamily: 'monospace', fontWeight: 700,
                              color: 'rgba(255,255,255,0.9)',
                              textShadow: '0 1px 2px rgba(0,0,0,0.5)',
                              pointerEvents: 'none',
                            }}>{s.start.slice(5)}</span>
                            <span style={{
                              position: 'absolute', right: 10, top: '50%',
                              transform: 'translateY(-50%)',
                              fontSize: 17, fontFamily: 'monospace', fontWeight: 700,
                              color: 'rgba(255,255,255,0.9)',
                              textShadow: '0 1px 2px rgba(0,0,0,0.5)',
                              pointerEvents: 'none',
                            }}>{s.end.slice(5)}</span>
                          </>
                        )}

                      </div>

                      {/* 마커 */}
                      {hasMarkers && (
                        <div style={{
                          position: 'absolute', inset: 0,
                          zIndex: 15, pointerEvents: 'none', overflow: 'visible',
                        }}>
                          {/* 사전영업 서브기간 시작점 (draggable) */}
                          {isPresales && s.subPeriods?.map(sp => (
                            <MarkerTick key={sp.key}
                              pct={pctOf(toDate(sp.start).getTime())}
                              label={sp.label}

                              dateStr={sp.start}
                              draggable
                              onDragStart={e => startMarkerDrag(e, 'sub', i, sp.key, sMs, stageSpan, eMs)}
                            />
                          ))}
                          {/* 사전영업 종료일 = 모집공고일 (고정) */}
                          {isPresales && (
                            <MarkerTick
                              pct={100}
                              label="모집공고일"

                              dateStr={s.end}
                            />
                          )}

                          {/* 본영업 키 날짜 — 모두 non-draggable (오픈일/3일10일 입력으로만 변경) */}
                          {isMain && s.keyDates
                            ?.filter(kd => !HIDDEN_KEYS.has(kd.key))
                            .map(kd => (
                              <MarkerTick key={kd.key}
                                pct={pctOf(toDate(kd.date).getTime())}
                                label={kd.label}
  
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
      </div>
    </Modal>
  )
}
