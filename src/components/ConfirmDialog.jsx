import { useEffect, useRef } from 'react'
import { AlertTriangle, X, Loader2 } from 'lucide-react'

/**
 * In-app confirmation modal — replaces window.confirm().
 *
 * Mobile: bottom sheet. Desktop: centered card.
 */
export default function ConfirmDialog({
    open,
    title = 'Are you sure?',
    description = '',
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    tone = 'danger',
    busy = false,
    onConfirm,
    onCancel,
}) {
    const confirmBtnRef = useRef(null)

    useEffect(() => {
        if (!open) return
        const onKey = (e) => {
            if (e.key === 'Escape' && !busy) onCancel?.()
            if (e.key === 'Enter' && !busy) onConfirm?.()
        }
        document.addEventListener('keydown', onKey)
        const prevOverflow = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        const t = setTimeout(() => confirmBtnRef.current?.focus(), 60)
        return () => {
            document.removeEventListener('keydown', onKey)
            document.body.style.overflow = prevOverflow
            clearTimeout(t)
        }
    }, [open, busy, onCancel, onConfirm])

    if (!open) return null

    const isDanger = tone === 'danger'

    return (
        <div
            className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
        >
            <div
                onClick={() => !busy && onCancel?.()}
                className="modal-backdrop animate-fade-in"
            />

            <div className="modal-sheet">
                <div className="sheet-grabber" />

                <div className="relative p-5 sm:p-6">
                    <button
                        onClick={() => !busy && onCancel?.()}
                        disabled={busy}
                        aria-label="Close"
                        className="absolute top-3 right-3 p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                    >
                        <X size={18} />
                    </button>

                    <div
                        className={`mx-auto w-14 h-14 rounded-2xl flex items-center justify-center shadow-md ${isDanger
                            ? 'bg-gradient-to-br from-rose-500 to-rose-600 text-white'
                            : 'bg-gradient-to-br from-indigo-500 to-violet-600 text-white'
                            }`}
                    >
                        <AlertTriangle size={26} />
                    </div>

                    <h2
                        id="confirm-title"
                        className="mt-4 text-center text-lg font-bold text-slate-900"
                    >
                        {title}
                    </h2>

                    {description && (
                        <p className="mt-2 text-center text-sm text-slate-600 leading-relaxed">
                            {description}
                        </p>
                    )}

                    <div className="mt-6 flex flex-col-reverse sm:flex-row gap-2 sm:gap-3">
                        <button
                            onClick={onCancel}
                            disabled={busy}
                            className="btn btn-ghost flex-1"
                        >
                            {cancelText}
                        </button>
                        <button
                            ref={confirmBtnRef}
                            onClick={onConfirm}
                            disabled={busy}
                            className={`btn flex-1 ${isDanger ? 'btn-danger' : 'btn-primary'}`}
                        >
                            {busy && <Loader2 size={16} className="animate-spin" />}
                            {busy ? 'Working…' : confirmText}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
