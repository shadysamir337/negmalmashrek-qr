import { useEffect, useMemo, useState } from 'react'
import {
    X,
    UserPlus,
    Search,
    Loader2,
    CheckCircle2,
    Clock,
    AlertCircle,
    CalendarDays,
} from 'lucide-react'
import { MEETINGS, MEETINGS_BY_ID, PROJECT_START, isMeetingDate, meetingLabel } from '../utils/meetings.js'
import { cairoDateStr } from '../utils/dateUtils.js'
import { addAttendance } from '../services/firestoreService.js'

// Admin-only: manually record attendance for one or more people on any past
// (or today's) date, for a chosen meeting. Writes the same deterministic doc
// as a live scan, so duplicates are still impossible.
export default function AddAttendanceModal({
    people,
    records,
    defaultDay,
    defaultMeeting,
    lateCutoffs,
    onClose,
    onSaved,
}) {
    const today = cairoDateStr()
    // Multi-select: Map of personId -> person.
    const [selected, setSelected] = useState(() => new Map())
    const [search, setSearch] = useState('')
    const [date, setDate] = useState(defaultDay && defaultDay <= today ? defaultDay : today)
    const [meeting, setMeeting] = useState(defaultMeeting || MEETINGS[0].id)
    const [time, setTime] = useState(lateCutoffs?.[defaultMeeting] ?? '19:00')
    const [timeTouched, setTimeTouched] = useState(false)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState(null)

    // Default the time to the selected meeting's cutoff (counts as on-time)
    // until the admin edits it manually.
    useEffect(() => {
        if (!timeTouched && lateCutoffs?.[meeting]) setTime(lateCutoffs[meeting])
    }, [meeting, timeTouched, lateCutoffs])

    useEffect(() => {
        function onKey(e) {
            if (e.key === 'Escape' && !busy) onClose?.()
        }
        const prev = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        window.addEventListener('keydown', onKey)
        return () => {
            window.removeEventListener('keydown', onKey)
            document.body.style.overflow = prev
        }
    }, [onClose, busy])

    // `${personId}|${date}|${type}` for every existing record (legacy docs
    // arrive normalized to sunday), to flag people already checked in.
    const checkedKeys = useMemo(() => {
        const s = new Set()
        for (const r of records) s.add(`${r.personId}|${r.date}|${r.type}`)
        return s
    }, [records])

    // Full list, filtered by search — scrollable, no cap.
    const filteredPeople = useMemo(() => {
        const q = search.trim().toLowerCase()
        return q ? people.filter((p) => p.name.toLowerCase().includes(q)) : people
    }, [people, search])

    const isChecked = (personId) => checkedKeys.has(`${personId}|${date}|${meeting}`)

    function togglePerson(p) {
        setSelected((prev) => {
            const next = new Map(prev)
            if (next.has(p.id)) next.delete(p.id)
            else next.set(p.id, p)
            return next
        })
    }

    // Changing date/meeting can make a selected person already-checked-in;
    // drop them so the counter matches the visible list.
    useEffect(() => {
        setSelected((prev) => {
            let changed = false
            const next = new Map(prev)
            for (const id of prev.keys()) {
                if (checkedKeys.has(`${id}|${date}|${meeting}`)) {
                    next.delete(id)
                    changed = true
                }
            }
            return changed ? next : prev
        })
    }, [checkedKeys, date, meeting])

    const selectablePeople = useMemo(
        () => filteredPeople.filter((p) => !isChecked(p.id)),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [filteredPeople, checkedKeys, date, meeting]
    )
    const allFilteredSelected =
        selectablePeople.length > 0 && selectablePeople.every((p) => selected.has(p.id))

    function toggleSelectAllFiltered() {
        setSelected((prev) => {
            const next = new Map(prev)
            if (allFilteredSelected) {
                for (const p of selectablePeople) next.delete(p.id)
            } else {
                for (const p of selectablePeople) next.set(p.id, p)
            }
            return next
        })
    }

    const cutoff = lateCutoffs?.[meeting]
    const isLate = cutoff && time > cutoff
    // Meetings without a fixed weekday (Events) are never off-schedule.
    const offSchedule =
        date && MEETINGS_BY_ID[meeting]?.dayOfWeek != null && !isMeetingDate(meeting, date)
    const futureDate = date > today
    const beforeStart = date && date < PROJECT_START
    const canSave = selected.size > 0 && date && time && !futureDate && !beforeStart && !busy

    async function handleSave() {
        if (!canSave) return
        setBusy(true)
        setError(null)
        let added = 0
        let skipped = 0
        let failed = 0
        for (const p of selected.values()) {
            if (isChecked(p.id)) {
                skipped++
                continue
            }
            try {
                await addAttendance({
                    personId: p.id,
                    name: p.name,
                    date,
                    time: `${time}:00`,
                    type: meeting,
                    late: !!isLate,
                })
                added++
            } catch (err) {
                if (err?.code === 'already-checked-in') skipped++
                else failed++
            }
        }
        setBusy(false)
        if (failed > 0) {
            setError(`Added ${added}, but ${failed} failed — check your connection and try again.`)
            return
        }
        let msg = `Added ${added} ${added === 1 ? 'person' : 'people'} → ${meetingLabel(meeting)} on ${date}`
        if (skipped > 0) msg += ` (${skipped} already in)`
        onSaved?.(msg)
        onClose?.()
    }

    return (
        <div
            className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4"
            role="dialog"
            aria-modal="true"
            onClick={() => !busy && onClose?.()}
        >
            <div className="modal-backdrop animate-fade-in" />
            <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
                <div className="sheet-grabber" />

                {/* Header */}
                <div className="px-4 py-3 sm:px-5 sm:py-4 border-b border-slate-200/80 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-md flex-shrink-0">
                        <UserPlus size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-base">Add attendance</h3>
                        <p className="text-xs text-slate-500">
                            Record a check-in manually — past dates allowed
                        </p>
                    </div>
                    <button
                        onClick={() => !busy && onClose?.()}
                        className="w-9 h-9 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500"
                        aria-label="Close"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="p-4 sm:p-5 space-y-4 overflow-auto">
                    {/* People (multi-select) */}
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                People
                                {selected.size > 0 && (
                                    <span className="ml-1.5 normal-case tracking-normal text-indigo-600 font-bold">
                                        — {selected.size} selected
                                    </span>
                                )}
                            </label>
                            <div className="flex items-center gap-2">
                                {selectablePeople.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={toggleSelectAllFiltered}
                                        className="text-[11px] font-semibold text-indigo-600 hover:underline"
                                    >
                                        {allFilteredSelected ? 'Unselect all' : `Select all (${selectablePeople.length})`}
                                    </button>
                                )}
                                {selected.size > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => setSelected(new Map())}
                                        className="text-[11px] font-semibold text-rose-600 hover:underline"
                                    >
                                        Clear
                                    </button>
                                )}
                            </div>
                        </div>
                        <div className="relative mb-2">
                            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                autoFocus
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search by name…"
                                className="input pl-9"
                            />
                        </div>
                        <ul className="divide-y divide-slate-100 max-h-56 overflow-auto border border-slate-200 rounded-xl">
                            {selectablePeople.map((p) => {
                                const sel = selected.has(p.id)
                                return (
                                    <li key={p.id}>
                                        <button
                                            type="button"
                                            onClick={() => togglePerson(p)}
                                            className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 ${sel
                                                ? 'bg-indigo-50 text-indigo-900'
                                                : 'hover:bg-slate-50 text-slate-800'
                                                }`}
                                        >
                                            <span
                                                className={`w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 ${sel
                                                    ? 'bg-indigo-600 border-indigo-600 text-white'
                                                    : 'border-slate-300 bg-white'
                                                    }`}
                                            >
                                                {sel && <CheckCircle2 size={13} />}
                                            </span>
                                            <span className="truncate font-medium flex-1">{p.name}</span>
                                        </button>
                                    </li>
                                )
                            })}
                            {selectablePeople.length === 0 && (
                                <li className="px-3 py-4 text-center text-sm text-slate-400">
                                    {filteredPeople.length > 0
                                        ? 'Everyone matching is already checked in for this date & meeting.'
                                        : 'No matches.'}
                                </li>
                            )}
                        </ul>
                    </div>

                    {/* Meeting */}
                    <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">
                            Meeting
                        </label>
                        <div className="grid grid-cols-2 gap-1.5 bg-slate-100 rounded-xl p-1">
                            {MEETINGS.map((m) => {
                                const active = meeting === m.id
                                return (
                                    <button
                                        key={m.id}
                                        type="button"
                                        onClick={() => setMeeting(m.id)}
                                        className={`px-2 py-2 rounded-lg text-xs font-semibold transition-colors leading-tight ${active
                                            ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow'
                                            : 'text-slate-600 hover:bg-white'
                                            }`}
                                    >
                                        {m.label}
                                        <span className={`block text-[10px] font-normal ${active ? 'text-white/80' : 'text-slate-400'}`}>
                                            {m.dayOfWeek == null ? m.dayName : `${m.dayName}s`}
                                        </span>
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    {/* Date + Time */}
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">
                                Date
                            </label>
                            <input
                                type="date"
                                value={date}
                                min={PROJECT_START}
                                max={today}
                                onChange={(e) => setDate(e.target.value)}
                                className="input w-full"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">
                                Time
                            </label>
                            <input
                                type="time"
                                value={time}
                                onChange={(e) => { setTime(e.target.value); setTimeTouched(true) }}
                                className="input w-full"
                            />
                        </div>
                    </div>

                    {/* Status hints */}
                    <div className="space-y-1.5 text-xs">
                        {time && cutoff && (
                            <div className={`flex items-center gap-1.5 font-semibold ${isLate ? 'text-orange-600' : 'text-emerald-600'}`}>
                                {isLate ? <Clock size={13} /> : <CheckCircle2 size={13} />}
                                Will count as {isLate ? `Late (after ${cutoff} cutoff)` : 'Attended (on time)'}
                            </div>
                        )}
                        {offSchedule && (
                            <div className="flex items-start gap-1.5 text-sky-700">
                                <CalendarDays size={13} className="mt-0.5 flex-shrink-0" />
                                <span>
                                    {meetingLabel(meeting)} does not normally occur on this date —
                                    it will show as an off-schedule check-in.
                                </span>
                            </div>
                        )}
                        {futureDate && (
                            <div className="flex items-center gap-1.5 text-rose-600 font-semibold">
                                <AlertCircle size={13} /> Future dates are not allowed.
                            </div>
                        )}
                        {beforeStart && (
                            <div className="flex items-center gap-1.5 text-rose-600 font-semibold">
                                <AlertCircle size={13} /> Dates before the project start ({PROJECT_START}) are not allowed.
                            </div>
                        )}
                        {error && (
                            <div className="flex items-center gap-1.5 text-rose-600 font-semibold">
                                <AlertCircle size={13} /> {error}
                            </div>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-1">
                        <button onClick={() => !busy && onClose?.()} className="btn btn-ghost flex-1">
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={!canSave}
                            className="btn btn-primary flex-1"
                        >
                            {busy ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
                            {busy ? 'Saving…' : 'Add attendance'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
