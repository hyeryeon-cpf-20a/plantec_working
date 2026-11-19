import { useState } from 'react'
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Section, SectionType } from '../lib/types'
import { createSection, SECTION_META } from '../lib/defaults'
import { uid } from '../lib/util'
import { useEditor } from './EditorContext'
import { Icon } from './ui'

export const THEME_ID = '__theme'

function Row({
  s,
  index,
  selected,
  onSelect,
  fixed,
}: {
  s: Section
  index: number
  selected: boolean
  onSelect: () => void
  fixed?: boolean
}) {
  const { update } = useEditor()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: s.id, disabled: fixed })
  const [editing, setEditing] = useState(false)
  const meta = SECTION_META[s.type]
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 10 : undefined }}
      className={`group relative flex items-center gap-1.5 rounded-lg border px-1.5 py-1.5 transition ${
        selected ? 'border-[#B8A489]/60 bg-[#F4F0E8]' : 'border-transparent hover:bg-stone-50'
      } ${isDragging ? 'shadow-lg' : ''} ${s.hidden ? 'opacity-55' : ''}`}
    >
      <button
        type="button"
        className={`flex h-7 w-5 shrink-0 items-center justify-center rounded text-stone-300 ${fixed ? 'cursor-default opacity-30' : 'cursor-grab hover:text-stone-500 active:cursor-grabbing'}`}
        {...attributes}
        {...listeners}
        aria-label={fixed ? '고정된 섹션' : '드래그하여 순서 변경'}
        title={fixed ? '봉투는 항상 처음에 표시됩니다' : '드래그하여 순서 변경'}
      >
        {Icon.drag}
      </button>
      <button type="button" className="min-w-0 flex-1 text-left" onClick={onSelect} onDoubleClick={() => setEditing(true)}>
        <span className="flex items-center gap-1.5">
          <span className="w-5 shrink-0 text-[10px] tabular-nums text-stone-400">{String(index + 1).padStart(2, '0')}</span>
          {editing ? (
            <input
              autoFocus
              className="w-full rounded border border-stone-300 px-1 py-0.5 text-[13px]"
              defaultValue={s.label}
              onClick={(e) => e.stopPropagation()}
              onBlur={(e) => {
                const v = e.target.value.trim()
                if (v) update((d) => void (d.sections.find((x) => x.id === s.id)!.label = v))
                setEditing(false)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                if (e.key === 'Escape') setEditing(false)
              }}
            />
          ) : (
            <span className="truncate text-[13px] text-stone-800">{s.label}</span>
          )}
        </span>
        <span className="ml-[26px] block truncate text-[10.5px] text-stone-400">{meta.name}</span>
      </button>
      <div className="flex shrink-0 items-center opacity-70 group-hover:opacity-100">
        <button
          type="button"
          title={s.hidden ? '보이기' : '숨기기'}
          className="rounded p-1 text-stone-400 hover:bg-white hover:text-stone-700"
          onClick={() => update((d) => void (d.sections.find((x) => x.id === s.id)!.hidden = !s.hidden))}
        >
          {s.hidden ? Icon.eyeOff : Icon.eye}
        </button>
        {!meta.singleton && (
          <>
            <button
              type="button"
              title="복제"
              className="hidden rounded p-1 text-stone-400 hover:bg-white hover:text-stone-700 group-hover:block"
              onClick={() =>
                update((d) => {
                  const i = d.sections.findIndex((x) => x.id === s.id)
                  const copy = JSON.parse(JSON.stringify(d.sections[i])) as Section
                  copy.id = uid()
                  copy.label = `${s.label} 복사본`
                  d.sections.splice(i + 1, 0, copy)
                })
              }
            >
              {Icon.copy}
            </button>
            <button
              type="button"
              title="삭제"
              className="hidden rounded p-1 text-stone-400 hover:bg-white hover:text-red-600 group-hover:block"
              onClick={() => {
                if (!confirm(`'${s.label}' 페이지를 삭제할까요?\n게시하기 전까지 초대장 화면에는 반영되지 않으며, 버전 기록에서 되돌릴 수 있어요.`)) return
                update((d) => void (d.sections = d.sections.filter((x) => x.id !== s.id)))
              }}
            >
              {Icon.trash}
            </button>
          </>
        )}
      </div>
    </li>
  )
}

export function SectionList({ selectedId, onSelect }: { selectedId: string | null; onSelect: (id: string) => void }) {
  const { draft, update } = useEditor()
  const [adding, setAdding] = useState(false)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const movable = draft.sections

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    update((d) => {
      const from = d.sections.findIndex((s) => s.id === active.id)
      const to = d.sections.findIndex((s) => s.id === over.id)
      if (from < 0 || to < 0) return
      d.sections = arrayMove(d.sections, from, to)
    })
  }

  function add(type: SectionType) {
    const sec = createSection(type)
    update((d) => {
      // 선택한 페이지 바로 아래에 추가 (없으면 맨 끝)
      const at = d.sections.findIndex((x) => x.id === selectedId)
      if (at >= 0) d.sections.splice(at + 1, 0, sec)
      else d.sections.push(sec)
    })
    onSelect(sec.id)
    setAdding(false)
  }

  const addable = (Object.keys(SECTION_META) as SectionType[]).filter((t) => !(SECTION_META[t].singleton && draft.sections.some((s) => s.type === t)))

  return (
    <div className="flex h-full flex-col">
      <div className="px-3 pb-2 pt-3">
        <button
          type="button"
          onClick={() => onSelect(THEME_ID)}
          className={`flex w-full items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left transition ${
            selectedId === THEME_ID ? 'border-[#B8A489]/60 bg-[#F4F0E8]' : 'border-stone-200 hover:bg-stone-50'
          }`}
        >
          <span className="flex -space-x-1">
            {[draft.theme.colors.bg2, draft.theme.colors.accent, draft.theme.colors.wax].map((c) => (
              <span key={c} className="h-4 w-4 rounded-full border border-white" style={{ background: c }} />
            ))}
          </span>
          <span>
            <span className="block text-[13px] font-medium text-stone-800">기본 정보 · 전체 디자인</span>
            <span className="block text-[10.5px] text-stone-400">날짜 · 이름 · 색상 · 폰트 · 내비게이션</span>
          </span>
        </button>
      </div>
      <div className="flex items-center justify-between px-4 pb-1 pt-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-stone-400">페이지 {draft.sections.length}</span>
        <span className="text-[10.5px] text-stone-400" title="드래그로 순서 변경 · 더블클릭으로 이름 변경">드래그 · 더블클릭 이름변경</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={movable.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <ul className="space-y-0.5">
              {movable.map((s, i) => (
                <Row key={s.id} s={s} index={i} selected={selectedId === s.id} onSelect={() => onSelect(s.id)} />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      </div>
      <div className="relative border-t border-stone-100 p-3">
        {adding && (
          <div className="absolute bottom-full left-3 right-3 mb-1 max-h-[50vh] overflow-auto rounded-xl border border-stone-200 bg-white p-1.5 shadow-xl">
            {addable.map((t) => (
              <button key={t} type="button" className="block w-full rounded-lg px-3 py-2 text-left text-[12.5px] text-stone-700 hover:bg-stone-50" onClick={() => add(t)}>
                {SECTION_META[t].name}
              </button>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={() => setAdding((a) => !a)}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-stone-300 py-2 text-[12.5px] text-stone-600 hover:bg-stone-50"
        >
          {Icon.plus} 페이지 추가
        </button>
      </div>
    </div>
  )
}
