// 주소(또는 장소 이름)만으로 휴대폰의 네이버지도 · 카카오맵 · 티맵 앱을 여는 길찾기 링크.
// 앱이 없으면 웹 지도(티맵은 앱 설치 페이지)로 넘어갑니다. 지도 키나 좌표가 없어도 동작해요.

export type MapApp = 'naver' | 'kakao' | 'tmap'

export interface Place {
  name: string // 장소 이름 (예: 봄빛 웨딩홀)
  address: string // 도로명 주소
  lat?: number | null
  lng?: number | null
}

const isAndroid = () => /android/i.test(navigator.userAgent)
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
export const isMobile = () => isAndroid() || isIOS()

function hasCoords(p: Place): p is Place & { lat: number; lng: number } {
  return typeof p.lat === 'number' && typeof p.lng === 'number' && Number.isFinite(p.lat) && Number.isFinite(p.lng)
}

/** 검색어: 주소가 있으면 주소(가장 정확), 없으면 장소 이름 */
function query(p: Place) {
  return (p.address || p.name).trim()
}

export function hasPlace(p: Place) {
  return !!query(p)
}

export function mapLinks(p: Place, app: MapApp): { app: string; web: string } {
  const q = encodeURIComponent(query(p))
  const name = encodeURIComponent(p.name || p.address)
  const appname = encodeURIComponent(typeof location !== 'undefined' ? location.hostname || 'invitation' : 'invitation')
  const c = hasCoords(p)
  switch (app) {
    case 'naver':
      return {
        app: c
          ? `nmap://route/public?dlat=${p.lat}&dlng=${p.lng}&dname=${name}&appname=${appname}`
          : `nmap://search?query=${q}&appname=${appname}`,
        web: `https://map.naver.com/p/search/${q}`,
      }
    case 'kakao':
      return {
        app: c ? `kakaomap://route?ep=${p.lat},${p.lng}&by=CAR` : `kakaomap://search?q=${q}`,
        web: c ? `https://map.kakao.com/link/to/${name},${p.lat},${p.lng}` : `https://map.kakao.com/link/search/${q}`,
      }
    case 'tmap':
      return {
        app: c ? `tmap://route?goalname=${name}&goalx=${p.lng}&goaly=${p.lat}` : `tmap://search?name=${q}`,
        web: isAndroid()
          ? 'https://play.google.com/store/apps/details?id=com.skt.tmap.ku'
          : 'https://apps.apple.com/kr/app/id431589174',
      }
  }
}

/**
 * 휴대폰: 앱을 먼저 열고, 1.6초 안에 앱으로 넘어가지 않으면 웹 지도(티맵은 설치 페이지)로 이동.
 * 컴퓨터: 웹 지도를 새 탭으로 엽니다. 티맵은 휴대폰 전용이라 false 를 돌려줘요.
 */
export function openMap(p: Place, app: MapApp): boolean {
  const { app: appUrl, web } = mapLinks(p, app)
  if (!isMobile()) {
    if (app === 'tmap') return false
    window.open(web, '_blank', 'noopener')
    return true
  }
  let left = false
  const onHide = () => {
    if (document.hidden) left = true
  }
  const onBlur = () => (left = true)
  document.addEventListener('visibilitychange', onHide)
  window.addEventListener('pagehide', onBlur)
  window.addEventListener('blur', onBlur)
  const started = Date.now()
  window.location.href = appUrl
  window.setTimeout(() => {
    document.removeEventListener('visibilitychange', onHide)
    window.removeEventListener('pagehide', onBlur)
    window.removeEventListener('blur', onBlur)
    // 앱이 열렸다면 화면이 가려지거나 타이머가 크게 밀립니다
    if (!left && !document.hidden && Date.now() - started < 3000) window.location.href = web
  }, 1600)
  return true
}
