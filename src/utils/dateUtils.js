// All date/time helpers below produce values in the Africa/Cairo time zone,
// regardless of the browser's local clock. This guarantees that two scanner
// phones with different/wrong clocks still write the same `date` and `time`
// for the same physical moment in Egypt.
//
// We rely on Intl.DateTimeFormat which has full IANA TZ support and handles
// DST automatically -- no extra dependency required.

const CAIRO_TZ = 'Africa/Cairo'

// Returns the parts of "now" (or a given Date) as seen in Cairo.
// Output: { y, m, d, hh, mm, ss } -- numbers (not zero-padded).
export function cairoNowParts(date = new Date()) {
    // 'en-CA' gives YYYY-MM-DD ordering, easy to parse.
    const fmt = new Intl.DateTimeFormat('en-CA', {
        timeZone: CAIRO_TZ,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    })
    const parts = fmt.formatToParts(date)
    const get = (t) => parts.find((p) => p.type === t)?.value ?? '00'
    return {
        y: parseInt(get('year'), 10),
        m: parseInt(get('month'), 10),
        d: parseInt(get('day'), 10),
        hh: parseInt(get('hour'), 10) % 24, // some locales emit "24" for midnight
        mm: parseInt(get('minute'), 10),
        ss: parseInt(get('second'), 10),
    }
}

// "YYYY-MM-DD" string in Cairo time.
export function cairoDateStr(date = new Date()) {
    const { y, m, d } = cairoNowParts(date)
    return `${y}-${pad2(m)}-${pad2(d)}`
}

// "HH:MM:SS" string in Cairo time.
export function cairoTimeStr(date = new Date()) {
    const { hh, mm, ss } = cairoNowParts(date)
    return `${pad2(hh)}:${pad2(mm)}:${pad2(ss)}`
}

export function cairoYear(date = new Date()) {
    return cairoNowParts(date).y
}

export function cairoMonth(date = new Date()) {
    return cairoNowParts(date).m
}

export function cairoDay(date = new Date()) {
    return cairoNowParts(date).d
}

// Backwards-compatible aliases (the codebase used to call these names with
// the device clock). They now return Cairo time -- which is what we want
// everywhere in the app.
export const todayDateStr = cairoDateStr
export const nowTimeStr = cairoTimeStr

// ---------- Month / Week / Day helpers ----------

export const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
]

const SHORT_DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const LONG_DAY_NAMES = [
    'Sunday', 'Monday', 'Tuesday', 'Wednesday',
    'Thursday', 'Friday', 'Saturday',
]

export function monthName(m) {
    return MONTH_NAMES[(m - 1) % 12]
}

// Returns "YYYY-MM-DD" for a given (year, month=1-12, day).
export function ymd(y, m, d) {
    return `${y}-${pad2(m)}-${pad2(d)}`
}

export function daysInMonth(year, month /* 1-12 */) {
    return new Date(year, month, 0).getDate()
}

// Returns 0 (Sun) - 6 (Sat) for a given (y, m, d) using local Date logic.
// Day-of-week is the same in any TZ for a given calendar date string.
export function weekdayOf(year, month, day) {
    return new Date(year, month - 1, day).getDay()
}

export function shortDayName(year, month, day) {
    return SHORT_DAY_NAMES[weekdayOf(year, month, day)]
}

export function longDayName(year, month, day) {
    return LONG_DAY_NAMES[weekdayOf(year, month, day)]
}

// Returns an array of Sunday-Saturday calendar weeks intersected with the
// given month. Each entry:
//   { index: 1-based, label, dates: ["YYYY-MM-DD", ...] }
// Partial first/last weeks just contain the days that actually fall in the
// month; we don't pad with the previous/next month.
export function weeksOfMonth(year, month /* 1-12 */) {
    const total = daysInMonth(year, month)
    const weeks = []
    let current = []
    let weekIndex = 1

    for (let day = 1; day <= total; day++) {
        const wd = weekdayOf(year, month, day)
        // If it's Sunday and we already collected days, close the previous week.
        if (wd === 0 && current.length > 0) {
            weeks.push(buildWeek(weekIndex++, current))
            current = []
        }
        current.push(ymd(year, month, day))
    }
    if (current.length > 0) {
        weeks.push(buildWeek(weekIndex, current))
    }
    return weeks
}

function buildWeek(index, dates) {
    const first = dates[0]
    const last = dates[dates.length - 1]
    return {
        index,
        label: `Week ${index}`,
        rangeLabel: dates.length === 1 ? prettyMD(first) : `${prettyMD(first)} – ${prettyMD(last)}`,
        dates,
    }
}

function prettyMD(isoDate /* YYYY-MM-DD */) {
    const [, m, d] = isoDate.split('-').map((s) => parseInt(s, 10))
    return `${MONTH_NAMES[m - 1].slice(0, 3)} ${d}`
}

// Helpers used by Records page chips.
export function daysOfMonth(year, month) {
    const total = daysInMonth(year, month)
    const out = []
    for (let day = 1; day <= total; day++) {
        out.push(ymd(year, month, day))
    }
    return out
}

// Every YYYY-MM-DD in the given calendar year.
export function daysOfYear(year) {
    const out = []
    for (let m = 1; m <= 12; m++) {
        const total = daysInMonth(year, m)
        for (let d = 1; d <= total; d++) {
            out.push(ymd(year, m, d))
        }
    }
    return out
}

function pad2(n) {
    return String(n).padStart(2, '0')
}

// True iff `dateStr` (YYYY-MM-DD) is strictly before today in Africa/Cairo.
// Used to decide whether a day's roster is "finalised" (past) and thus
// safe to mark non-scanners as Absent. Today and future return false.
export function isCairoPastDay(dateStr) {
    if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(String(dateStr))) return false
    return String(dateStr) < cairoDateStr()
}

// Returns a JS Date that represents the last millisecond of the given
// calendar day (YYYY-MM-DD) as observed in Cairo. Used to compare against
// Firestore Timestamps (e.g. `createdAt`) to decide whether something was
// created strictly *after* that day.
//
// Implementation: we find the UTC instant that, when displayed in Cairo,
// shows midnight of (day + 1), then subtract 1 ms.
export function cairoEndOfDay(dateStr /* YYYY-MM-DD */) {
    if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(String(dateStr))) return null
    const [y, m, d] = dateStr.split('-').map((s) => parseInt(s, 10))
    // Construct "next-day 00:00 in Cairo" by treating it as UTC and then
    // adjusting by Cairo's offset on that exact date.
    // Step 1: trial UTC midnight of next day.
    const trial = new Date(Date.UTC(y, m - 1, d + 1, 0, 0, 0))
    // Step 2: figure out Cairo's offset (in minutes) for that instant.
    const cairoOffsetMin = cairoOffsetMinutes(trial)
    // The actual UTC instant of "Cairo midnight next day" = trial - offset.
    const cairoMidnightNextDayUTC = new Date(trial.getTime() - cairoOffsetMin * 60_000)
    // End-of-day = one ms before that instant.
    return new Date(cairoMidnightNextDayUTC.getTime() - 1)
}

// Returns Cairo's UTC offset in minutes for the given instant. Handles DST
// automatically by asking Intl what hour Cairo sees for the same UTC instant.
function cairoOffsetMinutes(date) {
    const fmt = new Intl.DateTimeFormat('en-CA', {
        timeZone: CAIRO_TZ,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    })
    const parts = fmt.formatToParts(date)
    const get = (t) => parts.find((p) => p.type === t)?.value ?? '0'
    const cairoAsUTC = Date.UTC(
        parseInt(get('year'), 10),
        parseInt(get('month'), 10) - 1,
        parseInt(get('day'), 10),
        parseInt(get('hour'), 10) % 24,
        parseInt(get('minute'), 10),
        parseInt(get('second'), 10)
    )
    return Math.round((cairoAsUTC - date.getTime()) / 60_000)
}

// Converts a Firestore Timestamp, plain seconds-object, or Date to milliseconds.
export function msFromTimestamp(ts) {
    if (!ts) return null
    if (typeof ts.toMillis === 'function') return ts.toMillis()
    if (typeof ts.seconds === 'number') return ts.seconds * 1000
    if (ts instanceof Date) return ts.getTime()
    return null
}

// Returns how many days until the next Sunday (1–6). Returns 0 when today IS Sunday.
export function daysUntilSunday() {
    const dow = new Date().getDay() // 0 = Sun
    return dow === 0 ? 0 : 7 - dow
}

export function getDatesBetween(startDateStr, endDateStr) {
    if (!endDateStr) return [startDateStr]
    if (startDateStr === endDateStr) return [startDateStr]
    if (startDateStr > endDateStr) return []
    
    const dates = []
    let current = new Date(`${startDateStr}T00:00:00Z`)
    const end = new Date(`${endDateStr}T00:00:00Z`)
    
    while (current <= end) {
        dates.push(current.toISOString().split('T')[0])
        current.setUTCDate(current.getUTCDate() + 1)
    }
    return dates
}
