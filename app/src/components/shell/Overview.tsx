import { won, wonCompact } from '../../lib/format'
import { useTotals } from '../../store/totals'
import { useFeeStore, feePeriodRows } from '../../store/feeStore'
import { useUIStore } from '../../store/uiStore'
import { useCountUp } from '../../lib/useCountUp'

const openFee = () => { window.location.hash = 'fee' }

export default function Overview({ mode }: { mode: 'grid' | 'split' }) {
  const { grand, bill, profit, totalUnits } = useTotals()
  const fee = useFeeStore((s) => s)
  const openModal = useUIStore((s) => s.openModal)
  const animatedBill = useCountUp(bill)
  const perUnit = totalUnits > 0 ? bill / totalUnits : 0
  const feeRows = feePeriodRows(fee)
  const finalRow = feeRows[feeRows.length - 1]
  const profitColor = profit >= 0 ? 'var(--teal)' : 'var(--rose, #e34948)'

  // 축소(사이드) 모드 — 카드 상세가 열렸을 때 좌측에 뜨는 간결한 표기. 기존 유지.
  if (mode === 'split') {
    return (
      <section className="text-left pt-2 pb-1 pl-1 pr-1.5 border-b border-[color-mix(in_oklch,var(--border)_76%,transparent)]">
        <div className="kicker" style={{ fontSize: 12 }}>청구수수료 · 세대당 {wonCompact(perUnit)}</div>
        <button
          className="grand block bg-transparent border-0 p-0 cursor-pointer"
          style={{ fontSize: 'clamp(26px,2.6vw,38px)', margin: '8px 0 10px', color: 'inherit', fontFamily: 'inherit' }}
          onClick={openFee}
          aria-label="수수료 상세 열기"
        >
          {won(animatedBill)}
        </button>
        <div className="uline" style={{ width: 56, margin: '0 0 12px' }} />
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 justify-start text-[14px]">
          <span className="text-[var(--muted)]">
            비용 <b className="text-[var(--ink)] tabular">{wonCompact(grand)}</b>
          </span>
          <span className="text-[var(--muted)]">
            순이익 <b className="tabular" style={{ color: profitColor }}>{wonCompact(profit)}</b>
          </span>
        </div>
      </section>
    )
  }

  // 메인 모드 — 청구수수료 − 비용 = 순이익 세로 산수식 (세 숫자 모두 같은 크기)
  const numFont = 'clamp(24px, 3vw, 38px)'
  const opFont = 'clamp(18px, 2.2vw, 28px)'
  const op = (symbol: string) => (
    <span style={{ width: 26, flexShrink: 0, textAlign: 'center', color: 'var(--muted)', fontWeight: 700, fontSize: opFont, lineHeight: 1 }}>
      {symbol}
    </span>
  )

  return (
    <section className="text-center pb-4">
      {/* 상단 메타: 세대당 · 세대수 · 목표분양률 D+N (비용 아래에서 여기로 이동, 그래프는 표시하지 않음) */}
      <div className="kicker flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1" style={{ fontSize: 13 }}>
        <span>세대당 {wonCompact(perUnit)}</span>
        <span aria-hidden style={{ opacity: 0.5 }}>·</span>
        <span className="meta-chip">{totalUnits.toLocaleString('ko-KR')}세대</span>
        <span aria-hidden style={{ opacity: 0.5 }}>·</span>
        <button
          onClick={() => openModal('target')}
          className="bg-transparent border-0 p-0 cursor-pointer font-semibold"
          style={{ fontFamily: 'inherit', fontSize: 13, color: 'var(--muted)' }}
          aria-label="목표분양률 열기"
        >
          목표분양률 · 정당 → {finalRow?.label ?? ''} 누적 {finalRow?.cumPct ?? 0}%
        </button>
      </div>

      {/* 산수식 */}
      <div className="mx-auto tabular" style={{ maxWidth: 'min(94vw, 560px)', marginTop: 20 }}>
        {/* 청구수수료 (클릭 시 수수료 상세) */}
        <button
          onClick={openFee}
          className="w-full flex items-center bg-transparent border-0 p-0 cursor-pointer"
          style={{ gap: 12, fontFamily: 'inherit', color: 'inherit' }}
          aria-label="수수료 상세 열기"
        >
          {op('')}
          <span className="text-[var(--muted)]" style={{ fontSize: 17 }}>청구수수료</span>
          <b style={{ marginLeft: 'auto', fontSize: numFont, fontWeight: 800, color: 'var(--accent)', whiteSpace: 'nowrap' }}>{won(animatedBill)}</b>
        </button>

        {/* − 비용 */}
        <div className="flex items-center" style={{ gap: 12, marginTop: 14 }}>
          {op('−')}
          <span className="text-[var(--muted)]" style={{ fontSize: 17 }}>비용</span>
          <b className="text-[var(--ink)]" style={{ marginLeft: 'auto', fontSize: numFont, fontWeight: 800, whiteSpace: 'nowrap' }}>{won(grand)}</b>
        </div>

        {/* 구분선 */}
        <div style={{ height: 2, background: 'var(--border)', borderRadius: 2, margin: '14px 0' }} />

        {/* = 순이익 */}
        <div className="flex items-center" style={{ gap: 12 }}>
          {op('=')}
          <span className="text-[var(--muted)]" style={{ fontSize: 17 }}>순이익</span>
          <b style={{ marginLeft: 'auto', fontSize: numFont, fontWeight: 800, color: profitColor, whiteSpace: 'nowrap' }}>{won(profit)}</b>
        </div>
      </div>
    </section>
  )
}
