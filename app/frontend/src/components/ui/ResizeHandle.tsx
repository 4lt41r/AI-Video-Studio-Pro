import { useCallback, useRef } from 'react'
import clsx from 'clsx'

interface Props {
  direction: 'horizontal' | 'vertical'
  onResize: (delta: number) => void
  className?: string
}

export default function ResizeHandle({ direction, onResize, className }: Props) {
  const dragging = useRef(false)
  const last     = useRef(0)

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragging.current = true
    last.current = direction === 'horizontal' ? e.clientY : e.clientX

    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return
      const cur   = direction === 'horizontal' ? ev.clientY : ev.clientX
      const delta = cur - last.current
      last.current = cur
      onResize(delta)
    }

    const onUp = () => {
      dragging.current = false
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.body.style.cursor = direction === 'horizontal' ? 'row-resize' : 'col-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [direction, onResize])

  return (
    <div
      onMouseDown={onMouseDown}
      className={clsx(
        'flex-shrink-0 flex items-center justify-center group transition-colors',
        direction === 'horizontal'
          ? 'h-1.5 w-full cursor-row-resize hover:bg-brand-500/20'
          : 'w-1.5 h-full cursor-col-resize hover:bg-brand-500/20',
        className,
      )}
    >
      <div className={clsx(
        'rounded-full bg-white/10 group-hover:bg-brand-400/60 transition-colors',
        direction === 'horizontal' ? 'w-12 h-0.5' : 'h-12 w-0.5',
      )} />
    </div>
  )
}
