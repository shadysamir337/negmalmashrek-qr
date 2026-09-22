import { useRef, useState } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import { Download, Trash2, BarChart3, Check, Pencil } from 'lucide-react'

export default function QRCard({
    person,
    onDelete,
    onShowHistory,
    onRename,
    highlight = '',
    stats,
    selected = false,
    onToggleSelect,
    showActions = true,
}) {
    const wrapperRef = useRef(null)
    const [editingName, setEditingName] = useState(false)
    const [draftName, setDraftName] = useState('')

    function handleDownload(e) {
        e.stopPropagation()
        const canvas = wrapperRef.current?.querySelector('canvas')
        if (!canvas) return
        const size = 360
        const out = document.createElement('canvas')
        out.width = size
        out.height = size + 50
        const ctx = out.getContext('2d')
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, out.width, out.height)
        ctx.drawImage(canvas, 0, 0, size, size)
        ctx.fillStyle = '#0f172a'
        ctx.font = 'bold 20px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(person.name, size / 2, size + 32)
        const url = out.toDataURL('image/png')
        const a = document.createElement('a')
        a.href = url
        a.download = `${person.name.replace(/[^a-z0-9_-]+/gi, '_')}_qr.png`
        a.click()
    }

    function startEdit(e) {
        e.stopPropagation()
        setDraftName(person.name)
        setEditingName(true)
    }

    function commitEdit(e) {
        e?.stopPropagation?.()
        const trimmed = draftName.trim()
        if (trimmed && trimmed !== person.name) {
            onRename?.(person, trimmed)
        }
        setEditingName(false)
    }

    function onNameKeyDown(e) {
        if (e.key === 'Enter') commitEdit()
        if (e.key === 'Escape') setEditingName(false)
    }

    function pillColor(pct) {
        if (pct >= 80) return 'bg-emerald-500/95 text-white shadow-sm'
        if (pct >= 50) return 'bg-amber-500/95 text-white shadow-sm'
        return 'bg-rose-500/95 text-white shadow-sm'
    }

    return (
        <div
            ref={wrapperRef}
            data-qr-person-id={person.id}
            onClick={() => onShowHistory?.(person)}
            className={`card relative p-3 sm:p-4 flex flex-col items-center text-center transition-all cursor-pointer ${selected
                ? 'ring-2 ring-indigo-500 -translate-y-0.5 shadow-soft-lg'
                : 'hover:-translate-y-0.5'
                }`}
        >
            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation()
                    onToggleSelect?.(person)
                }}
                className={`no-print absolute top-2 left-2 w-7 h-7 rounded-lg flex items-center justify-center transition-all z-10 ${selected
                    ? 'bg-indigo-600 text-white shadow ring-2 ring-indigo-300'
                    : 'bg-white/90 backdrop-blur-sm border border-slate-300 text-transparent hover:border-indigo-400 hover:text-indigo-300'
                    }`}
                title={selected ? 'Unselect' : 'Select for bulk actions'}
                aria-label={selected ? 'Unselect' : 'Select'}
                aria-pressed={selected}
            >
                <Check size={15} />
            </button>

            {stats && stats.totalEligibleDays > 0 && (
                <div
                    className={`no-print absolute top-2 right-2 text-[10px] font-bold px-2 py-0.5 rounded-full tabular-nums ${pillColor(stats.percentage)}`}
                    title={`${stats.attendedDays} / ${stats.totalEligibleDays} meetings`}
                >
                    {stats.percentage}%
                </div>
            )}

            <div className="bg-white p-2 rounded-xl ring-1 ring-slate-200 mt-2 shadow-sm">
                <QRCodeCanvas
                    value={person.id}
                    size={140}
                    level="M"
                    includeMargin={false}
                />
            </div>
            {editingName ? (
                <input
                    autoFocus
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    onBlur={commitEdit}
                    onKeyDown={onNameKeyDown}
                    onClick={(e) => e.stopPropagation()}
                    maxLength={100}
                    className="mt-3 w-full text-center text-sm font-semibold text-slate-900 border border-indigo-300 rounded-lg px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                />
            ) : (
                <div className="mt-3 font-semibold text-slate-900 text-sm break-words leading-tight">
                    <HighlightText text={person.name} query={highlight} />
                </div>
            )}

            {stats && stats.totalEligibleDays > 0 && (
                <div className="no-print text-[10px] text-slate-500 mt-0.5 tabular-nums">
                    {stats.attendedDays}/{stats.totalEligibleDays} meetings
                </div>
            )}

            {showActions && (
                <div className="no-print mt-3 flex gap-1.5 w-full">
                    <button
                        onClick={(e) => {
                            e.stopPropagation()
                            onShowHistory?.(person)
                        }}
                        className="flex-1 inline-flex items-center justify-center gap-1 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold py-2 rounded-lg transition-colors min-h-[36px]"
                        title="View history"
                        aria-label="View history"
                    >
                        <BarChart3 size={14} />
                    </button>
                    <button
                        onClick={handleDownload}
                        className="flex-1 inline-flex items-center justify-center gap-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold py-2 rounded-lg transition-colors min-h-[36px]"
                        aria-label="Save QR"
                    >
                        <Download size={14} /> <span className="hidden xs:inline">Save</span>
                    </button>
                    <button
                        onClick={startEdit}
                        className="flex-1 inline-flex items-center justify-center gap-1 bg-sky-50 hover:bg-sky-100 text-sky-700 text-xs font-semibold py-2 rounded-lg transition-colors min-h-[36px]"
                        aria-label="Rename"
                        title="Rename"
                    >
                        <Pencil size={14} />
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation()
                            onDelete?.(person)
                        }}
                        className="flex-1 inline-flex items-center justify-center gap-1 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold py-2 rounded-lg transition-colors min-h-[36px]"
                        aria-label="Delete"
                    >
                        <Trash2 size={14} />
                    </button>
                </div>
            )}
        </div>
    )
}

function HighlightText({ text, query }) {
    if (!query) return <>{text}</>
    const idx = text.toLowerCase().indexOf(query.toLowerCase())
    if (idx === -1) return <>{text}</>
    return (
        <>
            {text.slice(0, idx)}
            <mark className="bg-yellow-200 text-slate-900 rounded-sm px-0.5 not-italic">
                {text.slice(idx, idx + query.length)}
            </mark>
            {text.slice(idx + query.length)}
        </>
    )
}
