import { Component, type ReactNode } from 'react'

/** 예상치 못한 오류가 나도 빈 화면 대신 안내와 새로고침 버튼을 보여 줍니다. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  componentDidCatch(error: Error) {
    console.error(error)
  }
  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="flex min-h-[100svh] flex-col items-center justify-center px-8 text-center" style={{ background: '#FAF9F6', color: '#514A43' }}>
        <p className="text-[15px]">화면을 불러오지 못했어요.</p>
        <p className="mt-2 text-[12.5px]" style={{ color: '#9C948B' }}>
          새 버전이 배포되었을 수 있어요. 새로고침해 주세요.
        </p>
        <button
          type="button"
          className="mt-6 rounded-full px-5 py-2.5 text-[13px] text-white"
          style={{ background: '#514A43' }}
          onClick={() => window.location.reload()}
        >
          새로고침
        </button>
        <p className="mt-6 max-w-[320px] break-all text-[10.5px]" style={{ color: '#C2BAB1' }}>
          {this.state.error.message}
        </p>
      </div>
    )
  }
}
