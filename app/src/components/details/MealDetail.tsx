import { useState } from 'react'
import DetailHeader from './DetailHeader'
import Modal from '../ui/Modal'
import { GearIcon } from '../icons'
import { won } from '../../lib/format'
import { useMealStore, isDinnerRole, mealTotal, postsalesRoles, postsalesMealAmount } from '../../store/mealStore'
import { useLaborStore, DEFAULT_SECTION_NAMES, roleUnitPriceValue, roleTotalDays } from '../../store/laborStore'
import { useProjectStore } from '../../store/projectStore'
import { monthWorkP, projectMonths as computeProjectMonths, type MonthCell } from '../../lib/schedule'
import type { Role, Section } from '../../store/laborStore'

const SECTION_ORDER: Section[] = ['planning', 'sales', 'other_short', 'other_long']

function NumInput({
  value,
  onCommit,
  className = 'w-[140px]',
}: {
  value: number
  onCommit: (v: number) => void
  className?: string
}) {
  const [editing, setEditing] = useState(false)
  const [raw, setRaw] = useState('')
  return (
    <input
      className={`field-input text-right ${className}`}
      type="text"
      inputMode="numeric"
      value={editing ? raw : value.toLocaleString('ko-KR')}
      onFocus={() => { setEditing(true); setRaw(String(value)) }}
      onChange={(e) => {
        const s = e.target.value.replace(/[^0-9]/g, '')
        setRaw(s)
        onCommit(parseInt(s) || 0)
      }}
      onBlur={() => setEditing(false)}
    />
  )
}

const ChevronIcon = ({ open }: { open: boolean }) => (
  <svg
    viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}
    strokeLinecap="round" strokeLinejoin="round"
    style={{ width: 14, height: 14, flexShrink: 0, transition: 'transform 0.18s', transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}
  >
    <path d="M9 18l6-6-6-6" />
  </svg>
)

function MealMatrix({
  roles,
  projectMonths,
  ratePerDay,
  sectionNames,
}: {
  roles: Role[]
  projectMonths: MonthCell[]
  ratePerDay: number
  sectionNames: Record<Section, string>
}) {
  const amounts = projectMonths.map(({ year, month }) =>
    roles.map((r) => r.people.reduce((a, p) => a + monthWorkP(p, year, month), 0) * ratePerDay)
  )

  const activeMonthIdxs = projectMonths.map((_, i) => i).filter((mi) => amounts[mi].some((v) => v > 0))
  const activeRoleIdxs = roles.map((_, i) => i).filter((ri) => activeMonthIdxs.some((mi) => amounts[mi][ri] > 0))

  const roleTotalMap = new Map(
    activeRoleIdxs.map((ri) => [ri, activeMonthIdxs.reduce((a, mi) => a + amounts[mi][ri], 0)])
  )
  const monthTotals = activeMonthIdxs.map((mi) => activeRoleIdxs.reduce((a, ri) => a + amounts[mi][ri], 0))
  const grandTotal = monthTotals.reduce((a, v) => a + v, 0)

  const sectionGroups = SECTION_ORDER
    .map((sec) => ({
      sec,
      label: sectionNames[sec] ?? DEFAULT_SECTION_NAMES[sec],
      idxs: activeRoleIdxs.filter((ri) => (roles[ri].section ?? 'planning') === sec),
    }))
    .filter((g) => g.idxs.length > 0)

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const toggle = (sec: string) => setCollapsed((c) => ({ ...c, [sec]: !c[sec] }))

  if (activeMonthIdxs.length === 0) {
    return <div className="text-center py-8 text-[18px]" style={{ color: 'var(--muted)' }}>데이터 없음</div>
  }

  const thCls = 'py-2.5 px-3 font-bold text-[18px]'
  const tdCls = 'py-2.5 px-3 text-[18px] tabular'
  const borderL = { borderLeft: '1px solid var(--border)' }
  const borderT = { borderTop: '1px solid var(--border)' }
  const borderT2 = { borderTop: '2px solid var(--border)' }

  return (
    <div className="overflow-x-auto rounded-xl border" style={{ borderColor: 'var(--border)' }}>
      <table className="w-full border-collapse">
        <thead style={{ background: 'var(--surface-2)' }}>
          <tr>
            <th className={`${thCls} text-left`} style={{ color: 'var(--muted)', minWidth: 80 }}>직무</th>
            {activeMonthIdxs.map((mi) => (
              <th key={mi} className={`${thCls} text-right`} style={{ color: 'var(--ink)', minWidth: 96 }}>
                {projectMonths[mi].year}년 {projectMonths[mi].month + 1}월
              </th>
            ))}
            <th className={`${thCls} text-right`} style={{ color: 'var(--accent)', minWidth: 104, ...borderL }}>합계</th>
          </tr>
          {/* 전체 합계 — 맨 위 */}
          <tr style={borderT2}>
            <td className={`${tdCls} font-bold`} style={{ color: 'var(--ink)' }}>합계</td>
            {activeMonthIdxs.map((mi, i) => (
              <td key={mi} className={`${tdCls} text-right font-bold`} style={{ color: 'var(--fg)' }}>
                {won(monthTotals[i])}
              </td>
            ))}
            <td className={`${tdCls} text-right font-bold text-[20px]`} style={{ color: 'var(--accent)', ...borderL }}>
              {won(grandTotal)}
            </td>
          </tr>
        </thead>
        <tbody>
          {sectionGroups.map((g) => {
            const open = !collapsed[g.sec]
            // 섹션 소계: 월별 / 전체
            const secMonthTotals = activeMonthIdxs.map((mi) =>
              g.idxs.reduce((a, ri) => a + amounts[mi][ri], 0)
            )
            const secTotal = secMonthTotals.reduce((a, v) => a + v, 0)

            return (
              <>
                {/* 섹션 헤더 + 소계 (클릭하면 폴드) */}
                <tr
                  key={`sec-${g.sec}`}
                  style={{ borderTop: '2px solid var(--border)', cursor: 'pointer', userSelect: 'none' }}
                  onClick={() => toggle(g.sec)}
                >
                  <td
                    className={`${tdCls} font-bold`}
                    style={{ color: 'var(--muted)', background: 'var(--surface-2)' }}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <ChevronIcon open={open} />
                      {g.label}
                    </span>
                  </td>
                  {activeMonthIdxs.map((mi, i) => (
                    <td
                      key={mi}
                      className={`${tdCls} text-right font-semibold`}
                      style={{ color: 'var(--fg)', background: 'var(--surface-2)' }}
                    >
                      {won(secMonthTotals[i])}
                    </td>
                  ))}
                  <td
                    className={`${tdCls} text-right font-bold`}
                    style={{ color: 'var(--ink)', background: 'var(--surface-2)', ...borderL }}
                  >
                    {won(secTotal)}
                  </td>
                </tr>
                {/* 직무 행들 (펼쳐진 상태에서만) */}
                {open && g.idxs.map((ri) => (
                  <tr key={ri} style={borderT}>
                    <td className={`${tdCls} pl-8 font-medium`} style={{ color: 'var(--fg)' }}>
                      {roles[ri].name}
                    </td>
                    {activeMonthIdxs.map((mi) => (
                      <td key={mi} className={`${tdCls} text-right`} style={{ color: amounts[mi][ri] > 0 ? 'var(--ink)' : 'var(--muted)' }}>
                        {amounts[mi][ri] > 0 ? won(amounts[mi][ri]) : '—'}
                      </td>
                    ))}
                    <td className={`${tdCls} text-right font-semibold`} style={{ color: 'var(--accent)', ...borderL }}>
                      {won(roleTotalMap.get(ri) ?? 0)}
                    </td>
                  </tr>
                ))}
              </>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

type Tab = 'lunch' | 'dinner' | 'woesing' | 'postsales'

export default function MealDetail() {
  const meal = useMealStore((s) => s)
  const { setLunch, setDinner, setWoesing, setDinnerRoleOverride } = useMealStore()
  const roles = useLaborStore((s) => s.roles)
  const sectionNames = useLaborStore((s) => s.sectionNames)
  const periodStart = useProjectStore((s) => s.periodStart)
  const periodEnd = useProjectStore((s) => s.periodEnd)
  const extras = useProjectStore((s) => s.extras)

  const [activeTab, setActiveTab] = useState<Tab>('lunch')
  const [editModal, setEditModal] = useState<Tab | null>(null)

  const projectMonths = computeProjectMonths(periodStart, periodEnd)
  const operatingMonthCount = projectMonths.length

  const lunchTotal = roles.reduce(
    (a, r) =>
      a + projectMonths.reduce((b, { year, month }) => b + r.people.reduce((c, p) => c + monthWorkP(p, year, month), 0) * meal.lunchPerDay, 0),
    0,
  )
  const dinnerRoles = roles.filter((r) => isDinnerRole(r, meal.dinnerRoleOverrides))
  const dinnerTotal = dinnerRoles.reduce(
    (a, r) =>
      a + projectMonths.reduce((b, { year, month }) => b + r.people.reduce((c, p) => c + monthWorkP(p, year, month), 0) * meal.dinnerPerDay, 0),
    0,
  )
  const woesingTotal = meal.woesing * operatingMonthCount
  const postsalesRolesList = postsalesRoles(roles)
  const postsalesTotal = postsalesMealAmount(roles, extras)
  const total = mealTotal(meal, roles, operatingMonthCount, extras)

  const tabs: { id: Tab; label: string; total: number; sub: string }[] = [
    { id: 'lunch',   label: '중식비', total: lunchTotal,   sub: `1일 ${won(meal.lunchPerDay)}` },
    { id: 'dinner',  label: '석식비', total: dinnerTotal,  sub: `1일 ${won(meal.dinnerPerDay)} · ${dinnerRoles.length}개 직무` },
    { id: 'woesing', label: '회식',   total: woesingTotal, sub: `${operatingMonthCount}개월` },
    ...(postsalesRolesList.length > 0
      ? [{ id: 'postsales' as Tab, label: '사후 인건비', total: postsalesTotal, sub: `${postsalesRolesList.length}개 직무 · 단가표 반영` }]
      : []),
  ]

  return (
    <div className="pb-8" data-c="meal">
      <DetailHeader title="식대" subtitle="중식 · 석식 · 회식" total={total} />

      <div className="px-6 pt-5 flex flex-col gap-5">

        {/* 탭 카드 */}
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}>
          {tabs.map((tab) => {
            const active = activeTab === tab.id
            return (
              <div
                key={tab.id}
                className="rounded-2xl p-5 flex flex-col gap-2 transition-all relative"
                style={{
                  background: active ? 'color-mix(in oklch, var(--accent) 8%, var(--surface))' : 'var(--surface)',
                  border: active ? '2px solid var(--accent)' : '1px solid var(--border)',
                  boxShadow: 'var(--shadow)',
                  cursor: 'pointer',
                }}
                onClick={() => setActiveTab(tab.id)}
              >
                <div className="flex items-start justify-between gap-1">
                  <div
                    className="text-[15px] font-bold uppercase tracking-widest"
                    style={{ color: active ? 'var(--accent)' : 'var(--muted)' }}
                  >
                    {tab.label}
                  </div>
                  {tab.id !== 'woesing' && tab.id !== 'postsales' && (
                    <button
                      className="back-btn !w-6 !h-6 flex-none"
                      aria-label="단가 수정"
                      onClick={(e) => { e.stopPropagation(); setEditModal(tab.id) }}
                    >
                      <GearIcon style={{ width: 13, height: 13 }} />
                    </button>
                  )}
                </div>
                <div className="font-display text-[29px] font-bold tabular" style={{ color: 'var(--ink)' }}>
                  {won(tab.total)}
                </div>
                <div className="text-[16px]" style={{ color: 'var(--muted)' }}>{tab.sub}</div>
              </div>
            )
          })}
        </div>

        {/* 탭 상세 내용 */}
        <div
          className="rounded-2xl border p-5 flex flex-col gap-4"
          style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
        >
          {activeTab === 'lunch' && (
            <MealMatrix roles={roles} projectMonths={projectMonths} ratePerDay={meal.lunchPerDay} sectionNames={sectionNames} />
          )}

          {activeTab === 'dinner' && (
            <MealMatrix roles={dinnerRoles} projectMonths={projectMonths} ratePerDay={meal.dinnerPerDay} sectionNames={sectionNames} />
          )}

          {activeTab === 'postsales' && (
            <div className="flex flex-col gap-3">
              <div className="text-[15px]" style={{ color: 'var(--muted)' }}>
                사후(postsales) 사용기간으로 설정된 직무는 인건비에서 0원 처리되고, 단가표 금액이 여기 식대로 전환되어 반영됩니다.
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>직무</th>
                    <th style={{ textAlign: 'right' }}>일 단가</th>
                    <th style={{ textAlign: 'right' }}>일수</th>
                    <th style={{ textAlign: 'right', minWidth: 120 }}>금액</th>
                  </tr>
                </thead>
                <tbody>
                  {postsalesRolesList.map((r, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 600 }}>{r.name}</td>
                      <td className="num">{won(r.daily)}</td>
                      <td className="num">{roleTotalDays(r, extras)}일</td>
                      <td className="num" style={{ color: 'var(--accent)', fontWeight: 700 }}>
                        {won(roleUnitPriceValue(r, extras))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex items-center justify-between px-1">
                <span className="text-[18px]" style={{ color: 'var(--muted)' }}>합계</span>
                <span className="font-display text-[27px] font-bold tabular" style={{ color: 'var(--ink)' }}>
                  {won(postsalesTotal)}
                </span>
              </div>
            </div>
          )}

          {activeTab === 'woesing' && (
            <div className="flex flex-col gap-4">
              <div
                className="rounded-xl border p-3 flex items-center justify-between"
                style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}
              >
                <span className="text-[18px]" style={{ color: 'var(--muted)' }}>1회 단가</span>
                <div className="flex items-center gap-2">
                  <NumInput value={meal.woesing} onCommit={setWoesing} />
                  <span className="text-[17px]" style={{ color: 'var(--muted)' }}>원</span>
                </div>
              </div>
              <div className="flex items-center justify-between px-1">
                <span className="text-[20px]" style={{ color: 'var(--muted)' }}>
                  {operatingMonthCount}개월 × {won(meal.woesing)}
                </span>
                <span className="font-display text-[31px] font-bold tabular" style={{ color: 'var(--ink)' }}>
                  {won(woesingTotal)}
                </span>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* 중식비 단가 수정 모달 */}
      <Modal
        open={editModal === 'lunch'}
        onClose={() => setEditModal(null)}
        title="중식비 단가"
        width={340}
      >
        <div className="flex flex-col gap-4 pt-2">
          <div className="flex items-center justify-between">
            <span className="text-[19px]" style={{ color: 'var(--muted)' }}>1인 1일 단가</span>
            <div className="flex items-center gap-2">
              <NumInput value={meal.lunchPerDay} onCommit={setLunch} />
              <span className="text-[18px]" style={{ color: 'var(--muted)' }}>원</span>
            </div>
          </div>
          <div className="flex justify-end">
            <button
              onClick={() => setEditModal(null)}
              style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 10, padding: '8px 20px', fontWeight: 700, fontSize: 16, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              확인
            </button>
          </div>
        </div>
      </Modal>

      {/* 석식비 단가 + 포함 직무 수정 모달 */}
      <Modal
        open={editModal === 'dinner'}
        onClose={() => setEditModal(null)}
        title="석식비 단가"
        width={400}
      >
        <div className="flex flex-col gap-4 pt-2">
          <div className="flex items-center justify-between">
            <span className="text-[19px]" style={{ color: 'var(--muted)' }}>1인 1일 단가</span>
            <div className="flex items-center gap-2">
              <NumInput value={meal.dinnerPerDay} onCommit={setDinner} />
              <span className="text-[18px]" style={{ color: 'var(--muted)' }}>원</span>
            </div>
          </div>
          <div
            className="rounded-xl border p-3"
            style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}
          >
            <div className="text-[15px] font-bold uppercase tracking-wider mb-2.5" style={{ color: 'var(--muted)' }}>
              포함 직무
            </div>
            <div className="flex flex-wrap gap-2">
              {roles.map((r, i) => {
                const included = isDinnerRole(r, meal.dinnerRoleOverrides)
                return (
                  <label
                    key={i}
                    className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 cursor-pointer text-[17px] select-none"
                    style={{
                      background: included ? 'color-mix(in oklch, var(--accent) 12%, transparent)' : 'var(--surface)',
                      border: included ? '1px solid var(--accent)' : '1px solid var(--border)',
                      color: included ? 'var(--accent)' : 'var(--muted)',
                      fontWeight: included ? 700 : 400,
                    }}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={included}
                      onChange={(e) => setDinnerRoleOverride(r.name, e.target.checked)}
                    />
                    {r.name}
                  </label>
                )
              })}
            </div>
          </div>
          <div className="flex justify-end">
            <button
              onClick={() => setEditModal(null)}
              style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 10, padding: '8px 20px', fontWeight: 700, fontSize: 16, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              확인
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
