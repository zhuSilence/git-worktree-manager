import { useRef, useState, useEffect, memo } from 'react'

interface LazyRenderProps {
  /** 预估高度（像素），用于占位 */
  estimatedHeight: number
  /** 提前加载的边距，如 "200px" */
  rootMargin?: string
  /** 是否一旦渲染就保留内容（避免频繁 mount/unmount） */
  keepOnceRendered?: boolean
  /** 子元素 */
  children: React.ReactNode
  /** 额外的 className */
  className?: string
}

/**
 * 懒渲染包装组件
 *
 * 使用 IntersectionObserver 检测元素是否在视口内，
 * 不在视口内时渲染固定高度的占位 div，进入视口时渲染实际内容。
 *
 * 适用于大列表的虚拟滚动优化场景。
 */
export const LazyRender = memo(function LazyRender({
  estimatedHeight,
  rootMargin = '300px',
  keepOnceRendered = true,
  children,
  className = '',
}: LazyRenderProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(false)
  const [hasBeenVisible, setHasBeenVisible] = useState(false)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        const visible = entry.isIntersecting
        setIsVisible(visible)
        if (visible) {
          setHasBeenVisible(true)
        }
      },
      { rootMargin }
    )

    observer.observe(element)

    return () => {
      observer.disconnect()
    }
  }, [rootMargin])

  const shouldRender = keepOnceRendered ? hasBeenVisible || isVisible : isVisible

  if (!shouldRender) {
    return (
      <div
        ref={ref}
        className={className}
        style={{ minHeight: estimatedHeight }}
        data-lazy-placeholder="true"
      />
    )
  }

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  )
})

export default LazyRender
