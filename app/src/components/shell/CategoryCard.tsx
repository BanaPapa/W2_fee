import { motion } from 'motion/react'
import type { CategoryMeta } from '../../data/categories'
import { won } from '../../lib/format'

interface Props {
  meta: CategoryMeta
  mode: 'grid' | 'split'
  active: boolean
  order: number
  flipDir: 1 | -1
  flipNonce: number
  amount: number
  reduceMotion: boolean
  onSelect: (id: CategoryMeta['id']) => void
}

const STAGGER = 0.06
const FLIP_DUR = 0.58

export default function CategoryCard({
  meta,
  mode,
  active,
  order,
  flipDir,
  flipNonce,
  amount,
  reduceMotion,
  onSelect,
}: Props) {
  const { Icon } = meta
  const split = mode === 'split'

  // single-face rotateY swing — ported from the `railFlip` keyframe in index.html
  const flipKeyframes = flipDir === 1 ? [0, 90, -6, 0] : [0, -90, 6, 0]

  return (
    <motion.div
      layout
      data-c={meta.id}
      className={`ccard${active ? ' on' : ''}`}
      onClick={() => onSelect(meta.id)}
      role="button"
      tabIndex={0}
      aria-label={`${meta.name} 상세 열기`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect(meta.id)
        }
      }}
      transition={{
        layout: reduceMotion
          ? { duration: 0 }
          : { type: 'spring', stiffness: 280, damping: 32, delay: order * STAGGER },
      }}
      style={{
        perspective: 1400,
        zIndex: 50 - order,
        ...(split ? { height: 78 } : { width: '100%', maxWidth: 307 }),
      }}
    >
      <motion.div
        key={`${mode}-${flipNonce}`}
        className={split ? 'rail-face' : 'card-face'}
        style={split ? { height: '100%' } : { aspectRatio: '5 / 7' }}
        initial={false}
        animate={reduceMotion || flipNonce === 0 ? {} : { rotateY: flipKeyframes }}
        transition={{
          duration: FLIP_DUR,
          times: [0, 0.4, 0.72, 1],
          ease: [0.25, 0.46, 0.45, 0.94],
          delay: order * STAGGER,
        }}
      >
        <div className="emblem" aria-hidden>
          <Icon />
        </div>
        <div className="cmid">
          <div className="cname">{meta.name}</div>
          {!split && <div className="cnote">{meta.note}</div>}
        </div>
        <div className="amt tabular">{won(amount)}</div>
      </motion.div>
    </motion.div>
  )
}
