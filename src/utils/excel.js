import * as XLSX from 'xlsx'
import { MONTH_NAMES, longDayName } from './dateUtils.js'
import { MEETINGS, meetingLabel } from './meetings.js'

// Reads an .xlsx/.xls/.csv file and returns an array of names (strings).
// Looks at the first column. If the first row looks like a header
// (e.g. "Name", "name", "الاسم"), it is skipped.
export function readNamesFromFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result)
                const workbook = XLSX.read(data, { type: 'array' })
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
                const rows = XLSX.utils.sheet_to_json(firstSheet, {
                    header: 1,
                    blankrows: false,
                    defval: '',
                })

                if (!rows.length) return resolve([])

                // Determine if first row is a header
                const firstCell = String(rows[0][0] ?? '').trim().toLowerCase()
                const headerKeywords = ['name', 'الاسم', 'الإسم', 'اسم']
                const startIdx = headerKeywords.includes(firstCell) ? 1 : 0

                const names = []
                for (let i = startIdx; i < rows.length; i++) {
                    const cell = rows[i][0]
                    if (cell === undefined || cell === null) continue
                    const val = String(cell).trim()
                    if (val) names.push(val)
                }
                resolve(names)
            } catch (err) {
                reject(err)
            }
        }
        reader.onerror = reject
        reader.readAsArrayBuffer(file)
    })
}

// Exports attendance records to .xlsx and triggers a download.
// records: [{ name, date, time, type }]
// `includeMeeting` adds a Meeting column (used by the combined export).
export function exportAttendanceToExcel(records, filename = 'attendance.xlsx', { includeMeeting = false } = {}) {
    const data = includeMeeting
        ? [
            ['Name', 'Meeting', 'Date', 'Time'],
            ...records.map((r) => [r.name, meetingLabel(r.type), r.date, r.time]),
        ]
        : [
            ['Name', 'Date', 'Time'],
            ...records.map((r) => [r.name, r.date, r.time]),
        ]
    const ws = XLSX.utils.aoa_to_sheet(data)
    ws['!cols'] = includeMeeting
        ? [{ wch: 30 }, { wch: 18 }, { wch: 14 }, { wch: 12 }]
        : [{ wch: 30 }, { wch: 14 }, { wch: 12 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Attendance')
    XLSX.writeFile(wb, filename)
}

// Downloads a clean Excel template with just the "Name" header
// followed by 10 empty, light-bordered rows ready to fill.
export function downloadExcelTemplate(filename = 'people-template.xlsx') {
    const EMPTY_ROWS = 10

    // Header + N blank rows (we keep cells defined so styling sticks)
    const data = [['Name'], ...Array.from({ length: EMPTY_ROWS }, () => [''])]
    const ws = XLSX.utils.aoa_to_sheet(data)
    ws['!cols'] = [{ wch: 36 }]

    // Tweak row heights so the template feels visually structured.
    ws['!rows'] = [
        { hpt: 22 }, // header
        ...Array.from({ length: EMPTY_ROWS }, () => ({ hpt: 20 })),
    ]

    // Header style (bold white text on indigo fill, centered)
    const headerStyle = {
        font: { bold: true, color: { rgb: 'FFFFFFFF' }, sz: 12 },
        fill: { patternType: 'solid', fgColor: { rgb: 'FF6366F1' } },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: thinBorder('FF4F46E5'),
    }
    if (ws['A1']) ws['A1'].s = headerStyle

    // Light borders + alternating banding for the empty body rows.
    for (let i = 0; i < EMPTY_ROWS; i++) {
        const addr = `A${i + 2}`
        if (!ws[addr]) ws[addr] = { t: 's', v: '' }
        ws[addr].s = {
            font: { sz: 11, color: { rgb: 'FF334155' } },
            fill: {
                patternType: 'solid',
                fgColor: { rgb: i % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC' },
            },
            alignment: { horizontal: 'left', vertical: 'center', indent: 1 },
            border: thinBorder('FFE2E8F0'),
        }
    }

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'People')
    XLSX.writeFile(wb, filename)
}

function thinBorder(rgb) {
    const side = { style: 'thin', color: { rgb } }
    return { top: side, bottom: side, left: side, right: side }
}

// Builds a single-day, single-meeting roster workbook from a roster object
// produced by buildRosterForDay():
//   { day, meetingLabel, isFinalised, isScheduledDay,
//     attended: [{name, time}], late: [{name, time}],
//     absent: [{name}], addedLater: [{name}] }
export function exportRosterToExcel(roster, filename) {
    const {
        day,
        meetingLabel: label,
        isFinalised,
        isScheduledDay = true,
        attended,
        late = [],
        absent,
        addedLater,
    } = roster

    const showAbsent = isFinalised && isScheduledDay
    const present = attended.length + late.length

    let headerLine = `Attended ${present}`
    if (late.length > 0) headerLine += ` (${late.length} late)`
    if (showAbsent) headerLine += ` · Absent ${absent.length}`
    if (addedLater.length > 0) headerLine += ` · Added later ${addedLater.length}`
    if (!isFinalised) headerLine += ' · Day still in progress (absences finalise at midnight, Africa/Cairo)'
    if (!isScheduledDay) headerLine += ' · Off-schedule day (nobody marked Absent)'

    const data = [
        [`Roster for ${day}${label ? ` — ${label}` : ''}`, '', ''],
        [headerLine, '', ''],
        [],
        ['Name', 'Status', 'Time'],
        ...attended.map((p) => [p.name, 'Attended', p.time]),
        ...late.map((p) => [p.name, 'Late', p.time]),
        ...(showAbsent ? absent.map((p) => [p.name, 'Absent', '']) : []),
        ...addedLater.map((p) => [p.name, 'Added later', '']),
    ]

    const ws = XLSX.utils.aoa_to_sheet(data)
    ws['!cols'] = [{ wch: 32 }, { wch: 14 }, { wch: 12 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Roster')
    XLSX.writeFile(wb, filename || `roster-${day}.xlsx`)
}

// Builds a multi-roster workbook. Each entry of `daysData` is one
// (day × meeting) roster from buildRosterForDay() — on a meeting tab that's
// one per day; on the combined tab a Friday contributes two entries.
//
// Summary tab is a NAME × ROSTER matrix:
//   - rows = every person from /people (alphabetical) + any "scan-only"
//     people whose attendance docs exist but who were removed from /people
//   - columns = each roster (chronological), with a 2-row header showing
//     the date and the day-name + meeting label.
//   - cell content per (person, roster):
//       * scanned          -> the time string  (e.g. "14:32:07")
//       * scanned late     -> "HH:MM:SS (late)"
//       * past scheduled day, no scan -> "Absent"
//       * today/future or off-schedule day, no scan -> "—"
//       * person added after end-of-day -> "Added later"
//
// Per-roster detail tabs (Name / Status / Time) are also produced.
export function exportMultiDayRoster(daysData, people, filename) {
    const wb = XLSX.utils.book_new()

    // ----- Build the people roster (alpha, with removed-people fallback) -----
    const peopleById = new Map(people.map((p) => [p.id, p]))
    // Add any scan-only personIds that aren't in /people anymore.
    for (const d of daysData) {
        for (const a of [...d.attended, ...(d.late || [])]) {
            if (!peopleById.has(a.id)) {
                peopleById.set(a.id, { id: a.id, name: a.name + ' (removed)' })
            }
        }
    }
    const allPeople = Array.from(peopleById.values()).sort((a, b) =>
        String(a.name).localeCompare(String(b.name))
    )

    // ----- Summary (matrix) sheet -----
    const dateRow = ['Name', ...daysData.map((d) => d.day)]
    const dayNameRow = ['', ...daysData.map((d) => {
        const [yy, mm, dd] = d.day.split('-').map((s) => parseInt(s, 10))
        const dn = yy && mm && dd ? longDayName(yy, mm, dd) : ''
        return d.meetingLabel ? `${dn} · ${d.meetingLabel}` : dn
    })]

    const matrixRows = allPeople.map((p) => {
        const cells = daysData.map((d) => {
            const att = d.attended.find((x) => x.id === p.id)
            if (att) return att.time
            const lt = (d.late || []).find((x) => x.id === p.id)
            if (lt) return `${lt.time} (late)`
            if (d.addedLater.find((x) => x.id === p.id)) return 'Added later'
            if (d.isFinalised && d.isScheduledDay !== false) return 'Absent'
            return '—'
        })
        return [p.name, ...cells]
    })

    // Per-roster totals row at the bottom.
    const totalsRow = ['Totals', ...daysData.map((d) => {
        const present = d.attended.length + (d.late?.length || 0)
        if (d.isFinalised && d.isScheduledDay !== false) {
            return `${present} attended · ${d.absent.length} absent`
        }
        if (d.isScheduledDay === false) {
            return `${present} attended · off-schedule`
        }
        return `${present} attended · in progress`
    })]

    const summaryData = [
        [`Multi-day roster — ${daysData.length} roster${daysData.length === 1 ? '' : 's'} selected`],
        [],
        dateRow,
        dayNameRow,
        ...matrixRows,
        [],
        totalsRow,
    ]
    const summaryWs = XLSX.utils.aoa_to_sheet(summaryData)
    // Name column wider; day columns moderate.
    summaryWs['!cols'] = [
        { wch: 30 },
        ...daysData.map(() => ({ wch: 18 })),
    ]
    // Freeze the header rows + name column for easier scrolling.
    summaryWs['!freeze'] = { xSplit: 1, ySplit: 4 }
    XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary')

    // ----- One detail tab per roster -----
    const usedNames = new Set(['Summary'])
    for (const d of daysData) {
        const showAbsent = d.isFinalised && d.isScheduledDay !== false
        const present = d.attended.length + (d.late?.length || 0)
        let headerLine = `Attended ${present}`
        if (d.late?.length > 0) headerLine += ` (${d.late.length} late)`
        if (showAbsent) headerLine += ` · Absent ${d.absent.length}`
        if (d.addedLater.length > 0) headerLine += ` · Added later ${d.addedLater.length}`
        if (!d.isFinalised) headerLine += ' · Day still in progress'
        if (d.isScheduledDay === false) headerLine += ' · Off-schedule day'

        const rows = [
            [`Roster for ${d.day}${d.meetingLabel ? ` — ${d.meetingLabel}` : ''}`, '', ''],
            [headerLine, '', ''],
            [],
            ['Name', 'Status', 'Time'],
            ...d.attended.map((p) => [p.name, 'Attended', p.time]),
            ...(d.late || []).map((p) => [p.name, 'Late', p.time]),
            ...(showAbsent ? d.absent.map((p) => [p.name, 'Absent', '']) : []),
            ...d.addedLater.map((p) => [p.name, 'Added later', '']),
        ]
        const ws = XLSX.utils.aoa_to_sheet(rows)
        ws['!cols'] = [{ wch: 32 }, { wch: 14 }, { wch: 12 }]
        const sheetBase = d.meetingLabel ? `${d.day} ${d.meetingLabel}` : d.day
        XLSX.utils.book_append_sheet(wb, ws, uniqueSheetName(sheetBase, usedNames))
    }

    // Filename heuristic
    let outName = filename
    if (!outName) {
        if (daysData.length === 0) outName = 'roster-empty.xlsx'
        else if (daysData.length === 1) outName = `roster-${daysData[0].day}.xlsx`
        else {
            outName = `roster-${daysData[0].day}_to_${daysData[daysData.length - 1].day}.xlsx`
        }
    }
    XLSX.writeFile(wb, outName)
}

function uniqueSheetName(base, usedSet) {
    // Excel sheet names: max 31 chars, can't contain : \ / ? * [ ]
    let safe = String(base).replace(/[:\\/?*[\]]/g, '-').slice(0, 31)
    if (!usedSet.has(safe)) {
        usedSet.add(safe)
        return safe
    }
    let i = 2
    while (usedSet.has(`${safe.slice(0, 28)}_${i}`)) i++
    const final = `${safe.slice(0, 28)}_${i}`
    usedSet.add(final)
    return final
}

// Builds a year archive workbook: one sheet per month + a summary sheet.
// records: array of { name, date, time, personId, type } for the given year
// (legacy records arrive pre-normalized to type 'sunday').
export function exportYearArchive(year, records, filename) {
    const wb = XLSX.utils.book_new()

    // Bucket records per month (1..12).
    const byMonth = {}
    for (let m = 1; m <= 12; m++) byMonth[m] = []
    for (const r of records) {
        const m = parseInt(String(r.date).slice(5, 7), 10)
        if (m >= 1 && m <= 12) byMonth[m].push(r)
    }
    // Sort each month: by date asc, then time asc.
    for (let m = 1; m <= 12; m++) {
        byMonth[m].sort((a, b) =>
            a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date)
        )
    }

    // Summary tab first: Month × meeting type.
    const summaryRows = [
        ['Month', ...MEETINGS.map((m) => m.label), 'Total'],
        ...Array.from({ length: 12 }, (_, i) => {
            const list = byMonth[i + 1]
            const perType = MEETINGS.map(
                (m) => list.filter((r) => r.type === m.id).length
            )
            return [MONTH_NAMES[i], ...perType, list.length]
        }),
        [
            'Total',
            ...MEETINGS.map((m) => records.filter((r) => r.type === m.id).length),
            records.length,
        ],
    ]
    const summaryWs = XLSX.utils.aoa_to_sheet(summaryRows)
    summaryWs['!cols'] = [{ wch: 16 }, ...MEETINGS.map(() => ({ wch: 16 })), { wch: 10 }]
    XLSX.utils.book_append_sheet(wb, summaryWs, `Year ${year}`)

    // One tab per month. Sheet names are limited to 31 chars; "January" etc. fit.
    for (let m = 1; m <= 12; m++) {
        const rows = [['#', 'Name', 'Meeting', 'Date', 'Day', 'Time']]
        const list = byMonth[m]
        if (list.length === 0) {
            rows.push(['', '— No records —', '', '', '', ''])
        } else {
            list.forEach((r, i) => {
                const [yy, mm, dd] = String(r.date).split('-').map((s) => parseInt(s, 10))
                const dayName = (yy && mm && dd) ? longDayName(yy, mm, dd) : ''
                rows.push([i + 1, r.name, meetingLabel(r.type), r.date, dayName, r.time])
            })
            rows.push(['', '', '', '', 'Total', list.length])
        }
        const ws = XLSX.utils.aoa_to_sheet(rows)
        ws['!cols'] = [
            { wch: 5 },
            { wch: 30 },
            { wch: 18 },
            { wch: 14 },
            { wch: 12 },
            { wch: 12 },
        ]
        XLSX.utils.book_append_sheet(wb, ws, MONTH_NAMES[m - 1])
    }

    XLSX.writeFile(wb, filename || `attendance-${year}-archive.xlsx`)
}
