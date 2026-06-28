import { LayoutGroup } from 'motion/react'
import CategoryCard from './CategoryCard'
import { CATEGORIES, type CategoryId } from '../../data/categories'
import { useTotals } from '../../store/totals'

interface Props {
  mode: 'grid' | 'split'
  active: CategoryId | null
  orderAnchor: CategoryId | null
  flipDir: 1 | -1
  flipNonce: number
  transitioning: boolean
  reduceMotion: boolean
  onSelect: (id: CategoryId) => void
}

export default function CardRail({
  mode,
  active,
  orderAnchor,
  flipDir,
  flipNonce,
  transitioning,
  reduceMotion,
  onSelect,
}: Props) {
  const { byId } = useTotals()
  const split = mode === 'split'

  const anchorIdx = Math.max(
    CATEGORIES.findIndex((c) => c.id === (orderAnchor ?? CATEGORIES[0].id)),
    0,
  )
  const n = CATEGORIES.length
  const orderOf = (i: number) => (i >= anchorIdx ? i - anchorIdx : n - anchorIdx + i)

  return (
    <section
      className={
        split
          ? `flex flex-col gap-3 min-h-0 pr-1 py-2 ${transitioning ? 'overflow-visible' : 'overflow-y-auto'}`
          : 'grid gap-5 justify-items-center w-full'
      }
      style={split ? undefined : { gridTemplateColumns: 'repeat(5, minmax(0,1fr))' }}
      aria-label="비용 카테고리"
    >
      <LayoutGroup>
        {CATEGORIES.map((meta, i) => (
          <CategoryCard
            key={meta.id}
            meta={meta}
            mode={mode}
            active={active === meta.id}
            order={orderOf(i)}
            flipDir={flipDir}
            flipNonce={flipNonce}
            amount={byId[meta.id]}
            reduceMotion={reduceMotion}
            onSelect={onSelect}
          />
        ))}
      </LayoutGroup>
    </section>
  )
}
