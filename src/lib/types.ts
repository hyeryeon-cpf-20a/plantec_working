// 초대장 콘텐츠 모델 — 관리자 초안(draft)과 게시본(published)이 같은 형태로 DB(jsonb)에 저장됩니다.

export type SectionType = 'hero' | 'letter' | 'event' | 'greeting' | 'gallery' | 'text'

export type Aspect = 'original' | '1:1' | '4:5' | '3:4' | '2:3' | '3:5' | '9:16' | '4:3' | '3:2' | '16:9'

/** 이미지 참조. path 는 media 버킷 경로, url 은 외부 이미지. crop 은 비파괴 크롭(초점·확대). */
export interface ImageRef {
  path?: string
  url?: string
  width?: number
  height?: number
  focusX?: number // 0~100 (%)
  focusY?: number // 0~100 (%)
  zoom?: number // 1~3
  alt?: string
}

export type AnimationType = 'fade' | 'slide-up' | 'zoom' | 'none'

export interface SectionStyle {
  paddingTop: number // px
  paddingBottom: number // px
  align: 'left' | 'center' | 'right'
  background: 'bg' | 'bg2' | 'custom'
  customBackground?: string
  titleScale: number // 0.7~1.6
  bodyScale: number // 0.8~1.4
  textColor?: string
  fitScreen: boolean // 화면 1개 높이를 최소 높이로
  animation: { enabled: boolean; type: AnimationType; duration: number } // duration 초
}

interface SectionBase<T extends SectionType, S> {
  id: string
  type: T
  label: string // 내비게이션 표시 이름
  hidden: boolean
  style: SectionStyle
  settings: S
}

export interface GalleryPhoto {
  id: string
  image: ImageRef
  caption: string
}

export interface GallerySettings {
  eyebrow: string
  title: string
  layout: 'carousel' | 'grid' | 'slide' | 'editorial'
  carouselAspect: Aspect // 큰 사진 비율 (슬라이드+썸네일)
  columns: 2 | 3
  photos: GalleryPhoto[]
  initialCount: number // 처음 보여줄 사진 수 (나머지는 더보기)
}

export interface GreetingSettings {
  eyebrow: string // INVITATION
  title: string // 소중한 분들을 초대합니다
  body: string
  photo: ImageRef | null
  aspect: Aspect
  radius: number // 사진 모서리 둥글기(px)
  caption: string // 사진 아래 문구 (선택)
}

/** 식순 등 탭 안의 목록 한 줄 (시간 · 제목 · 설명) */
export interface ProgramItem {
  id: string
  time: string
  title: string
  desc: string
}

/**
 * 행사 상세안내의 버튼 한 칸 = 눌렀을 때 열리는 상세 페이지 하나.
 * schedule: 일시·장소·주소 + 길찾기 (날짜·주소는 자동으로 채워짐)
 * program: 아이콘 + 안내 문장 + 시간표
 * content: 제목 + 사진 + 글 (좌석배치도, 식사 안내 등)
 */
export interface EventTab {
  id: string
  kind: 'schedule' | 'program' | 'content'
  label: string // 버튼 · 상세 페이지 위 알약에 보이는 이름
  showIcon: boolean
  icon: 'calendar' | 'clock' | 'seat' | 'meal' | 'pin' | 'info'
  title: string
  image: ImageRef | null
  aspect: Aspect
  body: string
  items: ProgramItem[]
  // schedule 전용 문구
  dateLabel: string
  placeLabel: string
  addressLabel: string
  moreLabel: string
  moreText: string
}

export interface EventSettings {
  title: string
  description: string
  tabs: EventTab[]
  buttonStyle: 'mixed' | 'filled' | 'outline'
  // 일시 (비우면 ‘기본 정보’의 날짜·시간으로 자동)
  dateText: string
  timeText: string
  // 장소 · 오시는 길
  venueName: string
  address: string
  lat: number | null
  lng: number | null
  showDirections: boolean
  mapTitle: string
  mapDescription: string
  // 카드 · 맨 아래
  cardColor: string
  cardTextColor: string
  footerText: string
  footerImage: ImageRef | null
  footerColor: string
}

/** 행사 첫 화면: 배경 그림 + 브랜드 · 제목 · 부제 */
export interface HeroSettings {
  brand: string
  title: string
  subtitle: string
  bgImage: ImageRef | null
  overlay: number // 0~1, 글씨가 잘 보이게 어둡게
  brandFont: 'serif' | 'script' | 'sans' // sans = 굵은 고딕 (플랜텍 로고 스타일)
  brandImage: ImageRef | null // 로고 이미지 (넣으면 브랜드 글자 대신 표시)
  titleSize: number // rem
  height: number // 화면 높이 대비 % (상세 페이지 머리 높이도 같이 사용)
  subtitleColor: string
}

/** 초대 글 카드 (INVITATION) */
export interface LetterSettings {
  eyebrow: string
  body: string
  boxed: boolean
}

export interface TextSettings {
  eyebrow: string
  title: string
  body: string
  image: ImageRef | null
  aspect: Aspect
}

export type Section =
  | SectionBase<'gallery', GallerySettings>
  | SectionBase<'text', TextSettings>
  | SectionBase<'greeting', GreetingSettings>
  | SectionBase<'event', EventSettings>
  | SectionBase<'hero', HeroSettings>
  | SectionBase<'letter', LetterSettings>

export type SectionOf<T extends SectionType> = Extract<Section, { type: T }>
export type SettingsOf<T extends SectionType> = SectionOf<T>['settings']

export interface Theme {
  colors: {
    bg: string
    bg2: string
    text: string
    accent: string
    sage: string
    wax: string
    muted: string
  }
  fonts: {
    script: string
    serif: string
    sans: string
  }
  baseFontSize: number // px
  letterSpacing: number // em
}

export interface InvitationContent {
  schemaVersion: 1
  theme: Theme
  /** 행사 날짜·시간 (이전 코드와 맞추려고 이름은 wedding 으로 둠) */
  wedding: {
    date: string // 'YYYY-MM-DD'
    time: string // 'HH:mm'
    timezone: string // 'Asia/Seoul'
  }
  nav: {
    enabled: boolean
    position: 'right' | 'left'
    showLabels: boolean
  }
  animation: {
    enabled: boolean
    speed: number // 0.5 ~ 2 (배속)
  }
  share: {
    title: string
    description: string
    image: ImageRef | null
    kakaoJsKey: string
    buttonText: string
    /** 게시할 때 만든 링크 미리보기용 가로 사진(1200×630, 정한 위치대로 잘림) */
    ogImagePath?: string
    ogKey?: string
  }
  sections: Section[]
}

export interface PublicInvitation {
  /** 이미지·관리자가 모이는 기본 초대장 id */
  id: string
  version_id?: string
  slug: string
  content: InvitationContent
  published_at: string | null
  guestbook_enabled: boolean
  guestbook_public: boolean
  uploads_enabled: boolean
  uploads_public: boolean
  uploads_require_approval: boolean
}

/** 미리보기·실서비스에서 섹션 컴포넌트에 전달되는 실행 컨텍스트 */
export interface RuntimeFlags {
  slug: string
  invitationId: string | null
  guestbookEnabled: boolean
  guestbookPublic: boolean
  uploadsEnabled: boolean
  uploadsPublic: boolean
  uploadsRequireApproval: boolean
  preview: boolean
}
