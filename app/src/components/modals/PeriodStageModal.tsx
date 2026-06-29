import React, { useEffect, useRef } from 'react'
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

const SEG_GRAD: Record<string, string> = {
  teal:   'linear-gradient(100deg,#2fcdb8,#23b8a6)',
  accent: 'linear-gradient(100deg,#6fa0f5,#5b8def)',
  violet: 'linear-gradient(100deg,#a986f2,#9b6cf0)',
  slate:  'linear-gradient(100deg,#8e96b4,#7b86a8)',
  amber:  'linear-gradient(100deg,#efb45c,#e8a33d)',
}

// legacy keys that old persisted data might still contain
const HIDDEN_KEYS = new Set(['special', 'rank2', 'lottery'])

const TRACK_H    = 46
const OVERVIEW_H = 30
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
    <div className="pd-toolbar">
      {/* 기간 뱃지 */}
      <span className="pd-badge">총 {totalDays}일 · {totalMonths}개월</span>

      {/* 시작/종료 */}
      <label className="pd-fld">
        시작
        <input type="date" value={periodStart} onChange={e => setPeriod(e.target.value, periodEnd)} />
      </label>
      <label className="pd-fld">
        종료
        <input type="date" value={periodEnd} onChange={e => setPeriod(periodStart, e.target.value)} />
      </label>

      {/* 균등배분 */}
      <button className="pd-ghost" onClick={resetStages}>균등배분</button>

      <span className="pd-divider" />

      {/* 오픈일 */}
      {openKd && (
        <label className="pd-fld">
          오픈일
          <input type="date" value={openKd.date} onChange={e => handleOpenDate(e.target.value)} />
          <b style={{ color: 'var(--ink)' }}>({DOW[toDate(openKd.date).getDay()]})</b>
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

      {/* 무순위 ON/OFF */}
      <button className={`pd-ghost vio${noOrder?.enabled ? ' on' : ''}`} onClick={toggleNoOrder}>
        무순위 {noOrder?.enabled ? 'ON' : 'OFF'}
      </button>
    </div>
  )

  return (
    <Modal open={open} onClose={onClose} title="분양 기간"
      widthCss="min(66vw, 1020px)" heightCss="90vh"
      disableBackdropClose headerControls={headerControls}>

      <div className="flex-1 flex flex-col overflow-y-auto"
        style={{ minHeight: 0, padding: '30px 26px 18px' }}>

        {/* ── 전체 일정 개요 ──────────────────────────────────── */}
        <div style={{ marginBottom: 60 }}>
          <div className="pd-lab">전체 일정</div>
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
                  {s.name}
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
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 16, position: 'relative', zIndex: i + 1 }}>

                {/* 이름 + 일수 열 */}
                <div style={{ width: 104, flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 2 }}>
                    <span style={{
                      width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                      background: isDisabled ? 'var(--border)' : barColor,
                    }} />
                    <span style={{
                      fontSize: 18, fontWeight: 800,
                      color: isDisabled ? 'var(--muted)' : 'var(--ink)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {s.name}
                    </span>
                  </div>
                  <span style={{ fontSize: 14, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums', paddingLeft: 17 }}>
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
                          {/* 사전영업 종료일 = 모집공고일 (고정) */}
                          {isPresales && (
                            <MarkerTick pct={100} label="모집공고일" color={barColor} dateStr={s.end} />
                          )}

                          {/* 본영업 키 날짜 — 모두 non-draggable (오픈일/3일10일 입력으로만 변경) */}
                          {isMain && s.keyDates
                            ?.filter(kd => !HIDDEN_KEYS.has(kd.key))
                            .map(kd => (
                              <MarkerTick key={kd.key}
                                pct={pctOf(toDate(kd.date).getTime())}
                                label={kd.label}
                                color={barColor}
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
