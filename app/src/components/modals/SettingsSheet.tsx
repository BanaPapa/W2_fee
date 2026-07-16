import { useState } from 'react'
import Modal from '../ui/Modal'
import { useProjectStore } from '../../store/projectStore'
import { useThemeStore, THEMES } from '../../store/themeStore'
import { useCustomCardsStore, isFixedCardId } from '../../store/customCardsStore'
import { CATEGORIES } from '../../data/categories'
import { PlusIcon, TrashIcon, GripIcon } from '../icons'
import { useAuthStore } from '../../store/authStore'
import AccountPanel from '../auth/AccountPanel'
import AdminUsersPanel from '../auth/AdminUsersPanel'

type Tab = 'design' | 'cards' | 'account' | 'users'

export default function SettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const project = useProjectStore((s) => s.project)
  const theme = useThemeStore((s) => s.theme)
  const setTheme = useThemeStore((s) => s.setTheme)

  const customCards = useCustomCardsStore((s) => s.cards)
  const itemsByCard = useCustomCardsStore((s) => s.itemsByCard)
  const cardOrder = useCustomCardsStore((s) => s.order)
  const { addCard, removeCard, reorderCard } = useCustomCardsStore()

  const role = useAuthStore((s) => s.role)
  const navItems: { id: Tab; label: string }[] = [
    { id: 'design', label: '디자인' },
    { id: 'cards', label: '카드 관리' },
    { id: 'account', label: '계정' },
    ...(role === 'admin' ? [{ id: 'users' as Tab, label: '사용자 관리' }] : []),
  ]

  const [tab, setTab] = useState<Tab>('design')
  const [newCardName, setNewCardName] = useState('')
  const [deleteCardId, setDeleteCardId] = useState<string | null>(null)
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)

  // 고정 6개 카드 + 사용자 카드를 저장된 순서(order)대로 — 고정 카드는 이름만 보여주고
  // 삭제는 못 하게 하고, 순서 변경(드래그)은 둘 다 똑같이 가능하다.
  const displayCards = cardOrder.flatMap((id) => {
    const fixed = CATEGORIES.find((c) => c.id === id)
    if (fixed) return [{ id, name: fixed.name }]
    const custom = customCards.find((c) => c.id === id)
    return custom ? [{ id, name: custom.name }] : []
  })

  const deleteCard = customCards.find((c) => c.id === deleteCardId)
  const deleteCardCount = deleteCardId ? (itemsByCard[deleteCardId] ?? []).length : 0

  // 내용이 비어 있어도 실수로 지우는 걸 막기 위해 항상 확인을 받는다
  const requestDelete = (id: string) => setDeleteCardId(id)
  const doDelete = (id: string) => {
    if (window.location.hash === '#' + id) window.location.hash = ''
    removeCard(id)
    setDeleteCardId(null)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="설정"
      sub={`${project.title} · ${project.pm}`}
      widthCss="56vw"
      heightCss="56vh"
      className="!p-5"
    >
      <div className="mt-1.5 flex-1 min-h-0 flex" style={{ gap: 20 }}>
        {/* 좌측 네비게이션 */}
        <nav className="flex flex-col gap-1 flex-none" style={{ width: 150 }}>
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              style={{
                textAlign: 'left', padding: '10px 12px', borderRadius: 10, border: 'none',
                fontWeight: 700, fontSize: 15.5, cursor: 'pointer', fontFamily: 'inherit',
                background: tab === item.id ? 'var(--accent)' : 'transparent',
                color: tab === item.id ? '#fff' : 'var(--fg)',
                transition: 'background 0.12s, color 0.12s',
              }}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {/* 우측 컨텐츠 */}
        <div className="flex-1 min-w-0 min-h-0 overflow-y-auto">
          {tab === 'design' && (
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
          )}

          {tab === 'cards' && (
            <div className="flex flex-col gap-2">
              <div className="text-[13px] mb-1" style={{ color: 'var(--muted)' }}>
                드래그로 순서를 바꿀 수 있습니다. 고정 카드는 삭제할 수 없습니다.
              </div>
              {displayCards.map((c, i) => {
                const fixed = isFixedCardId(c.id)
                return (
                  <div
                    key={c.id}
                    draggable
                    onDragStart={(e) => {
                      if ((e.target as HTMLElement).closest('button')) { e.preventDefault(); return }
                      setDragIdx(i)
                      e.dataTransfer.effectAllowed = 'move'
                    }}
                    onDragEnd={() => { setDragIdx(null); setDragOverIdx(null) }}
                    onDragOver={(e) => { if (dragIdx !== null) { e.preventDefault(); setDragOverIdx(i) } }}
                    onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverIdx(null) }}
                    onDrop={(e) => {
                      e.preventDefault()
                      if (dragIdx !== null && dragIdx !== i) reorderCard(dragIdx, i)
                      setDragIdx(null); setDragOverIdx(null)
                    }}
                    className="flex items-center gap-3"
                    style={{
                      padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface-2)',
                      opacity: dragIdx === i ? 0.4 : 1,
                      outline: dragOverIdx === i && dragIdx !== i ? '2px solid var(--accent)' : undefined,
                      outlineOffset: -1,
                      cursor: 'grab',
                    }}
                  >
                    <span className="text-[var(--muted)] inline-flex flex-none" aria-hidden>
                      <GripIcon style={{ width: 16, height: 16 }} />
                    </span>
                    <div className="flex-1 min-w-0 text-[16px] font-semibold" style={{ color: 'var(--fg)' }}>
                      {c.name}
                    </div>
                    {fixed ? (
                      <span
                        className="text-[12px] font-semibold flex-none"
                        style={{ color: 'var(--muted)', padding: '0 6px' }}
                        title="기본 제공 카드는 삭제할 수 없습니다"
                      >
                        고정
                      </span>
                    ) : (
                      <button
                        className="x"
                        style={{ width: 30, height: 30, flexShrink: 0 }}
                        aria-label={`${c.name} 카드 삭제`}
                        onClick={() => requestDelete(c.id)}
                      >
                        <TrashIcon style={{ width: 14, height: 14 }} />
                      </button>
                    )}
                  </div>
                )
              })}
              <form
                className="flex gap-2 mt-1.5"
                onSubmit={(e) => {
                  e.preventDefault()
                  const name = newCardName.trim()
                  if (!name) return
                  addCard(name)
                  setNewCardName('')
                }}
              >
                <input
                  className="field-input flex-1"
                  placeholder="새 카드 이름"
                  value={newCardName}
                  onChange={(e) => setNewCardName(e.target.value)}
                />
                <button
                  type="submit"
                  style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 10, padding: '0 16px', fontWeight: 700, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <PlusIcon style={{ width: 13, height: 13 }} /> 추가
                </button>
              </form>
            </div>
          )}

          {tab === 'account' && <AccountPanel />}

          {tab === 'users' && role === 'admin' && <AdminUsersPanel />}
        </div>
      </div>

      {/* ---- 카드 삭제 경고 (내용이 있든 없든 항상 확인) ---- */}
      <Modal open={deleteCardId !== null} onClose={() => setDeleteCardId(null)} title="카드 삭제" width={400}>
        {deleteCardId !== null && (
          <div className="flex flex-col gap-5 pt-1">
            <p className="text-[17px] text-[var(--fg)]">
              <b>'{deleteCard?.name}'</b> 카드를 삭제할까요?<br />
              <span className="text-[var(--muted)] text-[15px]">
                {deleteCardCount > 0 ? `안에 있는 ${deleteCardCount}개 항목이 모두 함께 삭제되며, ` : ''}이 작업은 되돌릴 수 없습니다.
              </span>
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setDeleteCardId(null)}
                style={{ background: 'var(--surface-2)', color: 'var(--fg)', border: 'none', borderRadius: 10, padding: '0 20px', height: 36, fontWeight: 700, fontSize: 16, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                취소
              </button>
              <button
                onClick={() => doDelete(deleteCardId)}
                style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: 10, padding: '0 20px', height: 36, fontWeight: 700, fontSize: 16, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                삭제
              </button>
            </div>
          </div>
        )}
      </Modal>
    </Modal>
  )
}
