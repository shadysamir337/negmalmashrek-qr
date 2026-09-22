import { useEffect, useMemo, useRef, useState } from 'react'
import {
    Upload,
    Plus,
    Printer,
    Search,
    FileDown,
    Loader2,
    UserPlus,
    Users,
    Trash2,
    CheckSquare,
    Square,
    X,
    MousePointerClick,
    ArrowUpDown,
} from 'lucide-react'
import QRCard from '../components/QRCard.jsx'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import PersonHistoryModal from '../components/PersonHistoryModal.jsx'
import { SkeletonGrid } from '../components/Skeleton.jsx'
import {
    readNamesFromFile,
    downloadExcelTemplate,
} from '../utils/excel.js'
import { printSelectedQRs } from '../utils/qrPrint.js'
import {
    subscribePeople,
    subscribeAttendance,
    addPerson,
    addPeopleBulk,
    deletePerson,
    deletePeopleBulk,
    updatePersonName,
} from '../services/firestoreService.js'
import { useToast } from '../context/ToastContext.jsx'
import {
    cairoDateStr,
    cairoYear,
    msFromTimestamp,
} from '../utils/dateUtils.js'
import { MEETINGS, meetingDatesOfYear } from '../utils/meetings.js'

export default function PeoplePage() {
    const toast = useToast()
    const [people, setPeople] = useState([])
    const [records, setRecords] = useState([])
    const [loading, setLoading] = useState(true)
    const [newName, setNewName] = useState('')
    const [busy, setBusy] = useState(false)
    const [search, setSearch] = useState('')
    const [dragOver, setDragOver] = useState(false)
    const [confirmTarget, setConfirmTarget] = useState(null) // single-person delete
    const [deleting, setDeleting] = useState(false)
    const [selectedIds, setSelectedIds] = useState(() => new Set())
    const [confirmBulkDelete, setConfirmBulkDelete] = useState(false)
    const [historyTarget, setHistoryTarget] = useState(null)
    const [sortBy, setSortBy] = useState('name') // 'name' | 'pct-asc'
    const fileRef = useRef(null)
    const searchRef = useRef(null)

    useEffect(() => {
        const unsub = subscribePeople((items) => {
            setPeople(items)
            setLoading(false)
        })
        return () => unsub && unsub()
    }, [])

    useEffect(() => {
        const unsub = subscribeAttendance((items) => setRecords(items))
        return () => unsub && unsub()
    }, [])

    // Keyboard shortcut: "/" focuses search.
    useEffect(() => {
        function onKey(e) {
            if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' &&
                document.activeElement?.tagName !== 'TEXTAREA') {
                e.preventDefault()
                searchRef.current?.focus()
            }
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [])

    // Pre-compute attendance % per person for the current year. Eligibility
    // counts (date, meeting) slots — only days a meeting actually occurs —
    // both per meeting and overall (the card pill shows the overall %).
    const statsByPerson = useMemo(() => {
        const year = cairoYear()
        const yearStart = `${year}-01-01`
        const yearEnd = `${year}-12-31`
        const today = cairoDateStr()
        const meetingDates = Object.fromEntries(
            MEETINGS.map((m) => [m.id, meetingDatesOfYear(year, m.id)])
        )

        // Build attendance map: personId -> Set<`date|type`>.
        const byPerson = new Map()
        for (const r of records) {
            if (r.date < yearStart || r.date > yearEnd) continue
            if (!byPerson.has(r.personId)) byPerson.set(r.personId, new Set())
            byPerson.get(r.personId).add(`${r.date}|${r.type}`)
        }

        const out = {}
        for (const p of people) {
            const createdMs = msFromTimestamp(p.createdAt)
            const createdIso = createdMs ? cairoDateStr(new Date(createdMs)) : null
            const set = byPerson.get(p.id) || new Set()

            const perMeeting = {}
            let attendedDays = 0
            let totalEligibleDays = 0
            for (const m of MEETINGS) {
                const eligible = meetingDates[m.id].filter((d) => {
                    if (createdIso && d < createdIso) return false
                    if (d >= today) return false
                    return true
                })
                const attended = eligible.filter((d) => set.has(`${d}|${m.id}`)).length
                perMeeting[m.id] = {
                    attendedDays: attended,
                    totalEligibleDays: eligible.length,
                    percentage:
                        eligible.length === 0
                            ? 0
                            : Math.round((attended / eligible.length) * 100),
                }
                attendedDays += attended
                totalEligibleDays += eligible.length
            }

            const percentage =
                totalEligibleDays === 0
                    ? 0
                    : Math.round((attendedDays / totalEligibleDays) * 100)
            out[p.id] = { attendedDays, totalEligibleDays, percentage, perMeeting }
        }
        return out
    }, [people, records])

    async function handleAdd(e) {
        e.preventDefault()
        if (!newName.trim()) return
        setBusy(true)
        try {
            await addPerson(newName.trim())
            setNewName('')
            toast.success(`Added "${newName.trim()}"`)
        } catch (err) {
            toast.error(err.message || 'Failed to add')
        }
        setBusy(false)
    }

    async function processFile(file) {
        if (!file) return
        setBusy(true)
        try {
            const names = await readNamesFromFile(file)
            if (!names.length) {
                toast.error('No names found in file')
            } else {
                const { added, skipped } = await addPeopleBulk(names)
                toast.success(
                    `Imported ${added} new ${added === 1 ? 'person' : 'people'}` +
                    (skipped > 0 ? ` (${skipped} duplicate ignored)` : '')
                )
            }
        } catch (err) {
            toast.error(err.message || 'Failed to import')
        }
        setBusy(false)
        if (fileRef.current) fileRef.current.value = ''
    }

    function handleDelete(person) {
        setConfirmTarget(person)
    }

    async function confirmDelete() {
        if (!confirmTarget) return
        setDeleting(true)
        try {
            await deletePerson(confirmTarget.id)
            toast.success(`Deleted "${confirmTarget.name}"`)
            setConfirmTarget(null)
        } catch (err) {
            toast.error(err.message || 'Failed to delete')
        } finally {
            setDeleting(false)
        }
    }

    async function confirmBulkDeleteRun() {
        if (selectedIds.size === 0) return
        setDeleting(true)
        try {
            const ids = Array.from(selectedIds)
            const { removed } = await deletePeopleBulk(ids)
            toast.success(`Deleted ${removed} ${removed === 1 ? 'person' : 'people'}`)
            setSelectedIds(new Set())
            setConfirmBulkDelete(false)
        } catch (err) {
            toast.error(err.message || 'Bulk delete failed')
        } finally {
            setDeleting(false)
        }
    }

    async function handleRename(person, newName) {
        try {
            await updatePersonName(person.id, newName)
            toast.success(`Renamed to "${newName}"`)
        } catch (err) {
            toast.error(err.message || 'Failed to rename')
        }
    }

    function handlePrint() {
        window.print()
    }

    function onDrop(e) {
        e.preventDefault()
        setDragOver(false)
        const file = e.dataTransfer.files?.[0]
        if (file) processFile(file)
    }

    function toggleSelect(person) {
        setSelectedIds((prev) => {
            const next = new Set(prev)
            if (next.has(person.id)) next.delete(person.id)
            else next.add(person.id)
            return next
        })
    }

    function toggleSelectAll() {
        if (selectedIds.size === filtered.length) {
            setSelectedIds(new Set())
        } else {
            setSelectedIds(new Set(filtered.map((p) => p.id)))
        }
    }

    function clearSelection() {
        setSelectedIds(new Set())
    }

    // Print selected QR codes as a single composite image (and open print
    // dialog). Pulls the live <canvas> from each card via a data attribute on
    // the card wrapper — that way QR data stays byte-perfect and we don't have
    // to re-render off-screen.
    function handlePrintSelected() {
        if (selectedIds.size === 0) return
        const ordered = filtered.filter((p) => selectedIds.has(p.id))
        if (ordered.length === 0) return
        printSelectedQRs(ordered, (id) => {
            const wrapper = document.querySelector(`[data-qr-person-id="${cssEscape(id)}"]`)
            return wrapper?.querySelector('canvas') || null
        })
        toast.success(
            `Prepared ${ordered.length} QR code${ordered.length === 1 ? '' : 's'} — print dialog opening`
        )
    }

    const filtered = useMemo(() => {
        const base = search.trim()
            ? people.filter((p) => p.name.toLowerCase().includes(search.trim().toLowerCase()))
            : people
        if (sortBy === 'pct-asc') {
            return [...base].sort((a, b) =>
                (statsByPerson[a.id]?.percentage ?? 0) - (statsByPerson[b.id]?.percentage ?? 0)
            )
        }
        return base
    }, [people, search, sortBy, statsByPerson])

    return (
        <div className="space-y-4 animate-fade-in">
            {/* Header */}
            <div className="card p-4 sm:p-5 no-print">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-md flex-shrink-0">
                        <Users size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h1 className="text-xl font-bold">People</h1>
                        <p className="text-xs text-slate-500 flex items-center gap-1">
                            <span>{people.length} total</span>
                            <span className="text-slate-300">·</span>
                            <MousePointerClick size={11} />
                            <span>tap a card for history, the corner box to select</span>
                        </p>
                    </div>
                </div>
            </div>

            {/* Import / Add */}
            <div className="card p-4 sm:p-5 no-print space-y-4">
                {/* Drop zone */}
                <label
                    onDragOver={(e) => {
                        e.preventDefault()
                        setDragOver(true)
                    }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={onDrop}
                    className={`block cursor-pointer rounded-xl border-2 border-dashed p-5 text-center transition-colors ${dragOver
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-slate-300 bg-slate-50 hover:bg-slate-100'
                        }`}
                >
                    <input
                        ref={fileRef}
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        onChange={(e) => processFile(e.target.files?.[0])}
                        disabled={busy}
                        className="hidden"
                    />
                    <Upload size={28} className="mx-auto text-indigo-500" />
                    <p className="mt-2 text-sm font-semibold text-slate-700">
                        {busy ? 'Importing…' : 'Tap or drop an Excel file'}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                        .xlsx · .xls · .csv — first column = Name
                    </p>
                </label>

                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={() => downloadExcelTemplate()}
                        className="btn btn-ghost flex-1 sm:flex-none"
                    >
                        <FileDown size={16} /> Template
                    </button>
                    <button
                        onClick={handlePrint}
                        disabled={!people.length}
                        className="btn btn-ghost flex-1 sm:flex-none"
                    >
                        <Printer size={16} /> Print all
                    </button>
                </div>

                {/* Add new */}
                <form
                    onSubmit={handleAdd}
                    className="flex flex-col sm:flex-row gap-2"
                >
                    <div className="flex-1 relative">
                        <UserPlus
                            size={16}
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                        />
                        <input
                            type="text"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            placeholder="Add a person by name…"
                            disabled={busy}
                            maxLength={100}
                            className="input pl-9"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={busy || !newName.trim()}
                        className="btn btn-primary"
                    >
                        {busy ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                        Add
                    </button>
                </form>
            </div>

            {/* Search */}
            {people.length > 0 && (
                <div className="no-print flex gap-2">
                    <div className="flex-1 relative">
                        <Search
                            size={16}
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                        />
                        <input
                            ref={searchRef}
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search people…  (press / to focus)"
                            maxLength={100}
                            className="input pl-9"
                        />
                    </div>
                    <button
                        onClick={() => setSortBy((s) => s === 'name' ? 'pct-asc' : 'name')}
                        className={`btn flex-shrink-0 gap-1.5 ${sortBy === 'pct-asc' ? 'btn-primary' : 'btn-ghost'}`}
                        title={sortBy === 'pct-asc' ? 'Sorted by attendance % (low → high). Click for A–Z.' : 'Sort by attendance % low → high'}
                    >
                        <ArrowUpDown size={15} />
                        <span className="hidden sm:inline text-xs">{sortBy === 'pct-asc' ? '% ↑' : 'A–Z'}</span>
                    </button>
                </div>
            )}

            {/* Floating selection toolbar — auto-appears when at least one
                card is selected. No "select mode" toggle needed. */}
            {selectedIds.size > 0 && (
                <div className="no-print sticky top-[65px] z-20 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-2xl shadow-lg p-2 sm:p-3 flex flex-wrap items-center gap-2 animate-fade-in">
                    <span className="inline-flex items-center gap-2 font-semibold text-sm pl-1">
                        <CheckSquare size={16} />
                        {selectedIds.size} selected
                    </span>
                    <span className="text-white/70 text-xs">
                        of {filtered.length}
                    </span>
                    <div className="flex-1" />
                    <button
                        onClick={toggleSelectAll}
                        className="text-xs font-semibold inline-flex items-center gap-1 bg-white/15 hover:bg-white/25 px-2.5 py-1.5 rounded-lg transition-colors"
                    >
                        {selectedIds.size === filtered.length && filtered.length > 0 ? (
                            <>
                                <Square size={13} /> Unselect all
                            </>
                        ) : (
                            <>
                                <CheckSquare size={13} /> Select all
                            </>
                        )}
                    </button>
                    <button
                        onClick={handlePrintSelected}
                        disabled={deleting}
                        className="text-xs font-bold inline-flex items-center gap-1 bg-white text-indigo-700 hover:bg-indigo-50 disabled:opacity-60 px-3 py-1.5 rounded-lg transition-colors"
                        title="Print selected QR codes as one image"
                    >
                        <Printer size={13} /> Print {selectedIds.size}
                    </button>
                    <button
                        onClick={() => setConfirmBulkDelete(true)}
                        disabled={deleting}
                        className="text-xs font-bold inline-flex items-center gap-1 bg-white text-rose-600 hover:bg-rose-50 disabled:opacity-60 px-3 py-1.5 rounded-lg transition-colors"
                    >
                        <Trash2 size={13} /> Delete {selectedIds.size}
                    </button>
                    <button
                        onClick={clearSelection}
                        className="text-xs font-semibold inline-flex items-center gap-1 bg-white/15 hover:bg-white/25 px-2.5 py-1.5 rounded-lg transition-colors"
                        title="Clear selection"
                        aria-label="Clear selection"
                    >
                        <X size={13} />
                    </button>
                </div>
            )}

            {/* Grid */}
            {loading ? (
                <SkeletonGrid count={8} />
            ) : people.length === 0 ? (
                <div className="card p-10 text-center text-slate-500">
                    <Users size={32} className="mx-auto text-slate-300" />
                    <p className="mt-3 text-sm">
                        No people yet. Import an Excel file or add someone above.
                    </p>
                </div>
            ) : filtered.length === 0 ? (
                <div className="card p-10 text-center text-slate-500">
                    <Search size={32} className="mx-auto text-slate-300" />
                    <p className="mt-3 text-sm">No matches for "{search}".</p>
                </div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4 print-grid">
                    {filtered.map((p) => (
                        <QRCard
                            key={p.id}
                            person={p}
                            stats={statsByPerson[p.id]}
                            onDelete={handleDelete}
                            onShowHistory={(person) => setHistoryTarget(person)}
                            onRename={handleRename}
                            highlight={search.trim()}
                            selected={selectedIds.has(p.id)}
                            onToggleSelect={toggleSelect}
                        />
                    ))}
                </div>
            )}

            {/* Single delete */}
            <ConfirmDialog
                open={!!confirmTarget}
                title={`Delete "${confirmTarget?.name ?? ''}"?`}
                description="This will permanently remove this person and their QR code. Their past attendance records will be kept."
                confirmText="Delete"
                cancelText="Cancel"
                tone="danger"
                busy={deleting}
                onConfirm={confirmDelete}
                onCancel={() => !deleting && setConfirmTarget(null)}
            />

            {/* Bulk delete */}
            <ConfirmDialog
                open={confirmBulkDelete}
                title={`Delete ${selectedIds.size} selected ${selectedIds.size === 1 ? 'person' : 'people'}?`}
                description="This will permanently remove these people and their QR codes. Their past attendance records will be kept."
                confirmText="Delete all"
                cancelText="Cancel"
                tone="danger"
                busy={deleting}
                onConfirm={confirmBulkDeleteRun}
                onCancel={() => !deleting && setConfirmBulkDelete(false)}
            />

            {/* History modal */}
            {historyTarget && (
                <PersonHistoryModal
                    person={historyTarget}
                    records={records}
                    onClose={() => setHistoryTarget(null)}
                />
            )}
        </div>
    )
}

// Polyfill-ish CSS.escape for older browsers; firestore IDs are URL-safe so
// we mostly only need to escape quotes / backslashes here.
function cssEscape(value) {
    if (typeof CSS !== 'undefined' && CSS.escape) return CSS.escape(value)
    return String(value).replace(/["\\]/g, '\\$&')
}

