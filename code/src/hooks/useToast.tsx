import { create } from 'zustand'
import { useCallback } from 'react'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
  id: string
  type: ToastType
  message: string
  duration?: number
}

interface ToastState {
  toasts: Toast[]
  addToast: (toast: Omit<Toast, 'id'>) => string
  removeToast: (id: string) => void
  clearToasts: () => void
}

// 存储定时器 ID 的 Map，用于清理
const toastTimers = new Map<string, NodeJS.Timeout>()

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],

  addToast: (toast) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const newToast: Toast = { ...toast, id }

    set((state) => ({
      toasts: [...state.toasts, newToast],
    }))

    // 自动移除
    const duration = toast.duration ?? (toast.type === 'error' ? 5000 : 3000)
    if (duration > 0) {
      const timerId = setTimeout(() => {
        get().removeToast(id)
      }, duration)
      toastTimers.set(id, timerId)
    }

    return id
  },

  removeToast: (id) => {
    // 清除对应的定时器
    const timerId = toastTimers.get(id)
    if (timerId) {
      clearTimeout(timerId)
      toastTimers.delete(id)
    }
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }))
  },

  clearToasts: () => {
    // 清除所有定时器
    toastTimers.forEach((timerId) => {
      clearTimeout(timerId)
    })
    toastTimers.clear()
    set({ toasts: [] })
  },
}))

/**
 * Toast Hook - 用于显示通知消息
 */
export function useToast() {
  const { addToast, removeToast, clearToasts } = useToastStore()

  const success = useCallback(
    (message: string, duration?: number) => {
      return addToast({ type: 'success', message, duration })
    },
    [addToast]
  )

  const error = useCallback(
    (message: string, duration?: number) => {
      return addToast({ type: 'error', message, duration })
    },
    [addToast]
  )

  const warning = useCallback(
    (message: string, duration?: number) => {
      return addToast({ type: 'warning', message, duration })
    },
    [addToast]
  )

  const info = useCallback(
    (message: string, duration?: number) => {
      return addToast({ type: 'info', message, duration })
    },
    [addToast]
  )

  return {
    success,
    error,
    warning,
    info,
    remove: removeToast,
    clear: clearToasts,
  }
}

/**
 * 错误处理 Hook - 统一处理错误并显示 Toast
 */
export function useErrorHandler() {
  const toast = useToast()

  const handleError = useCallback(
    (error: unknown, fallbackMessage = '操作失败') => {
      let message: string

      if (error instanceof Error) {
        message = error.message
      } else if (typeof error === 'string') {
        message = error
      } else {
        message = fallbackMessage
      }

      // 显示错误 Toast
      toast.error(message)

      // 仅在开发环境输出到控制台
      if (import.meta.env.DEV) {
        console.error('[Error]', error)
      }

      return message
    },
    [toast]
  )

  const wrapAsync = useCallback(
    <T,>(
      asyncFn: () => Promise<T>,
      options?: {
        onSuccess?: (result: T) => void
        successMessage?: string
        errorMessage?: string
      }
    ): Promise<T | null> => {
      return asyncFn()
        .then((result) => {
          if (options?.successMessage) {
            toast.success(options.successMessage)
          }
          options?.onSuccess?.(result)
          return result
        })
        .catch((error) => {
          handleError(error, options?.errorMessage)
          return null
        })
    },
    [handleError, toast]
  )

  return {
    handleError,
    wrapAsync,
    toast,
  }
}
