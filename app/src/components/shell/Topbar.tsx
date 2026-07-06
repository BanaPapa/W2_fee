import { BackArrow, PeriodIcon, TargetIcon, TrendIcon, GearIcon } from '../icons'
import { useUIStore } from '../../store/uiStore'

interface Props {
  mode: 'grid' | 'split'
  onBack: () => void
}

export default function Topbar({ mode, onBack }: Props) {
  const openModal = useUIStore((s) => s.openModal)
  const split = mode === 'split'

  return (
    <header className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-2.5 text-[22px] font-bold tracking-[-.01em]">
        {split && (
          <button className="back-btn" aria-label="종합 현황으로 돌아가기" onClick={onBack}>
            <BackArrow />
          </button>
        )}
        <span className="brand-mark" />
        Easy Commission
      </div>
      <nav className="flex items-center gap-2" aria-label="도구">
        <button className="tbtn" onClick={() => openModal('period')}>
          <PeriodIcon />
          <span className="max-[720px]:hidden">분양 기간</span>
        </button>
        <button className="tbtn" onClick={() => openModal('target')}>
          <TargetIcon />
          <span className="max-[720px]:hidden">목표분양률</span>
        </button>
        <button className="tbtn" onClick={() => openModal('trend')}>
          <TrendIcon />
          <span className="max-[720px]:hidden">월별 비용</span>
        </button>
        <button className="tbtn icononly" aria-label="설정 메뉴" onClick={() => openModal('settings')}>
          <GearIcon />
        </button>
      </nav>
    </header>
  )
}
