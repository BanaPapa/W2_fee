import { useState } from 'react'
import DetailHeader from './DetailHeader'
import FeeStrip, { STAGE_COLOR } from '../ui/FeeStrip'
import { won, num } from '../../lib/format'
import {
  useFeeStore,
  feePeriodRows,
  feeStageRows,
  mgmTotal,
  mgmUnits,
  billTotal,
  orgTotal,
  feeCostTotal,
  STAGE_META,
  MGM_PRICE_OPTIONS,
  MGM_RATE_OPTIONS,
  type StageId,
  type MgmBasis,
} from '../../store/feeStore'

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

function SectionTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex items-baseline gap-3 mt-2">
      <h3 className="text-[18px] font-extrabold tracking-[-0.01em] m-0">{title}</h3>
      {hint && <span className="text-[13px] text-[var(--muted)]">{hint}</span>}
    </div>
  )
}

export default function FeeDetail() {
  const fee = useFeeStore((s) => s)
  const { setTotalUnits, setBillAmount, updatePeriod, updateStageRate, setMgmUnitPrice, setMgmRatePct, setMgmBasis } = useFeeStore()

  const rows = feePeriodRows(fee)
  const stages = feeStageRows(fee)
  const cumPct = rows[rows.length - 1]?.cumPct ?? 0
  const bill = billTotal(fee)
  const org = orgTotal(fee)
  const mgm = mgmTotal(fee)
  const mgmN = mgmUnits(fee)
  const basisRow = rows[fee.mgmBasis === 'contract' ? 0 : 1]

  return (
    <div className="pb-8" data-c="fee">
      <DetailHeader
        title="조직수수료 · MGM"
        subtitle="목표분양률 연동"
        total={feeCostTotal(fee)}
        actions={
          <label className="flex items-center gap-2 text-[14px] text-[var(--muted)] font-semibold">
            총 세대수
            <AmountInput value={fee.totalUnits} onUpdate={setTotalUnits} width={90} />
          </label>
        }
      />

      <div className="px-6 pt-5 flex flex-col gap-5">
        {/* 손익 요약 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-[10px] border border-[var(--border)] px-4 py-3" style={{ borderColor: 'var(--accent)' }}>
            <div className="text-[12.5px] font-bold text-[var(--muted)] tracking-[0.02em]">청구수수료 (수입) · 직접 입력</div>
            <div className="mt-1">
              <AmountInput value={bill} onUpdate={setBillAmount} width={150} />
            </div>
          </div>
          <SummaryTile label="조직수수료 (지급)" value={org} />
          <SummaryTile label="MGM · 소개수수료" value={mgm} />
          <SummaryTile label="수수료 마진" value={bill - org - mgm} profit />
        </div>

        {/* ---------- 목표분양률 ---------- */}
        <SectionTitle title="목표분양률" hint="D+n = 정당계약 첫날 + n개월 · 분양기간에 맞춰 자동 생성" />
        <FeeStrip doc={fee} height={64} showLabels />
        {cumPct !== 100 && (
          <div className="text-[13.5px] font-bold" style={{ color: 'var(--rose, #e34948)' }}>
            누적 분양률이 {cumPct}%입니다 — 100%가 되도록 구간별 값을 조정하세요.
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>기간</th>
                <th>수수료 단계</th>
                <th style={{ textAlign: 'right' }}>구간별 %</th>
                <th style={{ textAlign: 'right' }}>누적 %</th>
                <th style={{ textAlign: 'right' }}>세대수</th>
                <th style={{ textAlign: 'right' }}>누적 세대수</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key}>
                  <td className="font-bold">
                    <span
                      className="inline-block w-[10px] h-[10px] rounded-[3px] mr-2 align-middle"
                      style={{ background: STAGE_COLOR[r.stage] }}
                      aria-hidden
                    />
                    {r.label}
                    {r.date && (
                      <span className="ml-2 text-[13px] font-normal text-[var(--muted)] tabular">
                        {r.date.slice(2).replaceAll('-', '.')}
                      </span>
                    )}
                  </td>
                  <td>
                    <select
                      className="field-input !text-left !px-2"
                      value={r.stage}
                      onChange={(e) => updatePeriod(r.key, { stage: e.target.value as StageId })}
                    >
                      {STAGE_META.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="num">
                    <input
                      className="field-input w-[64px] text-right"
                      type="number"
                      min={0}
                      max={100}
                      value={r.ratePct}
                      onChange={(e) => updatePeriod(r.key, { ratePct: Math.max(0, Number(e.target.value) || 0) })}
                    />
                  </td>
                  <td className="num text-[var(--muted)]">{r.cumPct}%</td>
                  <td className="num font-semibold">{num(r.units)}</td>
                  <td className="num text-[var(--muted)]">{num(r.cumUnits)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ---------- 단계별 조직수수료 ---------- */}
        <SectionTitle title="단계별 조직수수료 단가" hint="하청업체 지급 · 세대당 단가 × 구간 세대수" />
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>단계</th>
                <th>적용 기간</th>
                <th style={{ textAlign: 'right' }}>세대수</th>
                <th style={{ textAlign: 'right' }}>조직 단가</th>
                <th style={{ textAlign: 'right' }}>조직수수료</th>
              </tr>
            </thead>
            <tbody>
              {stages.map((s) => (
                <tr key={s.id}>
                  <td className="font-bold">
                    <span
                      className="inline-block w-[10px] h-[10px] rounded-[3px] mr-2 align-middle"
                      style={{ background: STAGE_COLOR[s.id] }}
                      aria-hidden
                    />
                    {s.name}
                  </td>
                  <td className="text-[var(--muted)]">
                    {s.periodLabels.length ? s.periodLabels.join(' · ') : '—'}
                  </td>
                  <td className="num">{num(s.units)}</td>
                  <td className="num">
                    <AmountInput value={s.org} onUpdate={(v) => updateStageRate(s.id, { org: v })} width={96} />
                  </td>
                  <td className="num font-semibold">{won(s.orgTotal)}</td>
                </tr>
              ))}
              <tr>
                <td className="font-extrabold">계</td>
                <td></td>
                <td className="num font-extrabold">{num(fee.totalUnits)}</td>
                <td></td>
                <td className="num font-extrabold">{won(org)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ---------- MGM ---------- */}
        <SectionTitle title="MGM · 소개수수료" hint="기준 시점까지 누적 세대수 × 비율 × 세대당 단가" />
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-[14px] font-semibold text-[var(--muted)]">
            기준 시점
            <select
              className="field-input !text-left !px-2"
              value={fee.mgmBasis}
              onChange={(e) => setMgmBasis(e.target.value as MgmBasis)}
            >
              <option value="contract">정당까지</option>
              <option value="alt">예당까지</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-[14px] font-semibold text-[var(--muted)]">
            비율
            <select
              className="field-input !text-left !px-2"
              value={fee.mgmRatePct}
              onChange={(e) => setMgmRatePct(Number(e.target.value))}
            >
              {MGM_RATE_OPTIONS.map((r) => (
                <option key={r} value={r}>{r}%</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-[14px] font-semibold text-[var(--muted)]">
            세대당 단가
            <select
              className="field-input !text-left !px-2"
              value={fee.mgmUnitPrice}
              onChange={(e) => setMgmUnitPrice(Number(e.target.value))}
            >
              {MGM_PRICE_OPTIONS.map((p) => (
                <option key={p} value={p}>{num(p / 10000)}만 원</option>
              ))}
            </select>
          </label>
        </div>
        <div className="text-[15px]">
          {basisRow ? (
            <>
              <span className="text-[var(--muted)]">
                {basisRow.label}까지 누적 {num(basisRow.cumUnits)}세대 × {fee.mgmRatePct}% ={' '}
                {num(mgmN)}세대 × {num(fee.mgmUnitPrice / 10000)}만 원 ={' '}
              </span>
              <b className="text-[17px]">{won(mgm)}</b>
            </>
          ) : (
            '기간 데이터가 없습니다.'
          )}
        </div>
      </div>
    </div>
  )
}

function SummaryTile({ label, value, accent, profit }: { label: string; value: number; accent?: boolean; profit?: boolean }) {
  return (
    <div className="rounded-[10px] border border-[var(--border)] px-4 py-3">
      <div className="text-[12.5px] font-bold text-[var(--muted)] tracking-[0.02em]">{label}</div>
      <div
        className="text-[19px] font-extrabold tabular mt-0.5"
        style={{ color: accent ? 'var(--accent)' : profit ? 'var(--teal)' : 'var(--ink)' }}
      >
        {won(value)}
      </div>
    </div>
  )
}
