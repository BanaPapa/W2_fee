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

/** planned paid days across the person's whole window (pattern only) */
export const ppdP = (p: Person): number => {
  let n = 0
  const d = new Date(D(p.s))
  const end = D(p.e)
  while (d <= end) {
    if (dayWorks(d.getDay(), patOf(p, d.getMonth()))) n++
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

export const DOW = ['일', '월', '화', '수', '목', '금', '토']
