import Modal from '../ui/Modal'
import { useProjectStore } from '../../store/projectStore'
import { useUIStore } from '../../store/uiStore'
import { useThemeStore, THEMES } from '../../store/themeStore'

export default function SettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const project = useProjectStore((s) => s.project)
  const openModal = useUIStore((s) => s.openModal)
  const theme = useThemeStore((s) => s.theme)
  const setTheme = useThemeStore((s) => s.setTheme)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="설정"
      sub={`${project.title} · ${project.pm}`}
      width={320}
      className="!p-4"
    >
      <div className="mt-1.5 flex flex-col">
        <div className="menu-sec-hd">테마</div>
        <div className="theme-grid">
          {THEMES.map((t) => (
            <button
              key={t.id}
              className={`theme-swatch${theme === t.id ? ' on' : ''}${t.available ? '' : ' disabled'}`}
              disabled={!t.available}
              onClick={() => t.available && setTheme(t.id)}
            >
              {!t.available && <span className="soon">준비 중</span>}
              <div className="preview" style={{ background: t.preview }} />
              <div className="tname">{t.name}</div>
              <div className="tnote">{t.note}</div>
            </button>
          ))}
        </div>
        <div className="menu-sep" />
        <div className="menu-sec-hd">프로젝트</div>
        <button
          className="menu-item"
          onClick={() => {
            onClose()
            openModal('period')
          }}
        >
          분양 기간 · 단계
        </button>
        <button className="menu-item" onClick={() => { onClose(); openModal('trend') }}>
          월별 비용 추이
        </button>
        <div className="menu-sep" />
        <div className="menu-sec-hd">카드</div>
        <a className="menu-item" href="#labor" onClick={onClose}>인건비</a>
        <a className="menu-item" href="#meal" onClick={onClose}>식대</a>
        <a className="menu-item" href="#ad" onClick={onClose}>광고비</a>
        <a className="menu-item" href="#op" onClick={onClose}>운영비</a>
        <a className="menu-item" href="#etc" onClick={onClose}>기타비</a>
      </div>
    </Modal>
  )
}
