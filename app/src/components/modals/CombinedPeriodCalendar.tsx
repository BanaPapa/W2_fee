import { toDate, toIso, MS_DAY, calcAnnounceDate, type Stage } from '../../store/projectStore'
import { DOW } from '../../lib/schedule'
import type { HolidayMap } from '../../lib/holidays'

const STAGE_COLOR: Record<string, string> = { presales: 'var(--teal)', main: 'var(--accent)', postsales: 'var(--slate)' }
const STAGE_TINT: Record<string, string> = {
  presales:  'color-mix(in oklch, var(--teal) 18%, transparent)',
  main:      'color-mix(in oklch, var(--accent) 18%, transparent)',
  postsales: 'color-mix(in oklch, var(--slate) 18%, transparent)',
}

// 달력 보기 전용 색상 — 오픈일: 빨강, 청약(특별공급/1순위/2순위): 보라, 정당계약기간·예당계약: 노랑
const OPEN_COLOR       = '#dc2626'
const SUBSCRIBE_COLOR  = '#7c3aed'
const CONTRACT_COLOR   = '#d97706'
const ANNOUNCE_COLOR   = '#0284c7'

interface MonthCell { year: number; month: number }

function monthKey(m: MonthCell): number { return m.year * 12 + m.month }

function monthsBetween(startIso: string, endIso: string): MonthCell[] {
  const s = toDate(startIso)
  const e = toDate(endIso)
  const result: MonthCell[] = []
  let y = s.getFullYear()
  let m = s.getMonth()
  while (y < e.getFullYear() || (y === e.getFullYear() && m <= e.getMonth())) {
    result.push({ year: y, month: m })
    m++
    if (m > 11) { m = 0; y++ }
  }
  return result
}

function mergeMonths(...lists: MonthCell[][]): MonthCell[] {
  const map = new Map<number, MonthCell>()
  for (const list of lists) for (const m of list) map.set(monthKey(m), m)
  return [...map.values()].sort((a, b) => monthKey(a) - monthKey(b))
}

const MAX_MONTHS = 4

/**
 * 달력에 표시할 월을 최대 4개월로 고른다.
 * - 본영업은 항상 전부 보여주되(예당계약까지 고정 일정을 정확히 봐야 하므로), 그 자체가
 *   예산을 넘으면 가장 최근(예당계약 쪽) 달을 우선하고 이른 달부터 잘라낸다.
 * - 남는 예산은 사전영업에 배분한다(원칙 1개월, 본영업이 1개월 안에 들어오면 2개월).
 * - 마지막 달(분양기간 종료월 = 사후영업 미리보기)은 본영업에 이미 포함되지 않았다면 1개월을
 *   따로 확보한다.
 */
function pickMonths(presales: Stage, main: Stage, periodEnd: string): MonthCell[] {
  const presalesAll = monthsBetween(presales.start, presales.end)
  const mainMonths  = monthsBetween(main.start, main.end)
  const lastDate    = toDate(periodEnd)
  const lastCell    = { year: lastDate.getFullYear(), month: lastDate.getMonth() }
  const lastInMain  = mainMonths.some(m => monthKey(m) === monthKey(lastCell))

  const middleBudget = MAX_MONTHS - (lastInMain ? 0 : 1)
  const mainShown = mainMonths.length > middleBudget
    ? mainMonths.slice(-middleBudget)
    : mainMonths

  const presalesBudget = Math.max(0, middleBudget - mainShown.length)
  const presalesCap = presalesAll.length < 2 ? presalesAll.length : (mainMonths.length <= 1 ? 2 : 1)
  const presalesShown = presalesAll.slice(0, Math.min(presalesBudget, presalesCap))

  return mergeMonths(presalesShown, mainShown, [lastCell])
}

export default function CombinedPeriodCalendar({
  presales, main, postsales, periodEnd, holidays,
}: {
  presales: Stage
  main: Stage
  postsales?: Stage
  periodEnd: string
  holidays: HolidayMap
}) {
  const months = pickMonths(presales, main, periodEnd)

  const stageRanges = [presales, main, postsales].filter((s): s is Stage => !!s).map(s => ({
    id: s.id,
    startMs: toDate(s.start).getTime(),
    endMs: toDate(s.end).getTime(),
  }))

  const subMarkers = new Map<string, { label: string; color: string }>()
  for (const sp of presales.subPeriods ?? []) subMarkers.set(sp.start, { label: sp.label, color: STAGE_COLOR.presales })
  const mainOpenKd = main.keyDates?.find(kd => kd.key === 'open')
  if (mainOpenKd) {
    subMarkers.set(calcAnnounceDate(mainOpenKd.date, main.openDays ?? 3), { label: '모집공고일', color: ANNOUNCE_COLOR })
  }

  const findKd = (key: string) => main.keyDates?.find(kd => kd.key === key)
  const keyMarkers = new Map<string, { label: string; color: string }>()

  if (mainOpenKd) keyMarkers.set(mainOpenKd.date, { label: '오픈일', color: OPEN_COLOR })

  const rank1Kd = findKd('rank1')
  if (rank1Kd) {
    const r1Ms = toDate(rank1Kd.date).getTime()
    keyMarkers.set(toIso(r1Ms - MS_DAY), { label: '특별공급', color: SUBSCRIBE_COLOR })
    keyMarkers.set(rank1Kd.date,          { label: '1순위',   color: SUBSCRIBE_COLOR })
    keyMarkers.set(toIso(r1Ms + MS_DAY),  { label: '2순위',   color: SUBSCRIBE_COLOR })
  }

  const winnerKd = findKd('winner')
  if (winnerKd) keyMarkers.set(winnerKd.date, { label: winnerKd.label, color: STAGE_COLOR.main })

  const contractKd = findKd('contract')
  const altKd = findKd('alt')
  if (contractKd && altKd) {
    const cMs = toDate(contractKd.date).getTime()
    const aMs = toDate(altKd.date).getTime()
    for (let ms = cMs; ms < aMs; ms += MS_DAY) keyMarkers.set(toIso(ms), { label: '정당계약', color: CONTRACT_COLOR })
    keyMarkers.set(altKd.date, { label: '예당계약', color: CONTRACT_COLOR })
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${months.length}, 1fr)`, gap: 24 }}>
        {months.map(({ year, month }) => {
          const daysInMonth = new Date(year, month + 1, 0).getDate()
          const firstDow    = new Date(year, month, 1).getDay()
          const cells: (number | null)[] = [
            ...Array(firstDow).fill(null),
            ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
          ]

          return (
            <div key={`${year}-${month}`} style={{ minWidth: 0 }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--ink)', marginBottom: 10 }}>
                {year}년 {month + 1}월
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 4 }}>
                {DOW.map((d, i) => (
                  <div key={d} style={{
                    textAlign: 'center', fontSize: 13, fontWeight: 700, paddingBottom: 5,
                    color: i === 0 ? '#ef4444' : i === 6 ? '#3b82f6' : 'var(--muted)',
                  }}>
                    {d}
                  </div>
                ))}
                {cells.map((day, idx) => {
                  if (day == null) return <div key={idx} />

                  const dateMs = new Date(year, month, day).getTime()
                  const iso    = toIso(dateMs)
                  const dow    = new Date(year, month, day).getDay()
                  const stage  = stageRanges.find(r => dateMs >= r.startMs && dateMs <= r.endMs)
                  const holidayNames = holidays[iso]
                  const marker    = keyMarkers.get(iso)
                  const subMarker = !marker ? subMarkers.get(iso) : undefined

                  const baseTint = stage ? STAGE_TINT[stage.id] : undefined
                  const bg = marker
                    ? `color-mix(in oklch, ${marker.color} 16%, transparent)`
                    : holidayNames ? 'color-mix(in oklch, #ef4444 8%, transparent)' : baseTint
                  const numColor = holidayNames ? '#ef4444' : dow === 0 ? '#ef4444' : dow === 6 ? '#3b82f6' : 'var(--fg)'

                  return (
                    <div
                      key={idx}
                      title={[marker?.label, subMarker?.label, holidayNames?.join(', ')].filter(Boolean).join(' · ') || undefined}
                      style={{
                        height: 92, minWidth: 0, borderRadius: 7, padding: '4px 5px 3px',
                        background: bg,
                        border: marker ? `1.5px solid ${marker.color}` : '1px solid transparent',
                        display: 'flex', flexDirection: 'column', gap: 1, overflow: 'hidden',
                      }}
                    >
                      <span style={{ fontSize: 14, fontWeight: 700, color: numColor }}>{day}</span>
                      {marker && (
                        <span style={{
                          fontSize: 11, fontWeight: 800, color: marker.color, lineHeight: 1.2,
                          whiteSpace: 'normal',
                        }}>
                          {marker.label}
                        </span>
                      )}
                      {subMarker && (
                        <span style={{
                          fontSize: 11, fontWeight: 800, color: subMarker.color, lineHeight: 1.2,
                          whiteSpace: 'normal',
                        }}>
                          {subMarker.label}
                        </span>
                      )}
                      {holidayNames && (
                        <span style={{
                          fontSize: 11, color: '#ef4444', lineHeight: 1.2,
                          whiteSpace: 'normal',
                        }}>
                          {holidayNames[0]}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* 범례 */}
      <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap', marginTop: 20, paddingTop: 14, borderTop: '1px solid var(--border)', fontSize: 15, color: 'var(--muted)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 11, height: 11, borderRadius: 3, background: STAGE_COLOR.presales }} /> 사전영업
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 11, height: 11, borderRadius: 3, background: STAGE_COLOR.main }} /> 본영업
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 11, height: 11, borderRadius: 3, background: STAGE_COLOR.postsales }} /> 사후영업
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 11, height: 11, borderRadius: 3, background: ANNOUNCE_COLOR }} /> 모집공고일
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 11, height: 11, borderRadius: 3, background: OPEN_COLOR }} /> 오픈일
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 11, height: 11, borderRadius: 3, background: SUBSCRIBE_COLOR }} /> 청약(특별공급·1순위·2순위)
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 11, height: 11, borderRadius: 3, background: CONTRACT_COLOR }} /> 정당계약·예당계약
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 11, height: 11, borderRadius: 3, background: '#ef4444' }} /> 공휴일
        </span>
      </div>
    </div>
  )
}
