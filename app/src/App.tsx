import AppShell from './components/shell/AppShell'
import PeriodStageModal from './components/modals/PeriodStageModal'
import TargetRateModal from './components/modals/TargetRateModal'
import TrendModal from './components/modals/TrendModal'
import SettingsSheet from './components/modals/SettingsSheet'
import { useUIStore } from './store/uiStore'
import { useAuthStore } from './store/authStore'
import './store/themeStore' // applies persisted data-theme on load

export default function App() {
  const { modal, closeModal } = useUIStore()
  const isViewer = useAuthStore((s) => s.role === 'viewer')
  return (
    <>
      {isViewer && (
        <div
          style={{
            position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 40,
            background: 'var(--surface-2)', color: 'var(--fg)', border: '1px solid var(--border)',
            borderRadius: 999, padding: '7px 16px', fontSize: 13.5, fontWeight: 700,
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)', display: 'flex', alignItems: 'center', gap: 7,
          }}
        >
          <span aria-hidden>🔒</span> 읽기 전용 (열람자) · 변경은 저장되지 않습니다
        </div>
      )}
      <AppShell />
      <PeriodStageModal open={modal === 'period'} onClose={closeModal} />
      <TargetRateModal open={modal === 'target'} onClose={closeModal} />
      <TrendModal open={modal === 'trend'} onClose={closeModal} />
      <SettingsSheet open={modal === 'settings'} onClose={closeModal} />
    </>
  )
}
