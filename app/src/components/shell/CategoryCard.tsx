import { motion } from 'motion/react'
import type { CategoryMeta } from '../../data/categories'
import { won } from '../../lib/format'
import { useCountUp } from '../../lib/useCountUp'

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
  /** 우클릭으로 삭제 가능한 카드(사용자 추가 카드)에만 전달된다 */
  onDelete?: (id: CategoryMeta['id']) => void
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
  onDelete,
}: Props) {
  const { Icon } = meta
  const split = mode === 'split'
  const animatedAmount = useCountUp(amount)

  // single-face rotateY swing — ported from the `railFlip` keyframe in index.html
  const flipKeyframes = flipDir === 1 ? [0, 90, -6, 0] : [0, -90, 6, 0]

  return (
    <motion.div
      layout
      data-c={meta.id}
      className={`ccard${active ? ' on' : ''}`}
      onClick={() => onSelect(meta.id)}
      onContextMenu={onDelete ? (e) => { e.preventDefault(); onDelete(meta.id) } : undefined}
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
      whileHover={reduceMotion ? undefined : { y: split ? -3 : -8 }}
      whileTap={{ scale: 0.985 }}
      style={{
        perspective: 1400,
        zIndex: 50 - order,
        ...(split ? { height: 78 } : { width: '100%', height: '100%' }),
      }}
    >
      <motion.div
        key={`${mode}-${flipNonce}`}
        className={split ? 'rail-face' : 'card-face'}
        style={{ height: '100%' }}
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
        {/* cbody: 그리드 카드에서 제목+금액을 중앙에 묶는 래퍼 — rail(사이드) 모드에서는 display:contents로 무시된다 */}
        <div className="cbody">
          <div className="cmid">
            <div className="cname">{meta.name}</div>
            {!split && <div className="cnote">{meta.note}</div>}
          </div>
          <div className="amt tabular">{won(animatedAmount)}</div>
        </div>
      </motion.div>
    </motion.div>
  )
}
