import type { CSSProperties } from 'react'
import { feePeriodRows, type FeeDoc, type StageId } from '../../store/feeStore'

/** 단계별 색 — 데스크는 무채색, 1~3단계는 액센트 농도로 구분 */
export const STAGE_COLOR: Record<StageId, string> = {
  desk: 'color-mix(in oklch, var(--muted) 42%, transparent)',
  s1: 'color-mix(in oklch, var(--accent) 40%, transparent)',
  s2: 'color-mix(in oklch, var(--accent) 55%, transparent)',
  s3: 'color-mix(in oklch, var(--accent) 70%, transparent)',
  s4: 'color-mix(in oklch, var(--accent) 85%, transparent)',
  s5: 'var(--accent)',
}

interface Props {
  doc: Pick<FeeDoc, 'totalUnits' | 'periods'>
  height?: number
  showLabels?: boolean
  style?: CSSProperties
  /** 구간이 많아져도(12개월 이상) 막대가 너무 얇아지지 않도록 최소 폭을 두고 가로 스크롤한다 */
  scrollable?: boolean
  /** scrollable일 때 구간 하나의 최소 폭(px) */
  minBarWidth?: number
}

/** 목표분양률 누적 계단 스트립 — 막대 높이가 누적 분양률, 색이 수수료 단계 */
export default function FeeStrip({ doc, height = 44, showLabels = false, style, scrollable = false, minBarWidth = 28 }: Props) {
  const rows = feePeriodRows(doc)
  const max = Math.max(100, rows[rows.length - 1]?.cumPct ?? 100)
  const barFlex = scrollable ? `1 0 ${minBarWidth}px` : '1 1 0%'
  const content = (
    <div style={{ minWidth: scrollable ? rows.length * minBarWidth : undefined }}>
      <div className="flex items-end gap-[2px]" style={{ height }} aria-hidden>
        {rows.map((r) => (
          <div
            key={r.key}
            className="rounded-t-[3px] min-h-[3px]"
            style={{ flex: barFlex, height: `${(r.cumPct / max) * 100}%`, background: STAGE_COLOR[r.stage] }}
            title={`${r.label} 누적 ${r.cumPct}% · ${r.cumUnits.toLocaleString('ko-KR')}세대`}
          />
        ))}
      </div>
      {showLabels && (
        <div className="flex gap-[2px] mt-1">
          {rows.map((r) => (
            <div key={r.key} className="text-center text-[11px] text-[var(--muted)] whitespace-nowrap" style={{ flex: barFlex }}>
              {r.label}
            </div>
          ))}
        </div>
      )}
    </div>
  )
  return (
    <div style={style}>
      {scrollable ? <div style={{ overflowX: 'auto' }}>{content}</div> : content}
    </div>
  )
}
