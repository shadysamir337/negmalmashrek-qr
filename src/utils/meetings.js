// Definitions of the meetings tracked by the app, plus helpers shared by
// the scanner, reports, and exports.
//
// Attendance docs carry a `type` field holding one of the MEETINGS ids.
// Docs written before meeting types existed have no `type` field —
// normalizeType() infers their meeting from the record's own date and time
// (Sundays → Sunday Meeting, Friday mornings → Church Service, Friday
// evenings → Friday Meeting). Legacy records on non-meeting days get a null
// type and only surface under the combined tab.

import { cairoNowParts, weekdayOf, daysOfYear } from './dateUtils.js'

// `dayOfWeek: null` marks a meeting with no fixed weekday (Events): it can
// be scanned/recorded on any date, is never flagged off-schedule, and has no
// expected dates for attendance-rate stats.
export const MEETINGS = [
    { id: 'sunday', label: 'Sunday Meeting', short: 'Sunday', dayOfWeek: 0, dayName: 'Sunday', defaultCutoff: '19:00' },
    { id: 'friday', label: 'NegmAlMashrek Meeting', short: 'NegmAlMashrek', dayOfWeek: 5, dayName: 'Friday', defaultCutoff: '19:00' },
    { id: 'friday-service', label: 'Church Service', short: 'Service', dayOfWeek: 5, dayName: 'Friday', defaultCutoff: '09:00' },
    { id: 'events', label: 'Events', short: 'Events', dayOfWeek: null, dayName: 'Any day', defaultCutoff: '19:00' },
]

export const MEETING_IDS = MEETINGS.map((m) => m.id)
export const MEETINGS_BY_ID = Object.fromEntries(MEETINGS.map((m) => [m.id, m]))

// Meeting assigned to attendance docs that predate meeting types.
export const LEGACY_TYPE = 'sunday'

// The project went live on this date. Earlier days never count: they are not
// eligible meeting days for attendance stats, and manual check-ins before
// this date are blocked.
export const PROJECT_START = '2026-06-05'

// Pseudo-id used by the Records page for the combined "All meetings" tab.
export const COMBINED_TAB = 'all'

export function meetingLabel(id) {
    return MEETINGS_BY_ID[id]?.label ?? (id || 'Off-schedule')
}

// Meeting a legacy (untyped) record belongs to, judged by its own date/time.
// Friday's noon split mirrors defaultMeetingFor(): service in the morning,
// meeting in the evening. Non-meeting days → null (combined tab only).
export function inferLegacyType(isoDate, time) {
    const m = String(isoDate).match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (!m) return LEGACY_TYPE
    const dow = weekdayOf(+m[1], +m[2], +m[3])
    if (dow === 0) return 'sunday'
    if (dow === 5) return String(time ?? '') < '12:00' ? 'friday-service' : 'friday'
    return null
}

export function normalizeType(t, date, time) {
    return MEETING_IDS.includes(t) ? t : inferLegacyType(date, time)
}

// 0 (Sun) – 6 (Sat) for "now" as observed in Cairo. The scan lock must use
// Cairo's weekday, not the device's — two phones with different clocks/TZs
// must agree on whether the meeting is today.
function cairoWeekday(date = new Date()) {
    const { y, m, d } = cairoNowParts(date)
    return weekdayOf(y, m, d)
}

// Which meeting the scanner should pre-select right now (Cairo time):
// Friday before noon → Church Service, Friday after → Friday Meeting,
// anything else → Sunday Meeting.
export function defaultMeetingFor(date = new Date()) {
    const { y, m, d, hh } = cairoNowParts(date)
    const dow = weekdayOf(y, m, d)
    if (dow === 5) return hh < 12 ? 'friday-service' : 'friday'
    return 'sunday'
}

export function isMeetingDayToday(meetingId, date = new Date()) {
    const m = MEETINGS_BY_ID[meetingId]
    if (!m) return false
    if (m.dayOfWeek == null) return true // no fixed day — always available
    return cairoWeekday(date) === m.dayOfWeek
}

// Days until this meeting's next occurrence. 0 when today IS that weekday.
export function daysUntilMeeting(meetingId, date = new Date()) {
    const m = MEETINGS_BY_ID[meetingId]
    if (!m || m.dayOfWeek == null) return 0
    return (m.dayOfWeek - cairoWeekday(date) + 7) % 7
}

// True iff the calendar date falls on this meeting's scheduled weekday.
// Meetings without a fixed day return false: they're never "scheduled" on a
// given date, so rosters/expected-day stats only count where scans exist.
export function isMeetingDate(meetingId, isoDate) {
    const m = MEETINGS_BY_ID[meetingId]
    if (!m || m.dayOfWeek == null || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(String(isoDate))) return false
    const [y, mo, d] = String(isoDate).split('-').map((s) => parseInt(s, 10))
    return weekdayOf(y, mo, d) === m.dayOfWeek
}

// Every "YYYY-MM-DD" in `year` on which this meeting occurs, starting from
// PROJECT_START — earlier days don't count toward any stats.
export function meetingDatesOfYear(year, meetingId) {
    return daysOfYear(year).filter((d) => d >= PROJECT_START && isMeetingDate(meetingId, d))
}
