import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import './index.css'
import { DEFAULT_SLUG } from './lib/defaults'
import InvitePage from './invite/InvitePage'
import { ErrorBoundary } from './ErrorBoundary'

/**
 * 새로 배포되면 화면 파일 이름이 바뀝니다. 예전 화면을 열어 둔 상태라면 없는 파일을 찾느라 빈 화면이 되므로,
 * 파일을 못 불러오면 한 번 자동으로 새로고침합니다.
 */
function lazyWithReload<T extends React.ComponentType>(load: () => Promise<{ default: T }>) {
  return lazy(async () => {
    try {
      const m = await load()
      try {
        sessionStorage.removeItem('chunk-reloaded')
      } catch {
        /* ignore */
      }
      return m
    } catch (e) {
      let reloaded = false
      try {
        reloaded = sessionStorage.getItem('chunk-reloaded') === '1'
        sessionStorage.setItem('chunk-reloaded', '1')
      } catch {
        /* ignore */
      }
      if (!reloaded) {
        window.location.reload()
        return new Promise<{ default: T }>(() => {})
      }
      throw e
    }
  })
}

// 관리자 코드는 하객에게 내려가지 않도록 분리 로드
const AdminApp = lazyWithReload(() => import('./admin/AdminApp'))
const PreviewPage = lazyWithReload(() => import('./invite/PreviewPage'))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ErrorBoundary>
      <Suspense fallback={<div className="min-h-[100svh]" style={{ background: 'var(--c-bg)' }} />}>
        <Routes>
          <Route path="/" element={<InvitePage />} />
          <Route path="/invite/:slug" element={<InvitePage />} />
          <Route path="/admin/preview" element={<PreviewPage />} />
          <Route path="/admin/*" element={<AdminApp />} />
          <Route path="*" element={<Navigate to={`/invite/${DEFAULT_SLUG}`} replace />} />
        </Routes>
      </Suspense>
      </ErrorBoundary>
    </BrowserRouter>
  </StrictMode>,
)
