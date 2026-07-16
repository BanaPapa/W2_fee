import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { initAuth } from './store/authStore'
import AuthGate from './components/auth/AuthGate'
import './store/themeStore' // applies persisted data-theme on load (로그인 화면에도 적용)
import './index.css'
import App from './App.tsx'

// 인증 상태 구독 시작. 데이터 로딩(RTDB read)은 로그인 + 역할 확인 이후 authStore가 수행한다.
initAuth()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthGate>
      <App />
    </AuthGate>
  </StrictMode>,
)
