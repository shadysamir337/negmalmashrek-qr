import { useEffect, useMemo, useRef, useState } from 'react'
import {
    BarChart3,
    Calendar,
    FileSpreadsheet,
    Trash2,
    Loader2,
    FolderArchive,
    Download,
    RefreshCw,
    X,
    ChevronRight,
    CheckCircle2,
    XCircle,
    Clock,
    UserPlus,
    CheckSquare,
    Square,
    AlertCircle,
} from 'lucide-react'
import {
    subscribeAttendance,
    subscribePeople,
    clearAttendance,
    deleteAttendance,
    subscribeArchives,
    archiveYear,
    getArchivedRecords,
    reArchiveYear,
    getArchiveSummary,
} from '../services/firestoreService.js'
import {
    exportAttendanceToExcel,
    exportRosterToExcel,
    exportMultiDayRoster,
    exportYearArchive,
} from '../utils/excel.js'
import {
    cairoDateStr,
    cairoYear,
    MONTH_NAMES,
    monthName,
    weeksOfMonth,
    daysOfMonth,
    daysOfYear,
    longDayName,
} from '../utils/dateUtils.js'
import {
    MEETINGS,
    MEETINGS_BY_ID,
    COMBINED_TAB,
    isMeetingDate,
    meetingLabel,
} from '../utils/meetings.js'
import { buildRosterForDay } from '../utils/roster.js'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import AddAttendanceModal from '../components/AddAttendanceModal.jsx'
import { useAuth } from '../context/AuthContext.jsx'

const LS_LAST_SEEN_YEAR = 'qrAttendance.lastSeenCairoYear'

function isoDaysAgo(n) {
    const d = new Date()
    d.setDate(d.getDate() - n)
    return cairoDateStr(d)
}

export default function RecordsPage() {
    const { isAdmin, lateCutoffs } = useAuth()

    const [records, setRecords] = useState([])
    const [people, setPeople] = useState([])
    const [loading, setLoading] = useState(true)
    const [filterDate, setFilterDate] = useState('')
    // Which meeting's report is shown: a meeting id, or COMBINED_TAB for all.
    const [meetingTab, setMeetingTab] = useState(MEETINGS[0].id)
    const [busy, setBusy] = useState(false)
    const [message, setMessage] = useState(null)

    // Drill-down navigation (browse only — does NOT filter the bottom list).
    const [drillYear, setDrillYear] = useState(null)
    const [drillMonth, setDrillMonth] = useState(null) // 1..12
    const [drillWeek, setDrillWeek] = useState(null)   // index into weeksOfMonth(...)

    // Multi-select set of "YYYY-MM-DD" strings. Toggling chips updates this.
    const [selectedDays, setSelectedDays] = useState(() => new Set())
    // When ON, every chip click toggles all its days. When OFF (default),
    // year/month/week chips only navigate; day chips toggle single day.
    const [multiSelect, setMultiSelect] = useState(false)

    // Archives modal.
    const [archives, setArchives] = useState([])
    const [archivesOpen, setArchivesOpen] = useState(false)
    const [archiveBusy, setArchiveBusy] = useState(null)
    const [confirmReArchive, setConfirmReArchive] = useState(null)

    // Admin "Add attendance" modal: null | { day, meetingId }.
    const [addTarget, setAddTarget] = useState(null)

    // Admin "delete record" confirm: null | { id, name, date, type }.
    const [confirmDelete, setConfirmDelete] = useState(null)
    const [deleteBusy, setDeleteBusy] = useState(false)

    const autoArchiveDoneRef = useRef(false)

    // Live subscriptions.
    useEffect(() => {
        const unsub = subscribeAttendance((items) => {
            setRecords(items)
            setLoading(false)
        })
        return () => unsub && unsub()
    }, [])

    useEffect(() => {
        const unsub = subscribePeople((items) => setPeople(items))
        return () => unsub && unsub()
    }, [])

    useEffect(() => {
        const unsub = subscribeArchives((items) => setArchives(items))
        return () => unsub && unsub()
    }, [])

    // Auto-archive at year change (admin only).
    useEffect(() => {
        if (autoArchiveDoneRef.current) return
        if (!isAdmin) return

        const currentYear = cairoYear()
        const lastSeenRaw = localStorage.getItem(LS_LAST_SEEN_YEAR)
        const lastSeen = lastSeenRaw ? parseInt(lastSeenRaw, 10) : null

        if (!lastSeen || isNaN(lastSeen)) {
            localStorage.setItem(LS_LAST_SEEN_YEAR, String(currentYear))
            autoArchiveDoneRef.current = true
            return
        }
        if (lastSeen >= currentYear) {
            autoArchiveDoneRef.current = true
            return
        }
        autoArchiveDoneRef.current = true
            ; (async () => {
                try {
                    for (let y = lastSeen; y < currentYear; y++) {
                        const existing = await getArchiveSummary(y)
                        if (!existing) {
                            const res = await archiveYear(y)
                            showMessage(
                                `Auto-archived ${res.totalScans} record${res.totalScans === 1 ? '' : 's'} for ${y} → Archives`,
                                'success'
                            )
                        }
                    }
                    localStorage.setItem(LS_LAST_SEEN_YEAR, String(currentYear))
                } catch (err) {
                    // eslint-disable-next-line no-console
                    console.error('[archive] auto-archive failed:', err)
                    showMessage('Auto-archive failed: ' + (err.message || err), 'error')
                }
            })()
    }, [isAdmin])

    function showMessage(text, type = 'info') {
        setMessage({ text, type })
        setTimeout(() => setMessage(null), 4000)
    }

    // ---------- selection helpers ----------

    function toggleDays(daysArr, forceState) {
        setSelectedDays((prev) => {
            const next = new Set(prev)
            // If `forceState` is omitted, infer based on whether ALL given days are
            // already selected. (true -> remove, false/missing -> add).
            const allOn =
                forceState === undefined
                    ? daysArr.every((d) => next.has(d))
                    : null
            const removing = forceState === true ? false : forceState === false ? true : !allOn
            // Above `removing` is awkward — clearer:
            // - forceState === true   -> set add (selected = true)
            // - forceState === false  -> remove
            // - undefined: if all currently selected, remove; else add
            const finalAdd =
                forceState === undefined ? !allOn : forceState
            for (const d of daysArr) {
                if (finalAdd) next.add(d)
                else next.delete(d)
            }
            return next
        })
    }

    function toggleSingleDay(day) {
        setSelectedDays((prev) => {
            const next = new Set(prev)
            if (next.has(day)) next.delete(day)
            else next.add(day)
            return next
        })
    }

    function clearSelection() {
        setSelectedDays(new Set())
    }

    // ---------- meeting tab ----------

    // Records visible under the active tab. Every count/list below derives
    // from this so a meeting tab never mixes in another meeting's scans.
    const tabRecords = useMemo(
        () =>
            meetingTab === COMBINED_TAB
                ? records
                : records.filter((r) => r.type === meetingTab),
        [records, meetingTab]
    )

    function switchMeetingTab(tab) {
        if (tab === meetingTab) return
        setMeetingTab(tab)
        // Roster semantics change per meeting — reset the selection so the
        // user doesn't carry over days picked under another tab.
        setSelectedDays(new Set())
        setFilterDate('')
        setDrillMonth(null)
        setDrillWeek(null)
    }

    // ---------- year/month/week meta for chip badges ----------

    const yearsToShow = useMemo(() => {
        const cur = cairoYear()
        let start = cur
        for (const r of tabRecords) {
            const y = parseInt(String(r.date).slice(0, 4), 10)
            if (y && y < start) start = y
        }
        const out = []
        for (let y = start; y <= cur; y++) out.push(y)
        return out
    }, [tabRecords])

    // Counts of scans per year/month/week/day.
    const countsByYear = useMemo(() => {
        const map = {}
        for (const r of tabRecords) {
            const y = String(r.date).slice(0, 4)
            map[y] = (map[y] || 0) + 1
        }
        return map
    }, [tabRecords])

    const countsByMonth = useMemo(() => {
        if (!drillYear) return {}
        const out = {}
        for (let m = 1; m <= 12; m++) out[m] = 0
        for (const r of tabRecords) {
            if (String(r.date).slice(0, 4) !== String(drillYear)) continue
            const m = parseInt(String(r.date).slice(5, 7), 10)
            if (m >= 1 && m <= 12) out[m]++
        }
        return out
    }, [tabRecords, drillYear])

    const weeksList = useMemo(() => {
        if (!drillYear || !drillMonth) return []
        return weeksOfMonth(drillYear, drillMonth)
    }, [drillYear, drillMonth])

    const countsByWeek = useMemo(() => {
        if (!weeksList.length) return {}
        const out = {}
        const recordsByDate = {}
        for (const r of tabRecords) {
            recordsByDate[r.date] = (recordsByDate[r.date] || 0) + 1
        }
        weeksList.forEach((w) => {
            out[w.index] = w.dates.reduce((acc, d) => acc + (recordsByDate[d] || 0), 0)
        })
        return out
    }, [weeksList, tabRecords])

    const daysInActiveWeek = useMemo(() => {
        if (!drillWeek) return []
        const w = weeksList.find((x) => x.index === drillWeek)
        return w ? w.dates : []
    }, [weeksList, drillWeek])

    const countsByDay = useMemo(() => {
        const map = {}
        for (const r of tabRecords) {
            map[r.date] = (map[r.date] || 0) + 1
        }
        return map
    }, [tabRecords])

    // Selection counts per parent (for partial-fill badges on year/month/week chips).
    const selectionCounts = useMemo(() => {
        const yearTotal = {}
        const yearSelected = {}
        const monthTotal = {}
        const monthSelected = {}
        for (const y of yearsToShow) {
            const days = daysOfYear(y)
            yearTotal[y] = days.length
            yearSelected[y] = days.reduce((n, d) => n + (selectedDays.has(d) ? 1 : 0), 0)
        }
        if (drillYear) {
            for (let m = 1; m <= 12; m++) {
                const days = daysOfMonth(drillYear, m)
                monthTotal[m] = days.length
                monthSelected[m] = days.reduce((n, d) => n + (selectedDays.has(d) ? 1 : 0), 0)
            }
        }
        const weekTotal = {}
        const weekSelected = {}
        for (const w of weeksList) {
            weekTotal[w.index] = w.dates.length
            weekSelected[w.index] = w.dates.reduce(
                (n, d) => n + (selectedDays.has(d) ? 1 : 0),
                0
            )
        }
        return { yearTotal, yearSelected, monthTotal, monthSelected, weekTotal, weekSelected }
    }, [yearsToShow, drillYear, weeksList, selectedDays])

    // ---------- roster computation ----------

    // For each selected day, compute Attended/Late/Absent/Added later — one
    // roster per (day, meeting). On a meeting tab that's one roster per day;
    // on the combined tab each day yields a roster for every meeting that is
    // scheduled that weekday (Friday → Church Service + Friday Meeting) plus
    // any meeting with off-schedule override scans on that date.
    const daysData = useMemo(() => {
        if (selectedDays.size === 0) return []
        const sorted = Array.from(selectedDays).sort()
        if (meetingTab !== COMBINED_TAB) {
            return sorted.map((day) =>
                buildRosterForDay(day, records, people, {
                    meetingId: meetingTab,
                    lateCutoff: lateCutoffs[meetingTab],
                })
            )
        }
        const out = []
        for (const day of sorted) {
            for (const m of MEETINGS) {
                const scheduled = isMeetingDate(m.id, day)
                const hasScans = records.some((r) => r.date === day && r.type === m.id)
                if (!scheduled && !hasScans) continue
                out.push(
                    buildRosterForDay(day, records, people, {
                        meetingId: m.id,
                        lateCutoff: lateCutoffs[m.id],
                    })
                )
            }
        }
        return out
    }, [selectedDays, records, people, meetingTab, lateCutoffs])

    // Master totals across selected days.
    const totals = useMemo(() => {
        let attended = 0
        let absent = 0
        let addedLater = 0
        let late = 0
        for (const d of daysData) {
            attended += d.attended.length
            absent += d.absent.length
            addedLater += d.addedLater.length
            if (d.late) late += d.late.length
        }
        return { attended, absent, addedLater, late, total: attended + absent + addedLater + late }
    }, [daysData])

    // Quick-filter (Today/Yesterday/All/date picker) is independent from
    // multi-select. If the user picks the date input, we treat that as a
    // SINGLE-day selection.
    useEffect(() => {
        if (filterDate) {
            setSelectedDays(new Set([filterDate]))
        }
    }, [filterDate])

    // ---------- exports ----------

    function handleExport() {
        const suffix = meetingTab === COMBINED_TAB ? 'all-meetings' : meetingTab
        // Multiple rosters (multi-day, or a combined-tab Friday with two
        // meetings) → multi-tab workbook.
        if (daysData.length >= 2) {
            const first = daysData[0].day
            const last = daysData[daysData.length - 1].day
            const name =
                first === last
                    ? `roster-${suffix}-${first}.xlsx`
                    : `roster-${suffix}-${first}_to_${last}.xlsx`
            exportMultiDayRoster(daysData, people, name)
            showMessage(`Exported ${selectedDays.size} day${selectedDays.size === 1 ? '' : 's'} ✓`, 'success')
            return
        }
        // Single roster → roster file.
        if (daysData.length === 1) {
            const day = daysData[0].day
            exportRosterToExcel(daysData[0], `roster-${suffix}-${day}.xlsx`)
            showMessage(`Exported roster for ${day} ✓`, 'success')
            return
        }
        if (selectedDays.size > 0) {
            showMessage('No meetings on the selected day(s)', 'error')
            return
        }
        // Nothing selected → flat scans for the active tab.
        if (!tabRecords.length) {
            showMessage('Nothing to export', 'error')
            return
        }
        exportAttendanceToExcel(tabRecords, `attendance-${cairoDateStr()}-${suffix}.xlsx`, {
            includeMeeting: meetingTab === COMBINED_TAB,
        })
        showMessage(`Exported ${tabRecords.length} records ✓`, 'success')
    }

    function handleClearFilter() {
        setFilterDate('')
        setSelectedDays(new Set())
        setDrillYear(cairoYear())
        setDrillMonth(null)
        setDrillWeek(null)
    }

    // ---------- delete a single record (admin) ----------

    // `rec` may come from the flat list (has id/name/date/type) or a roster row
    // (has recordId/name + we pass the day/meeting from context).
    function requestDeleteRecord(rec) {
        const id = rec.id || rec.recordId
        if (!id) return
        setConfirmDelete({ id, name: rec.name, date: rec.date, type: rec.type })
    }

    async function doDeleteRecord() {
        if (!confirmDelete) return
        setDeleteBusy(true)
        try {
            await deleteAttendance(confirmDelete.id)
            showMessage(`Removed ${confirmDelete.name}'s check-in`, 'success')
            setConfirmDelete(null)
        } catch (err) {
            showMessage(err.message || 'Delete failed', 'error')
        } finally {
            setDeleteBusy(false)
        }
    }

    // ---------- archive actions ----------

    async function downloadArchive(year) {
        setArchiveBusy(year)
        try {
            const recs = await getArchivedRecords(year)
            exportYearArchive(year, recs)
            showMessage(`Downloaded archive for ${year}`, 'success')
        } catch (err) {
            showMessage(err.message || 'Download failed', 'error')
        } finally {
            setArchiveBusy(null)
        }
    }

    async function doReArchive(year) {
        setArchiveBusy(year)
        try {
            const res = await reArchiveYear(year)
            showMessage(
                `Re-archived ${year}: ${res.totalScans} record${res.totalScans === 1 ? '' : 's'}`,
                'success'
            )
            setConfirmReArchive(null)
        } catch (err) {
            showMessage(err.message || 'Re-archive failed', 'error')
        } finally {
            setArchiveBusy(null)
        }
    }

    // ---------- chips: year/month/week ----------

    function selectYear(y) {
        setDrillYear(y)
        setDrillMonth(null)
        setDrillWeek(null)
    }
    function selectMonth(m) {
        setDrillMonth(m)
        setDrillWeek(null)
    }
    function selectWeek(idx) {
        setDrillWeek(idx)
    }

    function onYearChipClick(y, ev) {
        const wantsToggle =
            multiSelect || ev?.shiftKey || ev?.ctrlKey || ev?.metaKey
        if (wantsToggle) {
            const days = daysOfYear(y)
            const isAllOn = days.every((d) => selectedDays.has(d))
            toggleDays(days, !isAllOn)
        }
        // Always drill in so the user can keep narrowing.
        selectYear(y)
    }

    function onMonthChipClick(m, ev) {
        if (!drillYear) return
        const wantsToggle =
            multiSelect || ev?.shiftKey || ev?.ctrlKey || ev?.metaKey
        if (wantsToggle) {
            const days = daysOfMonth(drillYear, m)
            const isAllOn = days.every((d) => selectedDays.has(d))
            toggleDays(days, !isAllOn)
        }
        selectMonth(m)
    }

    function onWeekChipClick(w, ev) {
        const wantsToggle =
            multiSelect || ev?.shiftKey || ev?.ctrlKey || ev?.metaKey
        if (wantsToggle) {
            const days = w.dates
            const isAllOn = days.every((d) => selectedDays.has(d))
            toggleDays(days, !isAllOn)
        }
        selectWeek(w.index)
    }

    // Auto-select the current year on first load.
    useEffect(() => {
        if (drillYear === null) {
            setDrillYear(cairoYear())
        }
    }, [drillYear])

    const today = cairoDateStr()
    const yesterday = isoDaysAgo(1)

    // Most recent finalised (past) occurrence of the active meeting — one tap
    // jumps to its roster, which shows Attended / Late / Absent. Null on the
    // combined tab (no single meeting to resolve).
    const lastMeetingDay = useMemo(() => {
        if (meetingTab === COMBINED_TAB) return null
        const m = MEETINGS_BY_ID[meetingTab]
        if (!m) return null
        if (m.dayOfWeek == null) {
            // Events have no weekday — use the latest past date with scans.
            const past = tabRecords.map((r) => r.date).filter((d) => d < today)
            return past.length ? past.sort().slice(-1)[0] : null
        }
        for (let i = 1; i <= 28; i++) {
            const cand = isoDaysAgo(i)
            if (isMeetingDate(meetingTab, cand)) return cand
        }
        return null
    }, [meetingTab, tabRecords, today])

    function applyQuickDay(value) {
        if (!value) {
            // "All" — clear selection
            setSelectedDays(new Set())
            setFilterDate('')
            return
        }
        setFilterDate('')
        setSelectedDays(new Set([value]))
    }

    // Opening a specific meeting tab lands on its latest finalised meeting day,
    // so the roster (Attended / Late / Absent) shows straight away instead of
    // the raw scan log. The combined tab and the "All" chip keep the flat log.
    const tabDefaultRef = useRef(null)
    useEffect(() => {
        if (tabDefaultRef.current === meetingTab) return
        tabDefaultRef.current = meetingTab
        if (meetingTab === COMBINED_TAB) return
        if (lastMeetingDay) setSelectedDays(new Set([lastMeetingDay]))
    }, [meetingTab, lastMeetingDay])

    // Master button labels.
    const exportLabel =
        selectedDays.size >= 2
            ? `Export ${selectedDays.size} days`
            : selectedDays.size === 1
                ? 'Export roster'
                : 'Export Excel'

    // ---------- Render ----------

    return (
        <div className="space-y-4 animate-fade-in">
            {/* Header */}
            <div className="card p-4 sm:p-5">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-md">
                        <BarChart3 size={20} />
                    </div>
                    <div className="flex-1">
                        <h1 className="text-xl font-bold">Attendance Records</h1>
                        <p className="text-xs text-slate-500">
                            {tabRecords.length} {meetingTab === COMBINED_TAB ? 'total' : `for ${meetingLabel(meetingTab)}`} · Africa/Cairo time
                        </p>
                    </div>
                    <button
                        onClick={() => setArchivesOpen(true)}
                        className="btn btn-secondary"
                        title="Past-year archives"
                    >
                        <FolderArchive size={16} /> Archives
                        {archives.length > 0 && (
                            <span className="ml-1 inline-flex items-center justify-center min-w-5 h-5 text-[10px] font-bold rounded-full bg-indigo-600 text-white px-1.5">
                                {archives.length}
                            </span>
                        )}
                    </button>
                </div>

                {/* Meeting tabs */}
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-5 gap-1.5 bg-slate-100 rounded-xl p-1">
                    {[...MEETINGS.map((m) => ({ id: m.id, label: m.label })), { id: COMBINED_TAB, label: 'All (combined)' }].map((t) => {
                        const active = meetingTab === t.id
                        return (
                            <button
                                key={t.id}
                                type="button"
                                onClick={() => switchMeetingTab(t.id)}
                                className={`px-2 py-2 rounded-lg text-xs font-semibold transition-colors leading-tight last:col-span-2 sm:last:col-span-1 ${active
                                    ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow'
                                    : 'text-slate-600 hover:bg-white'
                                    }`}
                            >
                                {t.label}
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* Quick controls */}
            <div className="card p-4 space-y-3">
                <div className="flex flex-wrap gap-2 items-center">
                    <QuickChip
                        label="All"
                        active={selectedDays.size === 0 && !filterDate}
                        onClick={() => applyQuickDay('')}
                    />
                    <QuickChip
                        label="Today"
                        active={selectedDays.size === 1 && selectedDays.has(today)}
                        onClick={() => applyQuickDay(today)}
                    />
                    <QuickChip
                        label="Yesterday"
                        active={selectedDays.size === 1 && selectedDays.has(yesterday)}
                        onClick={() => applyQuickDay(yesterday)}
                    />
                    {lastMeetingDay && (
                        <QuickChip
                            label={`Last ${MEETINGS_BY_ID[meetingTab].short} (${lastMeetingDay.slice(5)})`}
                            active={selectedDays.size === 1 && selectedDays.has(lastMeetingDay)}
                            onClick={() => applyQuickDay(lastMeetingDay)}
                        />
                    )}
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                    <div className="relative flex-1">
                        <Calendar
                            size={16}
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                        />
                        <input
                            type="date"
                            value={filterDate}
                            onChange={(e) => setFilterDate(e.target.value)}
                            className="input pl-9 w-full"
                        />
                    </div>
                    <button
                        onClick={handleExport}
                        disabled={selectedDays.size === 0 ? !tabRecords.length : daysData.length === 0}
                        className="btn btn-primary"
                        title={
                            selectedDays.size >= 2
                                ? 'Export multi-day workbook (Summary + tab per day)'
                                : selectedDays.size === 1
                                    ? 'Export day roster'
                                    : 'Export current scan list'
                        }
                    >
                        <FileSpreadsheet size={16} />
                        {exportLabel}
                    </button>
                    {isAdmin && (
                        <button
                            onClick={() =>
                                setAddTarget({
                                    day: selectedDays.size === 1 ? Array.from(selectedDays)[0] : today,
                                    meetingId: meetingTab === COMBINED_TAB ? MEETINGS[0].id : meetingTab,
                                })
                            }
                            className="btn btn-secondary"
                            title="Manually record attendance — past dates allowed"
                        >
                            <UserPlus size={16} />
                            Add attendance
                        </button>
                    )}
                    <button
                        onClick={handleClearFilter}
                        disabled={!filterDate && selectedDays.size === 0 && drillYear === cairoYear() && !drillMonth && !drillWeek}
                        className="btn bg-slate-100 text-slate-700 hover:bg-slate-200"
                    >
                        <X size={16} />
                        Clear filter
                    </button>
                </div>

                {message && (
                    <div
                        className={`text-sm rounded-xl px-3 py-2 animate-fade-in ${message.type === 'success'
                            ? 'bg-emerald-50 text-emerald-700'
                            : message.type === 'error'
                                ? 'bg-rose-50 text-rose-700'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                    >
                        {message.text}
                    </div>
                )}
            </div>

            {/* Year → Month → Week → Day drill-down with multi-select */}
            <div className="card p-4 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                    <h2 className="font-semibold text-sm text-slate-700 flex items-center gap-2">
                        <Calendar size={16} className="text-indigo-600" />
                        Browse by year
                    </h2>
                    <div className="flex items-center gap-2 text-xs">
                        <button
                            type="button"
                            onClick={() => setMultiSelect((v) => !v)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${multiSelect
                                ? 'bg-emerald-600 text-white shadow ring-2 ring-emerald-300'
                                : 'bg-white text-slate-700 border border-slate-200 hover:bg-indigo-50'
                                }`}
                            title="When ON, clicking a year/month/week toggles all its days"
                        >
                            {multiSelect ? <CheckSquare size={14} /> : <Square size={14} />}
                            Multi-select: {multiSelect ? 'ON' : 'OFF'}
                        </button>
                        {selectedDays.size > 0 && (
                            <button
                                type="button"
                                onClick={clearSelection}
                                className="px-2 py-1.5 rounded-full text-xs font-semibold text-rose-600 hover:bg-rose-50"
                            >
                                Clear ({selectedDays.size})
                            </button>
                        )}
                    </div>
                </div>

                {/* Breadcrumb — each segment is clickable to collapse back to that level */}
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                    <button
                        type="button"
                        onClick={() => { setDrillMonth(null); setDrillWeek(null) }}
                        className={`font-medium transition-colors ${drillMonth ? 'text-indigo-600 hover:text-indigo-800 hover:underline underline-offset-2' : 'text-slate-700 cursor-default'}`}
                        title={drillMonth ? 'Back to year view' : undefined}
                    >
                        {drillYear ?? '—'}
                    </button>
                    {drillMonth && (
                        <>
                            <ChevronRight size={12} />
                            <button
                                type="button"
                                onClick={() => setDrillWeek(null)}
                                className={`font-medium transition-colors ${drillWeek ? 'text-indigo-600 hover:text-indigo-800 hover:underline underline-offset-2' : 'text-slate-700 cursor-default'}`}
                                title={drillWeek ? 'Back to month view' : undefined}
                            >
                                {monthName(drillMonth)}
                            </button>
                        </>
                    )}
                    {drillWeek && (
                        <>
                            <ChevronRight size={12} />
                            <span className="font-medium text-slate-700">Week {drillWeek}</span>
                        </>
                    )}
                </div>

                {/* Year row */}
                <div className="flex flex-wrap gap-2">
                    {yearsToShow.map((y) => {
                        const sel = selectionCounts.yearSelected[y] || 0
                        const tot = selectionCounts.yearTotal[y] || 0
                        const fully = tot > 0 && sel === tot
                        const partial = sel > 0 && sel < tot
                        return (
                            <DrillChip
                                key={y}
                                active={drillYear === y}
                                count={countsByYear[String(y)] || 0}
                                selected={fully}
                                partial={partial}
                                partialLabel={partial ? `${sel}/${tot}` : null}
                                onClick={(ev) => onYearChipClick(y, ev)}
                            >
                                {y}
                            </DrillChip>
                        )
                    })}
                </div>

                {/* Months */}
                {drillYear && (
                    <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-100">
                        {MONTH_NAMES.map((mname, i) => {
                            const m = i + 1
                            const cnt = countsByMonth[m] || 0
                            const sel = selectionCounts.monthSelected[m] || 0
                            const tot = selectionCounts.monthTotal[m] || 0
                            const fully = tot > 0 && sel === tot
                            const partial = sel > 0 && sel < tot
                            return (
                                <DrillChip
                                    key={m}
                                    active={drillMonth === m}
                                    count={cnt}
                                    dim={cnt === 0 && !fully && !partial}
                                    selected={fully}
                                    partial={partial}
                                    partialLabel={partial ? `${sel}/${tot}` : null}
                                    onClick={(ev) => onMonthChipClick(m, ev)}
                                >
                                    {mname}
                                </DrillChip>
                            )
                        })}
                    </div>
                )}

                {/* Weeks */}
                {drillYear && drillMonth && weeksList.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-100">
                        {weeksList.map((w) => {
                            const cnt = countsByWeek[w.index] || 0
                            const sel = selectionCounts.weekSelected[w.index] || 0
                            const tot = selectionCounts.weekTotal[w.index] || 0
                            const fully = tot > 0 && sel === tot
                            const partial = sel > 0 && sel < tot
                            return (
                                <DrillChip
                                    key={w.index}
                                    active={drillWeek === w.index}
                                    count={cnt}
                                    dim={cnt === 0 && !fully && !partial}
                                    selected={fully}
                                    partial={partial}
                                    partialLabel={partial ? `${sel}/${tot}` : null}
                                    onClick={(ev) => onWeekChipClick(w, ev)}
                                >
                                    Week {w.index}{' '}
                                    <span className="opacity-70">({w.rangeLabel})</span>
                                </DrillChip>
                            )
                        })}
                    </div>
                )}

                {/* Days (always toggle on click) */}
                {drillYear && drillMonth && drillWeek && daysInActiveWeek.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-100">
                        {daysInActiveWeek.map((d) => {
                            const cnt = countsByDay[d] || 0
                            const isSel = selectedDays.has(d)
                            return (
                                <DrillChip
                                    key={d}
                                    selected={isSel}
                                    count={cnt}
                                    dim={cnt === 0 && !isSel}
                                    onClick={() => toggleSingleDay(d)}
                                >
                                    {pickDayName(d)} {parseDay(d)}
                                </DrillChip>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* Selected days summary bar */}
            {selectedDays.size > 0 && (
                <div className="card p-3 flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-semibold text-slate-700">Selected:</span>
                    {Array.from(selectedDays)
                        .sort()
                        .slice(0, 30)
                        .map((d) => (
                            <button
                                key={d}
                                onClick={() => toggleSingleDay(d)}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-semibold hover:bg-rose-100 hover:text-rose-700 transition-colors"
                                title="Click to remove"
                            >
                                {d}
                                <X size={10} />
                            </button>
                        ))}
                    {selectedDays.size > 30 && (
                        <span className="text-slate-500">
                            +{selectedDays.size - 30} more
                        </span>
                    )}
                    <span className="ml-auto text-slate-600">
                        {selectedDays.size} day{selectedDays.size === 1 ? '' : 's'}
                    </span>
                    <button
                        onClick={clearSelection}
                        className="text-rose-600 hover:underline font-semibold"
                    >
                        Clear
                    </button>
                </div>
            )}

            {/* List */}
            {loading ? (
                <div className="text-center py-12 text-slate-500">Loading…</div>
            ) : daysData.length >= 2 ? (
                <MultiDayRosterView
                    daysData={daysData}
                    totals={totals}
                    onAdd={isAdmin ? (d) => setAddTarget({ day: d.day, meetingId: d.meetingId }) : null}
                    onDelete={isAdmin ? requestDeleteRecord : null}
                />
            ) : daysData.length === 1 ? (
                <RosterView
                    day={daysData[0].day}
                    roster={daysData[0]}
                    onAdd={isAdmin ? () => setAddTarget({ day: daysData[0].day, meetingId: daysData[0].meetingId }) : null}
                    onDelete={isAdmin ? requestDeleteRecord : null}
                />
            ) : selectedDays.size > 0 ? (
                <div className="card p-10 text-center text-slate-500">
                    <BarChart3 size={32} className="mx-auto text-slate-300" />
                    <p className="mt-3 text-sm">
                        No meetings or scans on the selected day{selectedDays.size === 1 ? '' : 's'}.
                    </p>
                </div>
            ) : tabRecords.length === 0 ? (
                <div className="card p-10 text-center text-slate-500">
                    <BarChart3 size={32} className="mx-auto text-slate-300" />
                    <p className="mt-3 text-sm">
                        No attendance records{meetingTab === COMBINED_TAB ? '' : ` for ${meetingLabel(meetingTab)}`}.
                    </p>
                </div>
            ) : (
                <FlatScansList
                    records={tabRecords}
                    showMeeting={meetingTab === COMBINED_TAB}
                    onDelete={isAdmin ? requestDeleteRecord : null}
                    lateCutoffs={lateCutoffs}
                />
            )}



            {/* Confirm delete a single check-in */}
            <ConfirmDialog
                open={confirmDelete !== null}
                title={`Remove ${confirmDelete?.name ?? ''}'s check-in?`}
                description={
                    confirmDelete
                        ? `This permanently deletes the ${meetingLabel(confirmDelete.type)} check-in${confirmDelete.date ? ` on ${confirmDelete.date}` : ''}. It can't be undone, but you can re-add it with "Add attendance".`
                        : ''
                }
                confirmText="Delete check-in"
                cancelText="Cancel"
                tone="danger"
                busy={deleteBusy}
                onConfirm={doDeleteRecord}
                onCancel={() => !deleteBusy && setConfirmDelete(null)}
            />

            {/* Confirm re-archive */}
            <ConfirmDialog
                open={confirmReArchive !== null}
                title={`Re-archive ${confirmReArchive ?? ''}?`}
                description="This will delete the existing archive and rebuild it from current attendance data."
                confirmText="Yes, re-archive"
                cancelText="Cancel"
                tone="danger"
                busy={archiveBusy === confirmReArchive}
                onConfirm={() => doReArchive(confirmReArchive)}
                onCancel={() => archiveBusy === null && setConfirmReArchive(null)}
            />

            {/* Archives modal */}
            {archivesOpen && (
                <ArchivesModal
                    archives={archives}
                    isAdmin={isAdmin}
                    archiveBusy={archiveBusy}
                    onClose={() => setArchivesOpen(false)}
                    onDownload={downloadArchive}
                    onReArchive={(y) => setConfirmReArchive(y)}
                />
            )}

            {/* Admin: manual / backdated attendance */}
            {addTarget && (
                <AddAttendanceModal
                    people={people}
                    records={records}
                    defaultDay={addTarget.day}
                    defaultMeeting={addTarget.meetingId}
                    lateCutoffs={lateCutoffs}
                    onClose={() => setAddTarget(null)}
                    onSaved={(msg) => showMessage(msg, 'success')}
                />
            )}
        </div>
    )
}

// ---------- chips & subviews ----------

function QuickChip({ label, active, onClick }) {
    return (
        <button
            onClick={onClick}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${active
                ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow'
                : 'bg-white/70 text-slate-700 hover:bg-white border border-slate-200'
                }`}
        >
            {label}
        </button>
    )
}

function DrillChip({
    children,
    active,
    selected,
    partial,
    partialLabel,
    count,
    dim,
    onClick,
}) {
    let className =
        'px-3 py-1.5 rounded-full text-xs font-semibold transition-colors inline-flex items-center gap-1.5 select-none'
    if (selected) {
        className +=
            ' bg-emerald-600 text-white shadow ring-2 ring-emerald-300'
    } else if (partial) {
        className +=
            ' bg-emerald-50 text-emerald-700 border border-emerald-300'
    } else if (active) {
        className += ' bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow'
    } else if (dim) {
        className +=
            ' bg-slate-50 text-slate-400 border border-slate-200 hover:bg-white'
    } else {
        className += ' bg-white text-slate-700 border border-slate-200 hover:bg-indigo-50'
    }
    return (
        <button onClick={(ev) => onClick && onClick(ev)} className={className}>
            <span>{children}</span>
            {partialLabel && (
                <span className="text-[10px] font-bold rounded-full px-1.5 bg-emerald-100 text-emerald-800">
                    {partialLabel}
                </span>
            )}
            {!partialLabel && count > 0 && (
                <span
                    className={`text-[10px] font-bold rounded-full px-1.5 ${selected
                        ? 'bg-white/20 text-white'
                        : active
                            ? 'bg-white/20 text-white'
                            : 'bg-indigo-100 text-indigo-700'
                        }`}
                >
                    {count}
                </span>
            )}
        </button>
    )
}

// A scan is "Late" by the value FROZEN onto it at record time, so changing a
// cutoff later never moves it. Older records without a stored flag fall back
// to the live cutoff for their meeting (null/off-schedule types are never late).
function isScanLate(r, lateCutoffs) {
    if (typeof r.late === 'boolean') return r.late
    const cutoff = lateCutoffs?.[r.type]
    return !!cutoff && String(r.time) > cutoff + ':00'
}

function ScanStatusPill({ late }) {
    return late ? (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-orange-50 text-orange-700">
            <Clock size={11} /> Late
        </span>
    ) : (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
            <CheckCircle2 size={11} /> On time
        </span>
    )
}

function FlatScansList({ records, showMeeting = false, onDelete = null, lateCutoffs = {} }) {
    return (
        <>
            {/* Mobile: cards */}
            <div className="md:hidden space-y-2">
                {records.map((r, i) => (
                    <div key={r.id} className="card p-3 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                            {i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="font-semibold text-sm truncate flex items-center gap-2">
                                <span className="truncate">{r.name}</span>
                                <ScanStatusPill late={isScanLate(r, lateCutoffs)} />
                            </div>
                            <div className="text-xs text-slate-500 tabular-nums">
                                {r.date} · {pickDayName(r.date)} · {r.time}
                                {showMeeting && (
                                    <> · <span className="text-indigo-600 font-semibold">{meetingLabel(r.type)}</span></>
                                )}
                            </div>
                        </div>
                        {onDelete && (
                            <button
                                onClick={() => onDelete(r)}
                                className="flex-shrink-0 w-8 h-8 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 flex items-center justify-center transition-colors"
                                aria-label={`Delete ${r.name}'s check-in`}
                                title="Delete this check-in"
                            >
                                <Trash2 size={15} />
                            </button>
                        )}
                    </div>
                ))}
            </div>

            {/* Desktop: table */}
            <div className="hidden md:block card overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-slate-50/80 text-slate-700">
                        <tr>
                            <th className="text-left px-4 py-2.5 font-semibold w-12">#</th>
                            <th className="text-left px-4 py-2.5 font-semibold">Name</th>
                            {showMeeting && (
                                <th className="text-left px-4 py-2.5 font-semibold w-36">Meeting</th>
                            )}
                            <th className="text-left px-4 py-2.5 font-semibold w-32">Date</th>
                            <th className="text-left px-4 py-2.5 font-semibold w-28">Day</th>
                            <th className="text-left px-4 py-2.5 font-semibold w-28">Time</th>
                            <th className="text-left px-4 py-2.5 font-semibold w-28">Status</th>
                            {onDelete && <th className="px-4 py-2.5 font-semibold w-16 text-right">Actions</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {records.map((r, i) => (
                            <tr key={r.id} className={i % 2 ? 'bg-slate-50/40' : ''}>
                                <td className="px-4 py-2 text-slate-500">{i + 1}</td>
                                <td className="px-4 py-2 font-medium text-slate-800">
                                    {r.name}
                                </td>
                                {showMeeting && (
                                    <td className="px-4 py-2 text-slate-600">
                                        {meetingLabel(r.type)}
                                    </td>
                                )}
                                <td className="px-4 py-2 text-slate-700 tabular-nums">
                                    {r.date}
                                </td>
                                <td className="px-4 py-2 text-slate-600">
                                    {pickDayName(r.date)}
                                </td>
                                <td className="px-4 py-2 text-slate-700 tabular-nums">
                                    {r.time}
                                </td>
                                <td className="px-4 py-2">
                                    <ScanStatusPill late={isScanLate(r, lateCutoffs)} />
                                </td>
                                {onDelete && (
                                    <td className="px-4 py-2 text-right">
                                        <button
                                            onClick={() => onDelete(r)}
                                            className="inline-flex w-8 h-8 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 items-center justify-center transition-colors"
                                            aria-label={`Delete ${r.name}'s check-in`}
                                            title="Delete this check-in"
                                        >
                                            <Trash2 size={15} />
                                        </button>
                                    </td>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </>
    )
}

function RosterView({ day, roster, onAdd, onDelete }) {
    if (!roster) return <div className="text-center py-12 text-slate-500">Loading…</div>
    const { attended, absent, addedLater, late = [], isFinalised, isScheduledDay } = roster
    // Enrich each row with its day + meeting so the confirm dialog reads right.
    const handleRowDelete = onDelete
        ? (row) => onDelete({ recordId: row.recordId, name: row.name, date: day, type: roster.meetingId })
        : null
    const total = attended.length + absent.length + addedLater.length + late.length
    const dname = pickDayName(day)

    if (total === 0 && isFinalised) {
        return (
            <div className="card p-10 text-center text-slate-500">
                <BarChart3 size={32} className="mx-auto text-slate-300" />
                <p className="mt-3 text-sm">
                    {isScheduledDay
                        ? 'No people in the list yet.'
                        : `No ${roster.meetingLabel} scans on this day (off-schedule).`}
                </p>
                {onAdd && (
                    <button onClick={onAdd} className="btn btn-secondary mt-4">
                        <UserPlus size={14} /> Add attendance for this day
                    </button>
                )}
            </div>
        )
    }
    return (
        <div className="space-y-2">
            <RosterStatsHeader
                title={
                    <>
                        {day} {dname && <span className="text-slate-400">· {dname}</span>}
                        {roster.meetingLabel && (
                            <span className="text-indigo-600"> · {roster.meetingLabel}</span>
                        )}
                    </>
                }
                attended={attended.length}
                absent={absent.length}
                addedLater={addedLater.length}
                late={late.length}
                total={total}
                isFinalised={isFinalised && isScheduledDay}
                onAdd={onAdd}
            />
            {!isFinalised && <InProgressBanner />}
            {!isScheduledDay && <OffScheduleBanner label={roster.meetingLabel} />}
            <RosterRows attended={attended} absent={absent} addedLater={addedLater} late={late} onDelete={handleRowDelete} />
        </div>
    )
}

function OffScheduleBanner({ label }) {
    return (
        <div className="card p-3 flex items-start gap-2 bg-sky-50 border border-sky-200 text-sky-800 text-xs">
            <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
            <span>
                {label} does not normally occur on this day — these scans were
                recorded with the admin unlock. Nobody is marked Absent.
            </span>
        </div>
    )
}

function InProgressBanner() {
    return (
        <div className="card p-3 flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 text-xs">
            <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
            <span>
                Day still in progress. Absences will be finalised at midnight (Africa/Cairo).
            </span>
        </div>
    )
}

function MultiDayRosterView({ daysData, totals, onAdd, onDelete }) {
    const [showAll, setShowAll] = useState(false)
    const visible = showAll ? daysData : daysData.slice(0, 30)

    return (
        <div className="space-y-4">
            <RosterStatsHeader
                title="Grand Totals (Selected Days)"
                attended={totals.attended}
                absent={totals.absent}
                addedLater={totals.addedLater}
                late={totals.late}
                total={totals.total}
            />

            {visible.map((d) => (
                <DaySection
                    key={`${d.day}-${d.meetingId}`}
                    dayData={d}
                    onAdd={onAdd ? () => onAdd(d) : null}
                    onDelete={onDelete}
                />
            ))}

            {!showAll && daysData.length > 30 && (
                <button
                    onClick={() => setShowAll(true)}
                    className="btn btn-secondary w-full"
                >
                    Show {daysData.length - 30} more days…
                </button>
            )}
        </div>
    )
}

function DaySection({ dayData, onAdd, onDelete }) {
    const [open, setOpen] = useState(false)
    const total =
        dayData.attended.length + dayData.absent.length + dayData.addedLater.length + (dayData.late?.length || 0)
    const dname = pickDayName(dayData.day)
    const handleRowDelete = onDelete
        ? (row) => onDelete({ recordId: row.recordId, name: row.name, date: dayData.day, type: dayData.meetingId })
        : null
    return (
        <div className="card overflow-hidden">
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="w-full text-left p-3 flex flex-wrap items-center gap-2 text-xs hover:bg-slate-50/80 transition-colors"
            >
                <ChevronRight
                    size={14}
                    className={`text-slate-400 transition-transform ${open ? 'rotate-90' : ''}`}
                />
                <span className="font-bold text-sm text-slate-800">
                    {dayData.day}
                </span>
                {dname && <span className="text-slate-400">· {dname}</span>}
                {dayData.meetingLabel && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-semibold">
                        {dayData.meetingLabel}
                    </span>
                )}
                {!dayData.isFinalised && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-semibold">
                        <AlertCircle size={11} /> in progress
                    </span>
                )}
                {!dayData.isScheduledDay && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 font-semibold">
                        off-schedule
                    </span>
                )}
                <span className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold">
                    <CheckCircle2 size={11} /> {dayData.attended.length}
                </span>
                {dayData.late?.length > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 font-semibold">
                        <Clock size={11} /> {dayData.late.length}
                    </span>
                )}
                {dayData.isFinalised && dayData.isScheduledDay && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 font-semibold">
                        <XCircle size={11} /> {dayData.absent.length}
                    </span>
                )}
                {dayData.addedLater.length > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-semibold">
                        <UserPlus size={11} /> {dayData.addedLater.length}
                    </span>
                )}
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold">
                    {total}
                </span>
            </button>
            {open && (
                <div className="p-3 border-t border-slate-100 space-y-2">
                    {!dayData.isFinalised && <InProgressBanner />}
                    {onAdd && (
                        <button
                            onClick={onAdd}
                            className="btn btn-secondary !py-1.5 !px-3 text-xs"
                            title="Manually add a person to this meeting day"
                        >
                            <UserPlus size={13} /> Add person
                        </button>
                    )}
                    <RosterRows
                        attended={dayData.attended}
                        absent={dayData.absent}
                        addedLater={dayData.addedLater}
                        late={dayData.late || []}
                        onDelete={handleRowDelete}
                    />
                </div>
            )}
        </div>
    )
}

function RosterStatsHeader({ title, attended, absent, addedLater, late = 0, total, isFinalised = true, onAdd = null }) {
    return (
        <div className="card p-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="font-semibold text-slate-700">{title}</span>
            {onAdd && (
                <button
                    onClick={onAdd}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-colors"
                    title="Manually add a person to this meeting day"
                >
                    <UserPlus size={11} /> Add
                </button>
            )}
            <span className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold">
                <CheckCircle2 size={12} /> {attended} attended
            </span>
            {isFinalised && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 font-semibold">
                    <XCircle size={12} /> {absent} absent
                </span>
            )}
            {late > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 font-semibold">
                    <Clock size={12} /> {late} late
                </span>
            )}
            {addedLater > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-semibold">
                    <UserPlus size={12} /> {addedLater} added later
                </span>
            )}
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold">
                Total {total}
            </span>
        </div>
    )
}

function RosterRows({ attended, absent, addedLater, late = [], onDelete = null }) {
    const all = [
        ...attended.map((p) => ({ ...p, type: 'attended' })),
        ...late.map((p) => ({ ...p, type: 'late' })),
        ...absent.map((p) => ({ ...p, type: 'absent' })),
        ...addedLater.map((p) => ({ ...p, type: 'added-later' })),
    ]
    // Only real check-ins (attended/late) carry a recordId and can be deleted.
    const canDelete = (p) => onDelete && p.recordId
    return (
        <>
            {/* Mobile */}
            <div className="md:hidden space-y-2">
                {all.map((p, i) => (
                    <div
                        key={p.type + '-' + p.id}
                        className="border border-slate-200 rounded-xl p-2 flex items-center gap-3"
                    >
                        <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                            {i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="font-semibold text-sm truncate">{p.name}</div>
                            <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                                <StatusPill type={p.type} addedOn={p.addedOn} />
                                {p.time && (
                                    <span className="inline-flex items-center gap-0.5 tabular-nums">
                                        <Clock size={11} /> {p.time}
                                    </span>
                                )}
                            </div>
                        </div>
                        {canDelete(p) && (
                            <button
                                onClick={() => onDelete(p)}
                                className="flex-shrink-0 w-8 h-8 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 flex items-center justify-center transition-colors"
                                aria-label={`Delete ${p.name}'s check-in`}
                                title="Delete this check-in"
                            >
                                <Trash2 size={15} />
                            </button>
                        )}
                    </div>
                ))}
            </div>

            {/* Desktop */}
            <div className="hidden md:block overflow-hidden rounded-xl border border-slate-200">
                <table className="w-full text-sm">
                    <thead className="bg-slate-50/80 text-slate-700">
                        <tr>
                            <th className="text-left px-4 py-2 font-semibold w-12">#</th>
                            <th className="text-left px-4 py-2 font-semibold">Name</th>
                            <th className="text-left px-4 py-2 font-semibold w-40">Status</th>
                            <th className="text-left px-4 py-2 font-semibold w-28">Time</th>
                            {onDelete && <th className="px-4 py-2 font-semibold w-16 text-right">Actions</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {all.map((p, i) => (
                            <tr
                                key={p.type + '-' + p.id}
                                className={i % 2 ? 'bg-slate-50/40' : ''}
                            >
                                <td className="px-4 py-2 text-slate-500">{i + 1}</td>
                                <td className="px-4 py-2 font-medium text-slate-800">
                                    {p.name}
                                </td>
                                <td className="px-4 py-2">
                                    <StatusPill type={p.type} addedOn={p.addedOn} />
                                </td>
                                <td className="px-4 py-2 text-slate-700 tabular-nums">
                                    {p.time || ''}
                                </td>
                                {onDelete && (
                                    <td className="px-4 py-2 text-right">
                                        {canDelete(p) ? (
                                            <button
                                                onClick={() => onDelete(p)}
                                                className="inline-flex w-8 h-8 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 items-center justify-center transition-colors"
                                                aria-label={`Delete ${p.name}'s check-in`}
                                                title="Delete this check-in"
                                            >
                                                <Trash2 size={15} />
                                            </button>
                                        ) : null}
                                    </td>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </>
    )
}

function StatusPill({ type, addedOn }) {
    if (type === 'attended') {
        return (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                <CheckCircle2 size={11} /> Attended
            </span>
        )
    }
    if (type === 'late') {
        return (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-orange-50 text-orange-700">
                <Clock size={11} /> Late
            </span>
        )
    }
    if (type === 'absent') {
        return (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700">
                <XCircle size={11} /> Absent
            </span>
        )
    }
    return (
        <span
            className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700"
            title={addedOn ? `Added on ${addedOn}` : 'Added after this day'}
        >
            <UserPlus size={11} />
            Added later
            {addedOn && <span className="opacity-70 font-normal">· {addedOn}</span>}
        </span>
    )
}

function ArchivesModal({ archives, isAdmin, archiveBusy, onClose, onDownload, onReArchive }) {
    return (
        <div
            className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-hidden flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-4 border-b border-slate-200 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center text-white">
                        <FolderArchive size={18} />
                    </div>
                    <div className="flex-1">
                        <h3 className="font-bold">Archives</h3>
                        <p className="text-xs text-slate-500">
                            Yearly archives saved on Firebase
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="overflow-auto p-3 space-y-2 flex-1">
                    {archives.length === 0 ? (
                        <div className="text-center text-sm text-slate-500 py-12">
                            <FolderArchive size={32} className="mx-auto text-slate-300 mb-2" />
                            <p>No archives yet.</p>
                            <p className="text-xs mt-1">
                                When the year changes, the previous year is auto-archived here.
                            </p>
                        </div>
                    ) : (
                        archives.map((a) => {
                            const busy = archiveBusy === a.year
                            return (
                                <div
                                    key={a.id}
                                    className="border border-slate-200 rounded-xl p-3 flex items-center gap-3"
                                >
                                    <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold tabular-nums">
                                        {a.year}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-semibold">Year {a.year}</div>
                                        <div className="text-xs text-slate-500">
                                            {a.totalScans ?? 0} scan
                                            {(a.totalScans ?? 0) === 1 ? '' : 's'}
                                            {a.archivedAt?.toDate && (
                                                <>
                                                    {' '}· archived{' '}
                                                    {a.archivedAt.toDate().toLocaleDateString()}
                                                </>
                                            )}
                                        </div>
                                        {a.byType && (
                                            <div className="text-[11px] text-slate-400 mt-0.5 truncate">
                                                {MEETINGS.map((m) => `${m.short} ${a.byType[m.id] ?? 0}`).join(' · ')}
                                            </div>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => onDownload(a.year)}
                                        disabled={busy}
                                        className="btn btn-primary !px-3 !py-1.5 text-xs"
                                        title="Download Excel archive"
                                    >
                                        {busy ? (
                                            <Loader2 size={14} className="animate-spin" />
                                        ) : (
                                            <Download size={14} />
                                        )}
                                        Excel
                                    </button>
                                    {isAdmin && (
                                        <button
                                            onClick={() => onReArchive(a.year)}
                                            disabled={busy}
                                            className="btn btn-secondary !px-2 !py-1.5 text-xs"
                                            title="Re-archive from current data"
                                        >
                                            <RefreshCw size={14} />
                                        </button>
                                    )}
                                </div>
                            )
                        })
                    )}
                </div>
            </div>
        </div>
    )
}

// ---------- helpers ----------

function pickDayName(isoDate) {
    if (!isoDate) return ''
    const [y, m, d] = isoDate.split('-').map((s) => parseInt(s, 10))
    if (!y || !m || !d) return ''
    return longDayName(y, m, d)
}
function parseDay(isoDate) {
    if (!isoDate) return ''
    return parseInt(isoDate.split('-')[2], 10)
}
