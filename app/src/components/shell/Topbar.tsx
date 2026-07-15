import { BackArrow, PeriodIcon, TargetIcon, TrendIcon, GearIcon, LogoutIcon } from '../icons'
import { useUIStore } from '../../store/uiStore'
import { useAuthStore } from '../../store/authStore'
import { signOutUser } from '../../lib/firebaseAuth'

interface Props {
  mode: 'grid' | 'split'
  onBack: () => void
}

export default function Topbar({ mode, onBack }: Props) {
  const openModal = useUIStore((s) => s.openModal)
  const displayName = useAuthStore((s) => s.displayName)
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
        {displayName && (
          <span
            className="max-[860px]:hidden text-[14px] font-semibold pl-1 pr-0.5"
            style={{ color: 'var(--muted)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            title={displayName}
          >
            {displayName}
          </span>
        )}
        <button
          className="tbtn icononly"
          aria-label="로그아웃"
          title="로그아웃"
          onClick={() => signOutUser()}
        >
          <LogoutIcon />
        </button>
      </nav>
    </header>
  )
}
