import type { ComponentType, SVGProps } from 'react'
import { FeeIcon, LaborIcon, MealIcon, AdIcon, OpIcon, EtcIcon } from '../components/icons'

/** 6개 고정 카드. 사용자가 추가하는 카드는 `custom_<id>` 형태의 별도 문자열 id를 쓴다. */
export type CategoryId = 'fee' | 'labor' | 'meal' | 'ad' | 'op' | 'etc'

export interface CategoryMeta {
  /** 고정 카드는 CategoryId, 사용자 추가 카드는 임의의 문자열(`custom_...`) */
  id: string
  order: number // 01..06 badge
  name: string
  note: string
  Icon: ComponentType<SVGProps<SVGSVGElement>>
}

export const CATEGORIES: CategoryMeta[] = [
  { id: 'fee', order: 1, name: '조직수수료·MGM', note: '목표분양률 연동', Icon: FeeIcon },
  { id: 'labor', order: 2, name: '인건비', note: '12개 직무 / 근무일 연동', Icon: LaborIcon },
  { id: 'meal', order: 3, name: '식대', note: '근무일 자동 연동', Icon: MealIcon },
  { id: 'ad', order: 4, name: '광고비', note: '6개 집행 항목', Icon: AdIcon },
  { id: 'op', order: 5, name: '운영비', note: '사무실·장비·교통', Icon: OpIcon },
  { id: 'etc', order: 6, name: '기타비', note: '예비비 포함', Icon: EtcIcon },
]

export const categoryById = (id: CategoryId): CategoryMeta =>
  CATEGORIES.find((c) => c.id === id)!
