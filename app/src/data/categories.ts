import type { ComponentType, SVGProps } from 'react'
import { LaborIcon, MealIcon, AdIcon, OpIcon, EtcIcon } from '../components/icons'

export type CategoryId = 'labor' | 'meal' | 'ad' | 'op' | 'etc'

export interface CategoryMeta {
  id: CategoryId
  order: number // 01..05 badge
  name: string
  note: string
  Icon: ComponentType<SVGProps<SVGSVGElement>>
}

export const CATEGORIES: CategoryMeta[] = [
  { id: 'labor', order: 1, name: '인건비', note: '12개 직무 / 근무일 연동', Icon: LaborIcon },
  { id: 'meal', order: 2, name: '식대', note: '근무일 자동 연동', Icon: MealIcon },
  { id: 'ad', order: 3, name: '광고비', note: '6개 집행 항목', Icon: AdIcon },
  { id: 'op', order: 4, name: '운영비', note: '사무실·장비·교통', Icon: OpIcon },
  { id: 'etc', order: 5, name: '기타비', note: '예비비 포함', Icon: EtcIcon },
]

export const categoryById = (id: CategoryId): CategoryMeta =>
  CATEGORIES.find((c) => c.id === id)!
