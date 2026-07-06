import AppShell from './components/shell/AppShell'
import PeriodStageModal from './components/modals/PeriodStageModal'
import TargetRateModal from './components/modals/TargetRateModal'
import TrendModal from './components/modals/TrendModal'
import SettingsSheet from './components/modals/SettingsSheet'
import { useUIStore } from './store/uiStore'
import './store/themeStore' // applies persisted data-theme on load

export default function App() {
  const { modal, closeModal } = useUIStore()
  return (
    <>
      <AppShell />
      <PeriodStageModal open={modal === 'period'} onClose={closeModal} />
      <TargetRateModal open={modal === 'target'} onClose={closeModal} />
      <TrendModal open={modal === 'trend'} onClose={closeModal} />
      <SettingsSheet open={modal === 'settings'} onClose={closeModal} />
    </>
  )
}
