import type { SectionOf } from '../../lib/types'
import { Img } from '../ui/Img'
import { Reveal } from '../ui/Reveal'
import { Body, SectionShell } from '../SectionShell'

/** INVITATION — 초대 인사말과 크게 놓인 둥근 사각형 사진 */
export function GreetingSection({ section, selected }: { section: SectionOf<'greeting'>; selected?: boolean }) {
  const s = section.settings
  return (
    <SectionShell section={section} selected={selected}>
      <Reveal>
        {s.eyebrow && (
          <p className="font-serif-en text-[0.86rem] tracking-[0.42em]" style={{ color: 'var(--c-accent)', fontSize: 'calc(0.86rem * var(--title-scale,1))' }}>
            {s.eyebrow}
          </p>
        )}
        {s.title && (
          <h2 className="mt-4 font-normal" style={{ fontSize: 'calc(1.24rem * var(--title-scale, 1))', letterSpacing: '-0.01em', lineHeight: 1.5 }}>
            {s.title}
          </h2>
        )}
        <div className="mx-auto mt-6 h-px w-8" style={{ background: 'var(--c-accent)', opacity: 0.6 }} />
      </Reveal>
      {s.body && (
        <Reveal delay={0.1}>
          <Body className="mt-8" style={{ fontSize: 'calc(0.94rem * var(--body-scale,1))', lineHeight: 2 }}>
            {s.body}
          </Body>
        </Reveal>
      )}
      {s.photo && (
        <Reveal delay={0.15} variant="zoom" className="mt-10">
          <Img image={s.photo} aspect={s.aspect} radius={s.radius} alt="초대 사진" style={{ boxShadow: '0 18px 40px -26px rgba(81,74,67,.45)' }} />
          {s.caption && (
            <p className="mt-4 text-[0.82rem]" style={{ color: 'var(--c-muted)' }}>
              {s.caption}
            </p>
          )}
        </Reveal>
      )}
    </SectionShell>
  )
}
