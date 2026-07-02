import { useEffect, useState } from 'react'
import { getHolidayPreset } from '@hyunbinseo/holidays-kr'

/** ISO date ("YYYY-MM-DD") -> holiday name(s), sourced from the official 월력요항 gazette */
export type HolidayMap = Record<string, readonly string[]>

/** Loads Korean public holidays for every year spanned by [startIso, endIso]. */
export function useKoreanHolidays(startIso: string, endIso: string): HolidayMap {
  const startYear = Number(startIso.slice(0, 4))
  const endYear = Number(endIso.slice(0, 4))
  const [map, setMap] = useState<HolidayMap>({})

  useEffect(() => {
    let cancelled = false
    const years: number[] = []
    for (let y = startYear; y <= endYear; y++) years.push(y)

    Promise.all(years.map((y) => getHolidayPreset(String(y)).catch(() => ({}) as HolidayMap)))
      .then((presets) => {
        if (cancelled) return
        setMap(Object.assign({}, ...presets))
      })

    return () => { cancelled = true }
  }, [startYear, endYear])

  return map
}
