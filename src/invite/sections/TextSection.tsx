import type { SectionOf } from '../../lib/types'
import { Img } from '../ui/Img'
import { Reveal } from '../ui/Reveal'
import { Body, SectionShell, SectionTitle } from '../SectionShell'

export function TextSection({ section, selected }: { section: SectionOf<'text'>; selected?: boolean }) {
  const s = section.settings
  return (
    <SectionShell section={section} selected={selected}>
      <Reveal>
        <SectionTitle eyebrow={s.eyebrow} title={s.title} />
      </Reveal>
      {s.image && (
        <Reveal delay={0.05} variant="zoom" className="mb-8">
          <Img image={s.image} aspect={s.aspect} />
        </Reveal>
      )}
      <Reveal delay={0.1}>
        <Body>{s.body}</Body>
      </Reveal>
    </SectionShell>
  )
}
