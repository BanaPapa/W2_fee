// Work-schedule calculations ported from labor.html.
// A "person" has an independent work window (s..e), an optional per-month
// pattern, and per-day overrides.

export const YEAR = 2026

/** [monthIndex0, day] */
export type MD = [number, number]

export interface Person {
  s: MD
  e: MD
  /** per-month pattern: 7 = every day, 6 = 6-day (off Wed, default), 5 = weekdays only */
  pat?: Record<number, number>
  /** per-day overrides keyed by "month-day" -> worked? */
  ov?: Record<string, boolean>
  /** per-extra-slot day overrides keyed by extra index */
  extraOv?: Record<number, number>
}

export const D = ([m, d]: MD): Date => new Date(YEAR, m, d)

export const patOf = (p: Person, m: number): number =>
  p.pat && p.pat[m] != null ? p.pat[m] : 6

export const dayWorks = (weekday: number, pat: number): boolean => {
  if (pat === 7) return true
  if (pat === 5) return weekday >= 1 && weekday <= 5
  return weekday !== 3 // 6-day: off Wednesday
}

export const isWorkP = (date: Date, p: Person): boolean => {
  if (date < D(p.s) || date > D(p.e)) return false
  const key = date.getMonth() + '-' + date.getDate()
  if (p.ov && key in p.ov) return p.ov[key]
  return dayWorks(date.getDay(), patOf(p, date.getMonth()))
}

/** planned paid days across the person's whole window (honours per-day overrides) */
export const ppdP = (p: Person): number => {
  let n = 0
  const d = new Date(D(p.s))
  const end = D(p.e)
  while (d <= end) {
    if (isWorkP(d, p)) n++
    d.setDate(d.getDate() + 1)
  }
  return n
}

/** working days within a given month, honouring overrides */
export const monthWorkP = (p: Person, m: number): number => {
  let n = 0
  const dim = new Date(YEAR, m + 1, 0).getDate()
  for (let d = 1; d <= dim; d++) {
    if (isWorkP(new Date(YEAR, m, d), p)) n++
  }
  return n
}

export const monthsOf = (p: Person): number[] => {
  const a: number[] = []
  for (let m = p.s[0]; m <= p.e[0]; m++) a.push(m)
  return a
}

const DAY_MS = 86400000

/**
 * 달력에서 특정 날짜를 클릭했을 때 적용할 patch를 계산한다.
 * - 근무기간(s~e) 안의 날짜: 그 날의 근무 여부만 뒤집는다.
 * - 근무기간 밖의 날짜: 그 날짜까지 기간을 넓히되, 새로 포함되는 다른 날짜는
 *   전부 비근무로 두고 클릭한 날짜만 근무로 표시한다.
 */
export function toggleWorkDay(p: Person, month: number, day: number): Partial<Person> {
  const date = new Date(YEAR, month, day)
  const key = `${month}-${day}`
  const inRange = date >= D(p.s) && date <= D(p.e)

  if (inRange) {
    const currently = isWorkP(date, p)
    return { ov: { ...(p.ov ?? {}), [key]: !currently } }
  }

  const sMs = D(p.s).getTime()
  const eMs = D(p.e).getTime()
  const dateMs = date.getTime()
  const newOv: Record<string, boolean> = { ...(p.ov ?? {}) }

  if (dateMs < sMs) {
    for (let ms = dateMs; ms < sMs; ms += DAY_MS) {
      const dd = new Date(ms)
      newOv[`${dd.getMonth()}-${dd.getDate()}`] = false
    }
    newOv[key] = true
    return { s: [month, day], ov: newOv }
  }

  for (let ms = eMs + DAY_MS; ms <= dateMs; ms += DAY_MS) {
    const dd = new Date(ms)
    newOv[`${dd.getMonth()}-${dd.getDate()}`] = false
  }
  newOv[key] = true
  return { e: [month, day], ov: newOv }
}

export const DOW = ['일', '월', '화', '수', '목', '금', '토']

/**
 * 프로젝트 기간에 해당하는 월(0-indexed) 목록.
 * Person 스케줄이 YEAR 한 해만 표현 가능하므로, periodEnd가 다음 해로 넘어가면
 * 그 해 12월(index 11)까지만 잘라서 보여준다.
 */
export function projectMonths(periodStart: string, periodEnd: string): number[] {
  const s = new Date(periodStart)
  const e = new Date(periodEnd)
  const sm = s.getMonth()
  const em = s.getFullYear() === e.getFullYear() ? e.getMonth() : 11
  const months: number[] = []
  for (let m = sm; m <= em; m++) months.push(m)
  return months
}
