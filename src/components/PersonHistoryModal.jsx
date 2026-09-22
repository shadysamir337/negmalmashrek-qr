import { useEffect, useMemo, useState } from 'react'
import {
    X,
    CalendarDays,
    Clock,
    CheckCircle2,
    XCircle,
    Flame,
    User,
} from 'lucide-react'
import {
    cairoDateStr,
    cairoYear,
    longDayName,
    daysOfYear,
    getDatesBetween,
    msFromTimestamp,
} from '../utils/dateUtils.js'
import {
    MEETINGS,
    MEETINGS_BY_ID,
    PROJECT_START,
    meetingDatesOfYear,
    meetingLabel,
} from '../utils/meetings.js'
import { subscribeEvents } from '../services/firestoreService.js'
import { SkeletonLine } from './Skeleton.jsx'

export default function PersonHistoryModal({
    person,
    records,
    onClose,
    loading = false,
}) {
    const [year, setYear] = useState(cairoYear())
    // 'all' or a meeting id — scopes the rate, heatmap, and scan list.
    const [meetingFilter, setMeetingFilter] = useState('all')
    const [events, setEvents] = useState([])

    useEffect(() => {
        const unsub = subscribeEvents((data) => setEvents(data))
        return () => unsub()
    }, [])

    useEffect(() => {
        function onKey(e) {
            if (e.key === 'Escape') onClose?.()
        }
        const prev = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        window.addEventListener('keydown', onKey)
        return () => {
            window.removeEventListener('keydown', onKey)
            document.body.style.overflow = prev
        }
    }, [onClose])

    const personRecords = useMemo(
        () => records.filter((r) => r.personId === person.id),
        [records, person.id]
    )

    const stats = useMemo(
        () => computePersonStats(person, personRecords, year, events, meetingFilter),
        [person, personRecords, year, events, meetingFilter]
    )

    const scopeLabel =
        meetingFilter === 'all' ? 'All meetings' : meetingLabel(meetingFilter)

    const yearOptions = useMemo(() => {
        const cur = cairoYear()
        let earliest = cur
        for (const r of personRecords) {
            const y = parseInt(String(r.date).slice(0, 4), 10)
            if (y && y < earliest) earliest = y
        }
        const out = []
        for (let y = cur; y >= earliest; y--) out.push(y)
        return out
    }, [personRecords])

    return (
        <div
            className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4"
            onClick={onClose}
        >
            <div className="modal-backdrop animate-fade-in" />
            <div
                className="modal-sheet modal-lg"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="sheet-grabber" />

                {/* Header */}
                <div className="px-4 py-3 sm:px-5 sm:py-4 border-b border-slate-200/80 flex items-center gap-2 sm:gap-3 bg-gradient-to-r from-indigo-50/60 via-violet-50/40 to-transparent">
                    <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-md flex-shrink-0">
                        <User size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-base sm:text-lg truncate">
                            {person.name}
                        </h3>
                        <p className="text-xs text-slate-500">Attendance history</p>
                    </div>
                    <select
                        value={year}
                        onChange={(e) => setYear(parseInt(e.target.value, 10))}
                        className="text-xs font-semibold bg-white border border-slate-200 hover:border-indigo-300 rounded-lg px-2.5 py-2 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                    >
                        {yearOptions.map((y) => (
                            <option key={y} value={y}>
                                {y}
                            </option>
                        ))}
                    </select>
                    <button
                        onClick={onClose}
                        className="w-9 h-9 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500"
                        aria-label="Close"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="overflow-auto p-3 sm:p-5 space-y-4 flex-1">
                    {loading ? (
                        <div className="space-y-3">
                            <SkeletonLine className="w-1/2" />
                            <SkeletonLine className="w-2/3" />
                            <SkeletonLine className="w-3/4" />
                        </div>
                    ) : (
                        <>
                            {/* Meeting filter */}
                            <div className="flex flex-wrap gap-1.5">
                                {[{ id: 'all', short: 'All' }, ...MEETINGS].map((m) => {
                                    const active = meetingFilter === m.id
                                    return (
                                        <button
                                            key={m.id}
                                            type="button"
                                            onClick={() => setMeetingFilter(m.id)}
                                            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${active
                                                ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow'
                                                : 'bg-white text-slate-600 border border-slate-200 hover:bg-indigo-50'
                                                }`}
                                            title={m.id === 'all' ? 'All meetings' : m.label}
                                        >
                                            {m.short}
                                        </button>
                                    )
                                })}
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                                <StatTile
                                    label="Rate"
                                    value={`${stats.percentage}%`}
                                    sub={scopeLabel}
                                    color={
                                        stats.percentage >= 80
                                            ? 'emerald'
                                            : stats.percentage >= 50
                                                ? 'amber'
                                                : 'rose'
                                    }
                                    icon={CalendarDays}
                                />
                                <StatTile
                                    label="Attended"
                                    value={stats.attendedMeetings}
                                    sub={`out of ${stats.totalMeetings}`}
                                    color="emerald"
                                    icon={CheckCircle2}
                                />
                                <StatTile
                                    label="Absent"
                                    value={stats.absentMeetings}
                                    sub="meetings missed"
                                    color="rose"
                                    icon={XCircle}
                                />
                                <StatTile
                                    label="Events"
                                    value={stats.totalEvents}
                                    sub={`${stats.missedEvents} missed`}
                                    color="indigo"
                                    icon={Flame}
                                />
                            </div>

                            <Heatmap year={year} attendedSet={stats.attendedSet} eligibleSet={stats.eligibleSet} validDaysSet={stats.validDaysSet} />

                            <ScanAbsenceTabs stats={stats} year={year} />
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}

function ScanAbsenceTabs({ stats, year }) {
    const [activeTab, setActiveTab] = useState('attendance')

    return (
        <div>
            {/* Tab header */}
            <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1 mb-3">
                <button
                    type="button"
                    onClick={() => setActiveTab('attendance')}
                    className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                        activeTab === 'attendance'
                            ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow'
                            : 'text-slate-600 hover:bg-white'
                    }`}
                >
                    <span className="inline-flex items-center gap-1.5">
                        <CheckCircle2 size={13} />
                        Attendance ({stats.scansForYear.length})
                    </span>
                </button>
                <button
                    type="button"
                    onClick={() => setActiveTab('absence')}
                    className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                        activeTab === 'absence'
                            ? 'bg-gradient-to-r from-rose-600 to-rose-500 text-white shadow'
                            : 'text-slate-600 hover:bg-white'
                    }`}
                >
                    <span className="inline-flex items-center gap-1.5">
                        <XCircle size={13} />
                        Absence ({stats.absentDates.length})
                    </span>
                </button>
            </div>

            {/* Tab content */}
            {activeTab === 'attendance' ? (
                stats.scansForYear.length === 0 ? (
                    <div className="text-sm text-slate-500 text-center py-8 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                        No scans yet for {year}.
                    </div>
                ) : (
                    <div className="space-y-1.5 max-h-60 overflow-auto">
                        {stats.scansForYear.slice(0, 50).map((r) => (
                            <div
                                key={r.id}
                                className="flex items-center gap-2 text-sm border border-slate-100 bg-white rounded-lg px-3 py-2 hover:border-emerald-200 transition-colors"
                            >
                                <CheckCircle2
                                    size={14}
                                    className="text-emerald-500 flex-shrink-0"
                                />
                                <span className="font-medium tabular-nums">
                                    {r.date}
                                </span>
                                <span className="text-slate-400 text-xs hidden sm:inline">
                                    · {dayName(r.date)}
                                </span>
                                <span className="text-indigo-500 text-xs font-semibold">
                                    {MEETINGS_BY_ID[r.type]?.short ?? r.type ?? 'Off-schedule'}
                                </span>
                                <span className="ml-auto inline-flex items-center gap-1 text-xs text-slate-500 tabular-nums">
                                    <Clock size={11} /> {r.time}
                                </span>
                            </div>
                        ))}
                        {stats.scansForYear.length > 50 && (
                            <div className="text-center text-xs text-slate-500 pt-1">
                                +{stats.scansForYear.length - 50} earlier scans
                            </div>
                        )}
                    </div>
                )
            ) : (
                stats.absentDates.length === 0 ? (
                    <div className="text-sm text-slate-500 text-center py-8 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                        No absences for {year} 🎉
                    </div>
                ) : (
                    <div className="space-y-1.5 max-h-60 overflow-auto">
                        {stats.absentDates.slice(0, 50).map((a) => (
                            <div
                                key={`${a.date}_${a.type}`}
                                className="flex items-center gap-2 text-sm border border-rose-100 bg-rose-50/40 rounded-lg px-3 py-2 hover:border-rose-300 transition-colors"
                            >
                                <XCircle
                                    size={14}
                                    className="text-rose-500 flex-shrink-0"
                                />
                                <span className="font-medium tabular-nums">
                                    {a.date}
                                </span>
                                <span className="text-slate-400 text-xs hidden sm:inline">
                                    · {dayName(a.date)}
                                </span>
                                <span className="text-rose-500 text-xs font-semibold">
                                    {MEETINGS_BY_ID[a.type]?.short ?? a.type ?? 'Meeting'}
                                </span>
                            </div>
                        ))}
                        {stats.absentDates.length > 50 && (
                            <div className="text-center text-xs text-slate-500 pt-1">
                                +{stats.absentDates.length - 50} more absences
                            </div>
                        )}
                    </div>
                )
            )}
        </div>
    )
}

function StatTile({ label, value, sub, color, icon: Icon }) {
    const PALETTE = {
        emerald: { bg: 'from-emerald-50 to-emerald-100/60', text: 'text-emerald-700', icon: 'text-emerald-600', ring: 'ring-emerald-200/60' },
        rose: { bg: 'from-rose-50 to-rose-100/60', text: 'text-rose-700', icon: 'text-rose-600', ring: 'ring-rose-200/60' },
        indigo: { bg: 'from-indigo-50 to-indigo-100/60', text: 'text-indigo-700', icon: 'text-indigo-600', ring: 'ring-indigo-200/60' },
        amber: { bg: 'from-amber-50 to-amber-100/60', text: 'text-amber-700', icon: 'text-amber-600', ring: 'ring-amber-200/60' },
    }
    const p = PALETTE[color] || PALETTE.indigo
    return (
        <div className={`bg-gradient-to-br ${p.bg} ring-1 ${p.ring} rounded-xl p-3`}>
            <div className="flex items-center gap-1.5">
                {Icon && <Icon size={14} className={p.icon} />}
                <span className="text-[10px] font-bold uppercase tracking-wide text-slate-600">
                    {label}
                </span>
            </div>
            <div className={`text-2xl font-bold mt-1 tabular-nums ${p.text}`}>
                {value}
            </div>
            {sub && <div className="text-[10px] text-slate-500">{sub}</div>}
        </div>
    )
}

function Heatmap({ year, attendedSet, eligibleSet, validDaysSet }) {
    const { weeks, monthLabels } = useMemo(() => {
        const all = daysOfYear(year)
        const weeks = []
        let curWeek = Array(7).fill(null)
        for (const iso of all) {
            const [y, m, d] = iso.split('-').map((s) => parseInt(s, 10))
            const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
            curWeek[dow] = iso
            if (dow === 6) {
                weeks.push(curWeek)
                curWeek = Array(7).fill(null)
            }
        }
        if (curWeek.some(Boolean)) weeks.push(curWeek)

        const MONTHS = [
            'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
            'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
        ]
        const monthLabels = weeks.map(() => '')
        const seen = new Set()
        weeks.forEach((week, wi) => {
            for (const iso of week) {
                if (!iso) continue
                const monthIdx = parseInt(iso.slice(5, 7), 10) - 1
                if (!seen.has(monthIdx)) {
                    seen.add(monthIdx)
                    monthLabels[wi] = MONTHS[monthIdx]
                    break
                }
            }
        })
        return { weeks, monthLabels }
    }, [year])

    const WEEKDAY_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', '']

    return (
        <div className="card-flat p-3">
            <div className="flex items-baseline justify-between mb-2 gap-2 flex-wrap">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                    Activity in {year}
                </h4>
                <p className="text-[11px] text-slate-500">
                    Each square is a day · hover for date
                </p>
            </div>

            <div className="overflow-x-auto pb-1">
                <div className="inline-flex flex-col">
                    <div className="flex pl-[34px] mb-1">
                        {monthLabels.map((label, wi) => (
                            <div
                                key={wi}
                                style={{ width: 12, marginRight: 3 }}
                                className="text-[9px] font-semibold text-slate-400 leading-none"
                            >
                                {label}
                            </div>
                        ))}
                    </div>

                    <div className="flex gap-1">
                        <div
                            className="flex flex-col gap-[3px] pr-1 text-[9px] font-semibold text-slate-400 select-none"
                            aria-hidden="true"
                        >
                            {WEEKDAY_LABELS.map((d, i) => (
                                <div key={i} style={{ height: 12, lineHeight: '12px' }}>
                                    {d}
                                </div>
                            ))}
                        </div>

                        <div className="inline-flex gap-[3px]">
                            {weeks.map((week, wi) => (
                                <div key={wi} className="flex flex-col gap-[3px]">
                                    {week.map((iso, di) =>
                                        iso ? (
                                            <div
                                                key={di}
                                                className={`w-3 h-3 rounded-[3px] transition-transform hover:scale-125 ${attendedSet.has(iso) && validDaysSet.has(iso)
                                                    ? 'bg-emerald-500'
                                                    : eligibleSet.has(iso)
                                                        ? 'bg-slate-400'
                                                        : 'bg-slate-100'
                                                    }`}
                                                title={
                                                    attendedSet.has(iso) && validDaysSet.has(iso)
                                                        ? `${iso} · ✓ attended`
                                                        : eligibleSet.has(iso)
                                                            ? `${iso} · absent`
                                                            : `${iso} · no requirement`
                                                }
                                            />
                                        ) : (
                                            <div key={di} className="w-3 h-3" />
                                        )
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-600 mt-2">
                <span className="inline-flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-[3px] bg-emerald-500" />
                    <span>Attended</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-[3px] bg-slate-400" />
                    <span>Missed meeting/event</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-[3px] bg-slate-100 border border-slate-200" />
                    <span>No requirement</span>
                </span>
            </div>
        </div>
    )
}

function dayName(iso) {
    const [y, m, d] = iso.split('-').map((s) => parseInt(s, 10))
    return longDayName(y, m, d)
}

function computePersonStats(person, personRecords, year, events = [], meetingFilter = 'all') {
    const yearStart = `${year}-01-01`
    const yearEnd = `${year}-12-31`
    const today = cairoDateStr()

    const createdMs = msFromTimestamp(person.createdAt)
    const createdIso = createdMs ? cairoDateStr(new Date(createdMs)) : null
    // Nothing before the project start — or before the person was added —
    // counts toward any rate.
    const startBound =
        createdIso && createdIso > PROJECT_START ? createdIso : PROJECT_START

    const meetingIds =
        meetingFilter === 'all' ? MEETINGS.map((m) => m.id) : [meetingFilter]
    // Weekly meetings (sunday/NegmAlMashrek/service). Events have no fixed weekday —
    // their occurrences come from the /events collection, handled separately.
    const scheduledIds = meetingIds.filter((id) => MEETINGS_BY_ID[id]?.dayOfWeek != null)
    const eventsInScope = meetingIds.includes('events')

    // ----- in-scope scans (filtered to the selected meeting types) -----
    // attendedSlots: `${date}|${type}` keys for the scheduled rate.
    // scanDatesAll: every date the person scanned this year, ANY type — used
    // for event attendance (people scan special events under the Events type,
    // but we also credit any scan landing on an event day).
    const attendedSlots = new Set()
    const scanDatesAll = new Set()
    const scansForYear = []
    for (const r of personRecords) {
        if (r.date < yearStart || r.date > yearEnd) continue
        scanDatesAll.add(r.date)
        if (!meetingIds.includes(r.type)) continue
        attendedSlots.add(`${r.date}|${r.type}`)
        scansForYear.push(r)
    }
    scansForYear.sort((a, b) =>
        a.date === b.date ? b.time.localeCompare(a.time) : b.date.localeCompare(a.date)
    )

    // Counted attendance/expected drive both the numbers and the heatmap, so
    // they always agree. A day counts as expected once it's finalised (before
    // today); today only counts if the person actually attended — we never
    // mark someone absent for a meeting that may still be happening.
    const requiredDates = new Set()       // expected days → grey if missed
    const attendedDatesGreen = new Set()  // counted attendance → green
    function consider(date, attendedHere) {
        if (date < startBound || date > today) return
        if (date < yearStart || date > yearEnd) return
        if (date === today && !attendedHere) return
        requiredDates.add(date)
        if (attendedHere) attendedDatesGreen.add(date)
    }

    // ----- scheduled meetings -----
    let scheduledAttended = 0
    let scheduledTotal = 0
    for (const id of scheduledIds) {
        for (const d of meetingDatesOfYear(year, id)) {
            const attendedHere = attendedSlots.has(`${d}|${id}`)
            if (d < startBound || d > today) continue
            if (d === today && !attendedHere) continue
            scheduledTotal++
            if (attendedHere) scheduledAttended++
            consider(d, attendedHere)
        }
    }

    // ----- events (occurrences from the /events collection) -----
    const eventDaysAll = [...new Set(
        events.flatMap((e) => getDatesBetween(e.date, e.endDate || e.date))
    )].sort()
    let eventAttended = 0
    let eventTotal = 0
    for (const d of eventDaysAll) {
        if (!d.startsWith(String(year))) continue
        const attendedHere = scanDatesAll.has(d)
        if (d < startBound || d > today) continue
        if (d === today && !attendedHere) continue
        eventTotal++
        if (attendedHere) eventAttended++
        if (eventsInScope) consider(d, attendedHere) // show on heatmap when events selected
    }
    const missedEvents = eventTotal - eventAttended

    // Main Rate / Attended / Absent tiles: events tab → event numbers;
    // every other scope → scheduled-meeting numbers (events shown separately).
    const useEvents = meetingFilter === 'events'
    const attendedMeetings = useEvents ? eventAttended : scheduledAttended
    const totalMeetings = useEvents ? eventTotal : scheduledTotal
    const absentMeetings = totalMeetings - attendedMeetings
    const percentage = totalMeetings === 0 ? 0 : Math.round((attendedMeetings / totalMeetings) * 100)

    // Build the list of absent dates with their meeting types, sorted newest-first.
    const absentDates = []
    for (const id of scheduledIds) {
        for (const d of meetingDatesOfYear(year, id)) {
            if (d < startBound || d > today) continue
            if (d === today) continue
            if (!attendedSlots.has(`${d}|${id}`)) {
                absentDates.push({ date: d, type: id })
            }
        }
    }
    if (eventsInScope) {
        for (const d of eventDaysAll) {
            if (!d.startsWith(String(year))) continue
            if (d < startBound || d > today) continue
            if (d === today) continue
            if (!scanDatesAll.has(d)) {
                absentDates.push({ date: d, type: 'events' })
            }
        }
    }
    absentDates.sort((a, b) => b.date.localeCompare(a.date))

    return {
        percentage,
        attendedMeetings,
        totalMeetings,
        absentMeetings,
        totalEvents: eventTotal,
        attendedEvents: eventAttended,
        missedEvents,
        // Heatmap: green = counted attendance, grey = expected-but-missed.
        attendedSet: attendedDatesGreen,
        eligibleSet: requiredDates,
        validDaysSet: requiredDates,
        scansForYear,
        absentDates,
    }
}

