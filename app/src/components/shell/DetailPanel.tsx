import { motion } from 'motion/react'
import type { CategoryId } from '../../data/categories'
import FeeDetail from '../details/FeeDetail'
import LaborDetail from '../details/LaborDetail'
import MealDetail from '../details/MealDetail'
import AdvertisingDetail from '../details/AdvertisingDetail'
import OperatingDetail from '../details/OperatingDetail'
import MiscellaneousDetail from '../details/MiscellaneousDetail'

const MAP: Record<CategoryId, () => React.JSX.Element> = {
  fee: FeeDetail,
  labor: LaborDetail,
  meal: MealDetail,
  ad: AdvertisingDetail,
  op: OperatingDetail,
  etc: MiscellaneousDetail,
}

interface Props {
  active: CategoryId
  ready: boolean
  reduceMotion: boolean
}

export default function DetailPanel({ active, ready, reduceMotion }: Props) {
  const Detail = MAP[active]
  return (
    <motion.div
      className="detail-panel"
      initial={reduceMotion ? false : { opacity: 0, x: 28, scale: 0.985 }}
      animate={
        ready
          ? { opacity: 1, x: 0, scale: 1 }
          : reduceMotion
            ? { opacity: 1, x: 0, scale: 1 }
            : { opacity: 0, x: 28, scale: 0.985 }
      }
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 24, scale: 0.985 }}
      transition={{
        opacity: { duration: 0.3, ease: 'easeOut' },
        x: { duration: 0.44, ease: [0.22, 1, 0.36, 1] },
        scale: { duration: 0.44, ease: [0.22, 1, 0.36, 1] },
      }}
    >
      <div className="h-full overflow-auto" data-c={active}>
        <Detail />
      </div>
    </motion.div>
  )
}
