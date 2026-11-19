import { useCallback, useEffect, useRef, useState } from 'react'
import { deleteMedia, listMedia, uploadMedia, type MediaAsset } from '../lib/api'
import { aspectRatio, imageSrc, mediaUrl } from '../lib/image'
import type { Aspect, ImageRef } from '../lib/types'
import { errorMessage } from '../lib/util'
import { Btn, Icon, Modal, Segmented, Slider } from './ui'
import { useEditor } from './EditorContext'

/** 관리자 이미지 라이브러리 — 업로드, 선택, 삭제 */
export function MediaLibrary({
  invitationId,
  open,
  multiple,
  onClose,
  onPick,
  toast,
}: {
  invitationId: string
  open: boolean
  multiple?: boolean
  onClose: () => void
  onPick?: (assets: MediaAsset[]) => void
  toast: (m: string, k?: 'ok' | 'error') => void
}) {
  const [items, setItems] = useState<MediaAsset[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null)
  const [sel, setSel] = useState<string[]>([])
  const fileRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setItems(await listMedia(invitationId))
    } catch (e) {
      toast(errorMessage(e), 'error')
    } finally {
      setLoading(false)
    }
  }, [invitationId, toast])

  useEffect(() => {
    if (open) {
      setSel([])
      void load()
    }
  }, [open, load])

  async function upload(files: FileList | File[] | null) {
    if (!files) return
    const list = Array.from(files).filter((f) => /^image\//.test(f.type))
    if (!list.length) return
    setUploading({ done: 0, total: list.length })
    const added: MediaAsset[] = []
    for (const f of list) {
      try {
        if (f.size > 25 * 1024 * 1024) throw new Error('25MB 이하 이미지만 올릴 수 있어요')
        const a = await uploadMedia(invitationId, f)
        added.push(a)
        setItems((prev) => [a, ...prev])
      } catch (e) {
        toast(`${f.name}: ${errorMessage(e)}`, 'error')
      }
      setUploading((u) => (u ? { ...u, done: u.done + 1 } : u))
    }
    setUploading(null)
    if (added.length) {
      toast(`${added.length}장 업로드 완료`)
      setSel((s) => (multiple ? [...added.map((a) => a.id), ...s] : [added[0].id]))
    }
  }

  async function remove(a: MediaAsset) {
    if (!confirm('이 이미지를 라이브러리에서 삭제할까요?\n초대장에서 사용 중이면 그 자리는 빈 이미지로 보입니다.')) return
    try {
      await deleteMedia(a)
      setItems((prev) => prev.filter((x) => x.id !== a.id))
      setSel((s) => s.filter((x) => x !== a.id))
    } catch (e) {
      toast(errorMessage(e), 'error')
    }
  }

  const toggle = (id: string) => setSel((s) => (multiple ? (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]) : [id]))

  return (
    <Modal open={open} onClose={onClose} title={onPick ? (multiple ? '사진 선택 (여러 장 가능)' : '사진 선택') : '이미지 라이브러리'} wide>
      <div
        className={`p-5 ${dragOver ? 'bg-amber-50/60' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          void upload(e.dataTransfer.files)
        }}
      >
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Btn variant="primary" onClick={() => fileRef.current?.click()} disabled={!!uploading}>
            {Icon.plus} 사진 업로드
          </Btn>
          <span className="text-[12px] text-stone-400">
            {uploading ? `업로드 중… ${uploading.done}/${uploading.total}` : '여기로 파일을 끌어다 놓아도 돼요 · 자동으로 최적화(최대 2400px)됩니다'}
          </span>
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => { void upload(e.target.files); e.target.value = '' }} />
        </div>
        {loading && !items.length ? (
          <p className="py-10 text-center text-[13px] text-stone-400">불러오는 중…</p>
        ) : items.length === 0 ? (
          <p className="rounded-xl border border-dashed border-stone-200 py-14 text-center text-[13px] text-stone-400">아직 업로드한 이미지가 없어요.</p>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {items.map((a) => {
              const i = sel.indexOf(a.id)
              return (
                <div key={a.id} className="group relative">
                  <button
                    type="button"
                    onClick={() => (onPick ? toggle(a.id) : undefined)}
                    className={`block aspect-square w-full overflow-hidden rounded-lg bg-stone-100 ring-offset-2 transition ${i >= 0 ? 'ring-2 ring-[#8a7a66]' : ''}`}
                  >
                    <img src={mediaUrl(a.path)} alt="" loading="lazy" className="h-full w-full object-cover" />
                  </button>
                  {i >= 0 && multiple && (
                    <span className="absolute left-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#514A43] text-[10px] text-white">{i + 1}</span>
                  )}
                  <button
                    type="button"
                    onClick={() => remove(a)}
                    title="삭제"
                    className="absolute right-1.5 top-1.5 rounded-md bg-white/90 p-1 text-stone-500 opacity-0 shadow-sm transition hover:text-red-600 group-hover:opacity-100"
                  >
                    {Icon.trash}
                  </button>
                  <p className="mt-1 truncate text-[10px] text-stone-400">
                    {a.width}×{a.height} · {a.bytes ? `${Math.round(a.bytes / 1024)}KB` : ''}
                  </p>
                </div>
              )
            })}
          </div>
        )}
      </div>
      {onPick && (
        <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-stone-100 bg-white px-5 py-3">
          <span className="mr-auto text-[12px] text-stone-400">{sel.length}장 선택됨</span>
          <Btn onClick={onClose}>취소</Btn>
          <Btn variant="primary" disabled={!sel.length} onClick={() => onPick(sel.map((id) => items.find((x) => x.id === id)!).filter(Boolean))}>
            선택 완료
          </Btn>
        </div>
      )}
    </Modal>
  )
}

export function assetToImage(a: MediaAsset): ImageRef {
  return { path: a.path, width: a.width ?? undefined, height: a.height ?? undefined, focusX: 50, focusY: 50, zoom: 1 }
}

/** 이미지 교체 + 비율/크롭(초점·확대) 편집 필드 */
export function ImageField({
  label,
  value,
  onChange,
  aspect = '3:4',
  allowRemove = true,
  onAspectChange,
}: {
  label: string
  value: ImageRef | null
  onChange: (v: ImageRef | null) => void
  aspect?: Aspect
  allowRemove?: boolean
  onAspectChange?: (a: Aspect) => void
}) {
  const { pickImages } = useEditor()
  const [crop, setCrop] = useState(false)
  const src = imageSrc(value)
  return (
    <div>
      <span className="mb-1.5 block text-[12px] font-medium text-stone-500">{label}</span>
      <div className="flex gap-3">
        <div className="w-20 shrink-0 overflow-hidden rounded-lg bg-stone-100" style={{ aspectRatio: String(aspectRatio(aspect, value) ?? 0.75) }}>
          {src && (
            <img
              src={src}
              alt=""
              className="h-full w-full object-cover"
              style={{ objectPosition: `${value?.focusX ?? 50}% ${value?.focusY ?? 50}%`, transform: `scale(${value?.zoom ?? 1})`, transformOrigin: `${value?.focusX ?? 50}% ${value?.focusY ?? 50}%` }}
            />
          )}
        </div>
        <div className="flex flex-col items-start gap-1.5">
          <Btn
            onClick={async () => {
              const r = await pickImages()
              if (r?.[0]) onChange(assetToImage(r[0]))
            }}
          >
            {src ? '사진 교체' : '사진 선택'}
          </Btn>
          {src && <Btn variant="ghost" onClick={() => setCrop(true)}>{onAspectChange ? '크롭 · 비율 · 확대' : '위치 · 확대 조정'}</Btn>}
          {src && allowRemove && (
            <Btn variant="ghost" className="!text-red-500" onClick={() => onChange(null)}>
              제거
            </Btn>
          )}
        </div>
      </div>
      {value && <CropDialog open={crop} onClose={() => setCrop(false)} value={value} aspect={aspect} onChange={onChange} onAspectChange={onAspectChange} />}
    </div>
  )
}

/** 비파괴 크롭: 드래그로 위치, 슬라이더로 확대 */
export function CropDialog({
  open,
  onClose,
  value,
  aspect: initialAspect,
  onChange,
  onAspectChange,
}: {
  open: boolean
  onClose: () => void
  value: ImageRef
  aspect: Aspect
  onChange: (v: ImageRef) => void
  onAspectChange?: (a: Aspect) => void
}) {
  const [v, setV] = useState(value)
  const [aspect, setAspect] = useState<Aspect>(initialAspect)
  const box = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; y: number; fx: number; fy: number } | null>(null)
  useEffect(() => {
    if (open) {
      setV(value)
      setAspect(initialAspect)
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  const src = imageSrc(v)
  const fx = v.focusX ?? 50
  const fy = v.focusY ?? 50
  return (
    <Modal open={open} onClose={onClose} title="사진 위치 · 확대 조정">
      <div className="space-y-4 p-5">
        <div
          ref={box}
          className="relative mx-auto w-full max-w-[300px] cursor-grab touch-none overflow-hidden rounded-lg bg-stone-100 active:cursor-grabbing"
          style={{ aspectRatio: String(aspectRatio(aspect, v) ?? 0.75) }}
          onPointerDown={(e) => {
            ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
            drag.current = { x: e.clientX, y: e.clientY, fx, fy }
          }}
          onPointerMove={(e) => {
            if (!drag.current || !box.current) return
            const r = box.current.getBoundingClientRect()
            const z = v.zoom ?? 1
            const dx = ((e.clientX - drag.current.x) / r.width) * 100 / z
            const dy = ((e.clientY - drag.current.y) / r.height) * 100 / z
            setV((p) => ({
              ...p,
              focusX: Math.round(Math.min(100, Math.max(0, drag.current!.fx - dx))),
              focusY: Math.round(Math.min(100, Math.max(0, drag.current!.fy - dy))),
            }))
          }}
          onPointerUp={() => (drag.current = null)}
        >
          {src && (
            <img
              src={src}
              alt=""
              draggable={false}
              className="pointer-events-none h-full w-full select-none object-cover"
              style={{ objectPosition: `${fx}% ${fy}%`, transform: `scale(${v.zoom ?? 1})`, transformOrigin: `${fx}% ${fy}%` }}
            />
          )}
          <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="border border-white/30" />
            ))}
          </div>
        </div>
        <p className="text-center text-[11px] text-stone-400">사진을 드래그해서 보여줄 위치를 정하세요</p>
        <Slider label="확대" min={1} max={3} step={0.01} value={v.zoom ?? 1} onChange={(z) => setV((p) => ({ ...p, zoom: z }))} format={(n) => `${n.toFixed(2)}×`} />
        {onAspectChange && (
          <Segmented<Aspect>
            label="비율"
            value={aspect}
            onChange={setAspect}
            options={(['original', '1:1', '4:5', '3:4', '2:3', '4:3'] as Aspect[]).map((a) => ({ value: a, label: a === 'original' ? '원본' : a }))}
          />
        )}
        <div className="flex justify-between gap-2 pt-1">
          <Btn variant="ghost" onClick={() => setV((p) => ({ ...p, focusX: 50, focusY: 50, zoom: 1 }))}>
            초기화
          </Btn>
          <div className="flex gap-2">
            <Btn onClick={onClose}>취소</Btn>
            <Btn
              variant="primary"
              onClick={() => {
                onChange(v)
                if (onAspectChange && aspect !== initialAspect) onAspectChange(aspect)
                onClose()
              }}
            >
              적용
            </Btn>
          </div>
        </div>
      </div>
    </Modal>
  )
}
