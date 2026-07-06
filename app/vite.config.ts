import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // 이 머신에서 다른 프로젝트(W3_Manage 등)와 5173 포트가 겹쳐 매번 다른 포트로
  // 튕기는 걸 막기 위해, 이 프로젝트 전용 포트를 고정한다. strictPort로 겹치면
  // 조용히 다른 포트로 넘어가지 않고 바로 에러를 내서 바로 알아챌 수 있게 한다.
  server: { port: 5183, strictPort: true },
})
