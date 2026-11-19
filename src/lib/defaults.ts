import type { EventTab, InvitationContent, ProgramItem, Section, SectionStyle, SectionType, SettingsOf } from './types'
import { uid } from './util'

export const DEFAULT_SLUG = import.meta.env.VITE_DEFAULT_SLUG || 'event'

/** 기본 색 (남색 배경 · 흰 글씨 · 초록 포인트) */
export const PALETTE = {
  bg: '#151C5C',
  bg2: '#0F1548',
  text: '#FFFFFF',
  accent: '#6CBC96',
  sage: '#6CBC96',
  wax: '#1F3C98',
  muted: '#B7BDDF',
}

export const SECTION_META: Record<SectionType, { name: string; label: string; singleton?: boolean; fixed?: boolean }> = {
  hero: { name: 'Main · 첫 화면 (배경 그림 + 제목)', label: 'Main' },
  letter: { name: 'Invitation · 초대 글 카드', label: 'Invitation' },
  event: { name: 'Details · 행사 상세안내 + 오시는 길', label: 'Details' },
  greeting: { name: 'Photo + Text · 사진 + 글', label: 'Photo' },
  gallery: { name: 'Gallery · 사진 앨범', label: 'Gallery' },
  text: { name: 'Text · 자유 텍스트', label: 'Note' },
}

export function defaultStyle(overrides: Partial<SectionStyle> = {}): SectionStyle {
  return {
    paddingTop: 72,
    paddingBottom: 72,
    align: 'center',
    background: 'bg',
    titleScale: 1,
    bodyScale: 1,
    fitScreen: false,
    animation: { enabled: true, type: 'slide-up', duration: 0.9 },
    ...overrides,
  }
}

const prog = (time: string, title: string, desc: string): ProgramItem => ({ id: uid(), time, title, desc })

function eventTab(kind: EventTab['kind'], label: string, patch: Partial<EventTab> = {}): EventTab {
  return {
    id: uid(),
    kind,
    label,
    showIcon: kind !== 'schedule',
    icon: kind === 'program' ? 'calendar' : 'info',
    title: '',
    image: null,
    aspect: 'original',
    body: '',
    items: [],
    dateLabel: '일 시',
    placeLabel: '장 소',
    addressLabel: '주 소',
    moreLabel: '자세히보기',
    moreText: '아래의 원하시는 앱을 선택하시고 자세한 위치를 확인하세요.',
    ...patch,
  }
}

export function defaultEventTabs(): EventTab[] {
  return [
    eventTab('schedule', '일시/장소 안내'),
    eventTab('program', '식순 안내', {
      title: '준공식 진행 일정을 아래와 같이 안내드립니다.',
      items: [
        prog('09:30 ~ 10:00', '입장', '의전도우미의 안내와 함께 입장'),
        prog('10:00 ~ 10:02', '개식선언', '전문 사회자와 함께 여는 준공식 개회'),
        prog('10:02 ~ 10:05', '내빈소개', '귀한 발걸음을 해주신 여러분께 감사인사'),
        prog('10:05 ~ 10:13', '경과보고', '사업 영상 시청'),
        prog('10:13 ~ 10:23', '기념사 및 축사', '당사와 여러분들께 전하는 기념사 및 축사'),
        prog('10:23 ~ 10:30', '준공 세레모니', '성공적인 준공을 알리는 리본 커팅식'),
        prog('10:30 ~ 10:40', '기념식수', '준공을 기념하는 식수행사'),
        prog('10:40 ~', 'G6 라인 투어', '미코세라믹스 강릉 제6공장 투어'),
      ],
    }),
    eventTab('content', '좌석배치도', {
      icon: 'seat',
      title: '좌석 배치를 아래와 같이 안내드립니다.',
      body: '현장 안내요원이 자리로 안내해 드립니다.',
    }),
    eventTab('content', '식사 안내', {
      icon: 'meal',
      title: '식사를 아래와 같이 준비하였습니다.',
      body: '행사 후 오찬이 준비되어 있습니다.\n장소와 시간은 현장에서 다시 안내해 드립니다.',
    }),
  ]
}

export function defaultSettings<T extends SectionType>(type: T): SettingsOf<T> {
  const map: { [K in SectionType]: () => SettingsOf<K> } = {
    hero: () => ({
      brand: 'MiCo Ceramics',
      title: 'G6\nCompletion Ceremony',
      subtitle: '2026 미코세라믹스 강릉 제 6공장 준공식',
      bgImage: { url: '/samples/event-hero.svg', width: 1200, height: 900, focusX: 50, focusY: 50, zoom: 1 },
      overlay: 0,
      brandFont: 'serif',
      titleSize: 1.95,
      height: 56,
      subtitleColor: '#7FCB9E',
    }),
    letter: () => ({
      eyebrow: 'INVITATION',
      body:
        '결실의 계절 10월, 청명한 가을 하늘 아래\n늘 건강과 행복이 가득하시기를 기원합니다.\n\n그동안 보내주신 아낌없는 격려와 성원 덕분에,\n저희 미코세라믹스가 강릉 제6공장을 준공하게 되었습니다.\n\n이를 기념하는 뜻깊은 자리를 마련하였으니,\n바쁘시더라도 귀한 발걸음하시어\n자리를 빛내주시면 감사하겠습니다.',
      boxed: true,
    }),
    event: () => ({
      title: '행사 상세 안내',
      description: '일시, 장소, 식순 등 준공식에 대한 자세한 정보를 안내드립니다.',
      tabs: defaultEventTabs(),
      buttonStyle: 'mixed',
      dateText: '',
      timeText: '오전 10시 ~ 오전 11시',
      venueName: '미코세라믹스 강릉 제 6공장',
      address: '',
      lat: null,
      lng: null,
      showDirections: true,
      mapTitle: '오시는 길',
      mapDescription: '원하시는 맵을 선택하시면 길안내가 시작됩니다.',
      cardColor: '#FFFFFF',
      cardTextColor: '#1A1A1A',
      footerText: 'MiCo Ceramics',
      footerImage: null,
      footerColor: '#1F3C98',
    }),
    gallery: () => ({
      eyebrow: 'GALLERY',
      title: '사진으로 보는 현장',
      layout: 'carousel',
      carouselAspect: '4:5',
      columns: 3,
      initialCount: 9,
      photos: [],
    }),
    greeting: () => ({
      eyebrow: 'INVITATION',
      title: '소중한 분들을 초대합니다',
      body: '이곳에 초대 글을 적어 주세요.',
      photo: null,
      aspect: '4:5',
      radius: 22,
      caption: '',
    }),
    text: () => ({
      eyebrow: 'NOTICE',
      title: '알려드립니다',
      body: '이곳에 자유롭게 내용을 작성해 주세요.',
      image: null,
      aspect: '4:5',
    }),
  }
  return map[type]() as SettingsOf<T>
}

export function createSection<T extends SectionType>(type: T, label?: string): Section {
  const styleByType: Partial<Record<SectionType, Partial<SectionStyle>>> = {
    hero: { paddingTop: 0, paddingBottom: 0, align: 'left', animation: { enabled: true, type: 'fade', duration: 1.2 } },
    letter: { paddingTop: 8, paddingBottom: 24, animation: { enabled: true, type: 'fade', duration: 1 } },
    event: { paddingTop: 0, paddingBottom: 0, align: 'left' },
  }
  return {
    id: uid(),
    type,
    label: label ?? SECTION_META[type].label,
    hidden: false,
    style: defaultStyle(styleByType[type]),
    settings: defaultSettings(type),
  } as Section
}

/** 새 초대장의 기본 내용: 첫 화면 → 초대 글 카드 → 행사 상세안내 + 오시는 길 */
export function defaultContent(): InvitationContent {
  return {
    schemaVersion: 1,
    theme: {
      colors: { ...PALETTE },
      fonts: { script: 'Great Vibes', serif: 'Tinos', sans: 'Pretendard' },
      baseFontSize: 15,
      letterSpacing: 0,
    },
    wedding: { date: '2026-10-19', time: '10:00', timezone: 'Asia/Seoul' },
    nav: { enabled: false, position: 'right', showLabels: false },
    animation: { enabled: true, speed: 1 },
    share: {
      title: '2026 미코세라믹스 강릉 제 6공장 준공식',
      description: '2026년 10월 19일 월요일 오전 10시\n미코세라믹스 강릉 제 6공장',
      image: null,
      kakaoJsKey: '',
      buttonText: '초대장 보기',
    },
    sections: (['hero', 'letter', 'event'] as SectionType[]).map((t) => createSection(t)),
  }
}
