import { PALETTE } from '../lib/defaults'
import { SANS_FONTS, SCRIPT_FONTS, SERIF_FONTS } from '../lib/fonts'
import { formatKoFull, parseWedding } from '../lib/date'
import { useEditor } from './EditorContext'
import { Btn, ColorInput, Field, Group, Segmented, Select, Slider, Toggle } from './ui'

const COLOR_LABELS: Record<keyof typeof PALETTE, string> = {
  bg: '페이지 배경',
  bg2: '보조 배경',
  text: '배경 위 글자색',
  accent: '포인트 (버튼 · 강조)',
  sage: '보조 포인트',
  wax: '포인트 2',
  muted: '보조 글자색',
}

const PRESETS: { name: string; colors: typeof PALETTE }[] = [
  { name: 'Navy · Green (기본)', colors: PALETTE },
  { name: 'Midnight · Gold', colors: { bg: '#10131F', bg2: '#0A0C15', text: '#FFFFFF', accent: '#C9A65A', sage: '#C9A65A', wax: '#8A6E33', muted: '#A9ADBD' } },
  { name: 'Deep Green · Mint', colors: { bg: '#0F3A33', bg2: '#0A2924', text: '#FFFFFF', accent: '#7FD1B0', sage: '#7FD1B0', wax: '#2E6E5D', muted: '#A8C7BE' } },
  { name: 'Charcoal · Blue', colors: { bg: '#1E2126', bg2: '#15171B', text: '#FFFFFF', accent: '#4E8DF5', sage: '#4E8DF5', wax: '#2B5DBA', muted: '#A7ADB8' } },
  { name: 'White · Navy', colors: { bg: '#F4F5F9', bg2: '#E9EBF2', text: '#1B2155', accent: '#2C4BC4', sage: '#2C4BC4', wax: '#1B2155', muted: '#6B7190' } },
]

export function ThemePanel() {
  const { draft, update } = useEditor()
  const t = draft.theme
  const p = parseWedding(draft.wedding)
  return (
    <div>
      <div className="sticky top-0 z-10 border-b border-stone-100 bg-white/95 px-5 pb-3 pt-4 backdrop-blur">
        <p className="text-[11px] text-stone-400">모든 페이지에 적용</p>
        <p className="text-[15px] font-semibold text-stone-800">기본 정보 · 전체 디자인</p>
      </div>

      <Group title="행사 날짜 · 시간">
        <div className="grid grid-cols-2 gap-2">
          <Field label="날짜">
            <input
              type="date"
              className="w-full rounded-lg border border-stone-200 px-3 py-2 text-[13px]"
              value={draft.wedding.date}
              onChange={(e) => e.target.value && update((d) => void (d.wedding.date = e.target.value))}
            />
          </Field>
          <Field label="시간">
            <input
              type="time"
              className="w-full rounded-lg border border-stone-200 px-3 py-2 text-[13px]"
              value={draft.wedding.time}
              onChange={(e) => e.target.value && update((d) => void (d.wedding.time = e.target.value))}
            />
          </Field>
        </div>
        <p className="text-[12px] text-stone-500">→ {formatKoFull(p)} (한국 시간 기준)</p>
        <p className="text-[11px] text-stone-400">행사 상세안내의 ‘일시’에 자동으로 들어가요.</p>
      </Group>

      <Group title="색상">
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((pr) => (
            <button
              key={pr.name}
              type="button"
              onClick={() => update((d) => void (d.theme.colors = { ...pr.colors }))}
              className="flex items-center gap-1.5 rounded-full border border-stone-200 px-2.5 py-1 text-[11.5px] text-stone-600 hover:bg-stone-50"
            >
              <span className="flex -space-x-1">
                {[pr.colors.bg2, pr.colors.accent, pr.colors.wax].map((c) => (
                  <span key={c} className="h-3 w-3 rounded-full border border-white" style={{ background: c }} />
                ))}
              </span>
              {pr.name}
            </button>
          ))}
        </div>
        {(Object.keys(COLOR_LABELS) as (keyof typeof PALETTE)[]).map((k) => (
          <ColorInput key={k} label={COLOR_LABELS[k]} value={t.colors[k]} onChange={(v) => update((d) => void (d.theme.colors[k] = v))} />
        ))}
      </Group>

      <Group title="폰트">
        <Select label="영문 필기체 (첫 화면 브랜드를 필기체로 할 때)" value={t.fonts.script} onChange={(v) => update((d) => void (d.theme.fonts.script = v))} options={SCRIPT_FONTS.map((f) => ({ value: f.family, label: f.label }))} />
        <Select label="영문 세리프 (브랜드 · 맨 아래 로고 글씨)" value={t.fonts.serif} onChange={(v) => update((d) => void (d.theme.fonts.serif = v))} options={SERIF_FONTS.map((f) => ({ value: f.family, label: f.label }))} />
        <Select label="한글 본문" value={t.fonts.sans} onChange={(v) => update((d) => void (d.theme.fonts.sans = v))} options={SANS_FONTS.map((f) => ({ value: f.family, label: f.label }))} />
        <Slider label="기본 글자 크기" min={13} max={18} step={0.5} value={t.baseFontSize} onChange={(v) => update((d) => void (d.theme.baseFontSize = v))} format={(n) => `${n}px`} />
        <Slider label="자간" min={-0.03} max={0.08} step={0.005} value={t.letterSpacing} onChange={(v) => update((d) => void (d.theme.letterSpacing = v))} format={(n) => `${n.toFixed(3)}em`} />
      </Group>

      <Group title="페이지 내비게이션">
        <Toggle label="세로 내비게이션 표시" checked={draft.nav.enabled} onChange={(v) => update((d) => void (d.nav.enabled = v))} />
        <Segmented
          label="위치"
          value={draft.nav.position}
          onChange={(v) => update((d) => void (d.nav.position = v))}
          options={[
            { value: 'left', label: '왼쪽' },
            { value: 'right', label: '오른쪽' },
          ]}
        />
        <Toggle label="현재 페이지 이름 항상 표시" checked={draft.nav.showLabels} onChange={(v) => update((d) => void (d.nav.showLabels = v))} hint="끄면 점을 눌렀을 때만 잠깐 표시돼요. 이름은 왼쪽 목록에서 더블클릭해 바꿀 수 있어요." />
      </Group>

      <Group title="전체 애니메이션">
        <Toggle label="애니메이션 사용" checked={draft.animation.enabled} onChange={(v) => update((d) => void (d.animation.enabled = v))} hint="하객 기기의 ‘동작 줄이기’ 설정은 항상 존중돼요." />
        <Slider label="전체 속도" min={0.5} max={2} step={0.1} value={draft.animation.speed} onChange={(v) => update((d) => void (d.animation.speed = v))} format={(n) => `×${n}`} />
        <Btn onClick={() => update((d) => d.sections.forEach((s) => (s.style.animation.enabled = true)))}>모든 페이지 애니메이션 켜기</Btn>
      </Group>
    </div>
  )
}
