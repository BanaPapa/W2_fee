import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence } from 'motion/react'
import Topbar from './Topbar'
import Overview, { MetaStrip } from './Overview'
import CardRail from './CardRail'
import DetailPanel from './DetailPanel'
import { CATEGORIES } from '../../data/categories'
import { useCustomCardsStore } from '../../store/customCardsStore'

const STAGGER_MS = 60
const MOVE_MS = 520

export default function AppShell() {
  const [mode, setMode] = useState<'grid' | 'split'>('grid')
  const [active, setActive] = useState<string | null>(null)
  const [orderAnchor, setOrderAnchor] = useState<string | null>(null)
  const [flipDir, setFlipDir] = useState<1 | -1>(1)
  const [flipNonce, setFlipNonce] = useState(0)
  const [panelReady, setPanelReady] = useState(false)
  const [transitioning, setTransitioning] = useState(false)
  const [navWidth, setNavWidth] = useState(336) // 280 * 1.2

  // 고정 카드 6개 + 사용자가 추가한 카드 — 애니메이션 스태거 타이밍과 해시 인식은
  // 카드 개수가 늘어나도(카드 추가) 항상 맞아야 하므로 매번 다시 계산한다.
  const customCards = useCustomCardsStore((s) => s.cards)
  const allIds = useMemo(() => [...CATEGORIES.map((c) => c.id), ...customCards.map((c) => c.id)], [customCards])
  const isCategory = useCallback((h: string): boolean => allIds.includes(h), [allIds])
  const panelReadyMs = STAGGER_MS * (allIds.length - 1) + MOVE_MS
  const transitionMs = panelReadyMs + 220

  const handleDragStart = (e: React.MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = navWidth
    const onMove = (ev: MouseEvent) => {
      setNavWidth(Math.max(180, Math.min(560, startWidth + (ev.clientX - startX))))
    }
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  const reduceMotion = useRef(
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  ).current
  const readyTimer = useRef<number | undefined>(undefined)
  const transTimer = useRef<number | undefined>(undefined)
  const internalHash = useRef(false)

  const enter = useCallback(
    (id: string, updateHash = true) => {
      window.clearTimeout(readyTimer.current)
      window.clearTimeout(transTimer.current)
      setActive(id)
      setOrderAnchor(id)
      setFlipDir(1)
      setFlipNonce((n) => n + 1)
      setMode('split')
      setPanelReady(false)
      setTransitioning(true)
      readyTimer.current = window.setTimeout(
        () => setPanelReady(true),
        reduceMotion ? 0 : panelReadyMs,
      )
      transTimer.current = window.setTimeout(
        () => setTransitioning(false),
        reduceMotion ? 0 : transitionMs,
      )
      if (updateHash && window.location.hash !== '#' + id) {
        internalHash.current = true
        window.location.hash = id
      }
    },
    [reduceMotion, panelReadyMs, transitionMs],
  )

  const exit = useCallback(
    (updateHash = true) => {
      window.clearTimeout(readyTimer.current)
      window.clearTimeout(transTimer.current)
      setFlipDir(-1)
      setFlipNonce((n) => n + 1)
      setPanelReady(false)
      setActive(null)
      setMode('grid')
      setTransitioning(true)
      transTimer.current = window.setTimeout(
        () => setTransitioning(false),
        reduceMotion ? 0 : transitionMs,
      )
      if (updateHash && window.location.hash) {
        internalHash.current = true
        window.location.hash = ''
        history.replaceState(null, '', window.location.pathname + window.location.search)
      }
    },
    [reduceMotion, transitionMs],
  )

  // sync from URL hash (browser back/forward, deep links)
  useEffect(() => {
    const sync = () => {
      if (internalHash.current) {
        internalHash.current = false
        return
      }
      const h = window.location.hash.replace(/^#/, '')
      if (isCategory(h)) enter(h, false)
      else exit(false)
    }
    sync()
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [enter, exit, isCategory])

  const split = mode === 'split'

  return (
    <div
      className={
        split
          ? 'mx-auto w-full h-screen px-5 pt-4 pb-5 flex flex-col overflow-hidden'
          : 'mx-auto w-full max-w-[2200px] min-h-screen px-[clamp(20px,4vw,90px)] pt-6 pb-8 flex flex-col'
      }
    >
      {/* aurora background — fixed mesh + floating colour blobs */}
      <div className="aurora-bg" aria-hidden />
      <div className="aurora-blob b1" aria-hidden />
      <div className="aurora-blob b2" aria-hidden />
      <div className="aurora-blob b3" aria-hidden />

      <h1 className="sr-only">강남 리버파크 분양 제안 종합 현황</h1>
      <Topbar mode={mode} onBack={() => exit(true)} />
      {!split && <MetaStrip />}

      {/* SINGLE persistent tree — only the layout CSS changes between modes so
          motion `layout` can animate the cards flying grid <-> rail. */}
      <main
        className={
          split
            ? 'grid gap-x-5 gap-y-3.5 pt-3 min-h-0 items-stretch'
            : 'flex-1 flex flex-col justify-center pt-2 pb-[7vh]'
        }
        style={
          split
            ? {
                gridTemplateColumns: `${navWidth}px 8px minmax(0,1fr)`,
                gridTemplateRows: 'auto minmax(0,1fr)',
                height: 'calc(100vh - 72px)',
              }
            : undefined
        }
      >
        <div className={split ? 'col-start-1 row-start-1' : ''}>
          <Overview mode={mode} />
        </div>

        <div className={split ? 'col-start-1 row-start-2 min-h-0' : 'w-full mt-[clamp(72px,12vh,170px)]'}>
          <CardRail
            mode={mode}
            active={active}
            orderAnchor={orderAnchor}
            flipDir={flipDir}
            flipNonce={flipNonce}
            transitioning={transitioning}
            reduceMotion={reduceMotion}
            onSelect={(id) => enter(id)}
          />
        </div>

        {/* 드래그 리사이즈 핸들 */}
        {split && (
          <div
            className="col-start-2 row-start-1 row-span-2 flex items-stretch justify-center cursor-col-resize group"
            onMouseDown={handleDragStart}
          >
            <div
              className="w-[3px] rounded-full transition-colors"
              style={{ background: 'var(--border)' }}
            />
          </div>
        )}

        <div className={split ? 'col-start-3 row-start-1 row-span-2 min-h-0' : 'hidden'}>
          <AnimatePresence>
            {active && split && (
              <DetailPanel key={active} active={active} ready={panelReady} reduceMotion={reduceMotion} />
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  )
}
