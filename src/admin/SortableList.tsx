import type { ReactNode } from 'react'
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Icon } from './ui'

function Item({ id, children, grid }: { id: string; children: (handle: ReactNode) => ReactNode; grid?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const handle = (
    <button type="button" className="cursor-grab touch-none rounded p-1 text-stone-300 hover:text-stone-500 active:cursor-grabbing" {...attributes} {...listeners} aria-label="드래그하여 순서 변경">
      {Icon.drag}
    </button>
  )
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 10 : undefined, opacity: isDragging ? 0.85 : 1 }}
      className={grid ? '' : 'relative'}
    >
      {children(handle)}
    </div>
  )
}

/** 드래그로 순서를 바꿀 수 있는 목록 */
export function SortableList<T extends { id: string }>({
  items,
  onReorder,
  render,
  grid,
  className = '',
}: {
  items: T[]
  onReorder: (next: T[]) => void
  render: (item: T, index: number, handle: ReactNode) => ReactNode
  grid?: boolean
  className?: string
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return
    const from = items.findIndex((i) => i.id === e.active.id)
    const to = items.findIndex((i) => i.id === e.over!.id)
    if (from >= 0 && to >= 0) onReorder(arrayMove(items, from, to))
  }
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={items.map((i) => i.id)} strategy={grid ? rectSortingStrategy : verticalListSortingStrategy}>
        <div className={className}>
          {items.map((it, i) => (
            <Item key={it.id} id={it.id} grid={grid}>
              {(handle) => render(it, i, handle)}
            </Item>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}
