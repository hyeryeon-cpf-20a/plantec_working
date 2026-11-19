import type { SectionOf } from '../../lib/types'
import { Reveal } from '../ui/Reveal'
import { SectionShell } from '../SectionShell'

/** INVITATION 초대 글 카드. 빈 줄로 나눈 문단마다 살짝 띄워서 보여 줘요. */
export function LetterSection({ section, selected }: { section: SectionOf<'letter'>; selected?: boolean }) {
  const s = section.settings
  const paras = s.body.split(/\n\s*\n/).filter((p) => p.trim())
  return (
    <SectionShell section={section} selected={selected}>
      <Reveal>
        <div
          className={s.boxed ? 'px-5 py-8' : 'py-4'}
          style={
            s.boxed
              ? {
                  borderRadius: 28,
                  border: '1px solid rgba(255,255,255,.14)',
                  background: 'linear-gradient(180deg, rgba(255,255,255,.05), rgba(0,0,0,.12))',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,.06)',
                }
              : undefined
          }
        >
          {s.eyebrow && (
            <p className="mb-6 text-center">
              <span
                className="inline-block px-2 pb-1"
                style={{ borderBottom: '1px solid currentColor', letterSpacing: '0.42em', fontWeight: 300, fontSize: 'calc(1.02rem * var(--title-scale, 1))' }}
              >
                {s.eyebrow}
              </span>
            </p>
          )}
          <div style={{ fontSize: 'calc(0.92rem * var(--body-scale, 1))', lineHeight: 1.75, fontWeight: 300, wordBreak: 'keep-all' }}>
            {paras.map((p, i) => (
              <p key={i} className={`whitespace-pre-line ${i ? 'mt-3' : ''}`}>
                {p}
              </p>
            ))}
          </div>
        </div>
      </Reveal>
    </SectionShell>
  )
}
