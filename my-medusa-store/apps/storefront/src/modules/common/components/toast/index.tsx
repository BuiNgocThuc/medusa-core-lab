'use client'

import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react'

export type ToastType = 'error' | 'success' | 'warning' | 'info'

type ToastInput = {
    content: string
    type?: ToastType
    duration?: number
}

type ToastItem = ToastInput & { id: number; duration: number }

const ToastContext = createContext<{ showToast: (toast: ToastInput) => void } | null>(null)

const tone: Record<ToastType, string> = {
    error: 'border-red-500 bg-red-50 text-red-950',
    success: 'border-green-500 bg-green-50 text-green-950',
    warning: 'border-amber-500 bg-amber-50 text-amber-950',
    info: 'border-blue-500 bg-blue-50 text-blue-950',
}

const progressTone: Record<ToastType, string> = {
    error: 'bg-red-500',
    success: 'bg-green-500',
    warning: 'bg-amber-500',
    info: 'bg-blue-500',
}

function Toast({ toast, onClose }: { toast: ToastItem; onClose: () => void }) {
    useEffect(() => {
        const timeout = window.setTimeout(onClose, toast.duration)
        return () => window.clearTimeout(timeout)
    }, [onClose, toast.duration])

    const type = toast.type ?? 'info'

    return (
        <div className={`relative w-80 overflow-hidden rounded-lg border-l-4 p-4 shadow-xl animate-[toast-in_200ms_ease-out] ${tone[type]}`} role="status">
            <button aria-label="Close notification" className="absolute right-3 top-2 text-lg" onClick={onClose} type="button">×</button>
            <p className="pr-5 text-sm font-medium">{toast.content}</p>
            <span className={`absolute bottom-0 left-0 h-1 ${progressTone[type]}`} style={{ animation: `toast-progress ${toast.duration}ms linear forwards` }} />
        </div>
    )
}

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<ToastItem[]>([])
    const showToast = useCallback((input: ToastInput) => {
        const duration = input.duration ?? 3000
        setToasts((current) => [...current, { ...input, duration, id: Date.now() }])
    }, [])
    const removeToast = useCallback((id: number) => setToasts((current) => current.filter((toast) => toast.id !== id)), [])

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            <div className="fixed right-4 top-4 z-[100] flex flex-col gap-3">
                {toasts.map((toast) => <Toast key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />)}
            </div>
            <style jsx global>{`@keyframes toast-in { from { opacity: 0; transform: translateX(1rem); } to { opacity: 1; transform: translateX(0); } } @keyframes toast-progress { from { width: 100%; } to { width: 0; } }`}</style>
        </ToastContext.Provider>
    )
}

export function useToast() {
    const context = useContext(ToastContext)
    if (!context) throw new Error('useToast must be used inside ToastProvider')
    return context
}
