import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from 'lucide-react'

const ToastContext = createContext(null)

let _seq = 0

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([])
    const timers = useRef(new Map())

    const dismiss = useCallback((id) => {
        setToasts((cur) => cur.filter((t) => t.id !== id))
        const tm = timers.current.get(id)
        if (tm) clearTimeout(tm)
        timers.current.delete(id)
    }, [])

    const push = useCallback((type, message, opts = {}) => {
        const id = ++_seq
        setToasts((cur) => [...cur, { id, type, message }])
        const ttl = opts.duration ?? 4000
        if (ttl > 0) {
            const tm = setTimeout(() => dismiss(id), ttl)
            timers.current.set(id, tm)
        }
        return id
    }, [dismiss])

    const value = {
        success: (msg, opts) => push('success', msg, opts),
        error: (msg, opts) => push('error', msg, opts),
        info: (msg, opts) => push('info', msg, opts),
        warn: (msg, opts) => push('warn', msg, opts),
        dismiss,
    }

    useEffect(() => () => timers.current.forEach((t) => clearTimeout(t)), [])

    return (
        <ToastContext.Provider value={value}>
            {children}
            <ToastViewport toasts={toasts} onDismiss={dismiss} />
        </ToastContext.Provider>
    )
}

export function useToast() {
    const ctx = useContext(ToastContext)
    if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
    return ctx
}

const STYLE = {
    success: {
        bg: 'bg-white border-emerald-200/80 text-emerald-900',
        accent: 'bg-emerald-500',
        Icon: CheckCircle2,
        iconColor: 'text-emerald-600',
    },
    error: {
        bg: 'bg-white border-rose-200/80 text-rose-900',
        accent: 'bg-rose-500',
        Icon: XCircle,
        iconColor: 'text-rose-600',
    },
    info: {
        bg: 'bg-white border-indigo-200/80 text-indigo-900',
        accent: 'bg-indigo-500',
        Icon: Info,
        iconColor: 'text-indigo-600',
    },
    warn: {
        bg: 'bg-white border-amber-200/80 text-amber-900',
        accent: 'bg-amber-500',
        Icon: AlertTriangle,
        iconColor: 'text-amber-600',
    },
}

function ToastViewport({ toasts, onDismiss }) {
    if (!toasts.length) return null
    return (
        <div className="no-print fixed z-[200] pointer-events-none flex flex-col gap-2
            top-auto bottom-[calc(5rem+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 w-[calc(100%-1.5rem)] max-w-sm
            md:top-4 md:bottom-auto md:right-4 md:left-auto md:translate-x-0 md:w-80">
            {toasts.map((t) => {
                const s = STYLE[t.type] || STYLE.info
                const Icon = s.Icon
                return (
                    <div
                        key={t.id}
                        className={`pointer-events-auto relative overflow-hidden rounded-2xl border ${s.bg} pl-4 pr-3 py-3 flex items-start gap-2.5 text-sm shadow-soft-lg animate-slide-up backdrop-blur`}
                        role="status"
                    >
                        <span className={`absolute left-0 top-0 bottom-0 w-1 ${s.accent}`} />
                        <Icon size={18} className={`flex-shrink-0 mt-0.5 ${s.iconColor}`} />
                        <div className="flex-1 leading-snug break-words font-medium">
                            {t.message}
                        </div>
                        <button
                            type="button"
                            onClick={() => onDismiss(t.id)}
                            className="flex-shrink-0 -mr-1 p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                            aria-label="Dismiss"
                        >
                            <X size={14} />
                        </button>
                    </div>
                )
            })}
        </div>
    )
}
