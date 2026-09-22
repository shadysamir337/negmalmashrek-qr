import {
    cairoDateStr,
    cairoEndOfDay,
    isCairoPastDay,
    msFromTimestamp,
} from './dateUtils.js'
import { isMeetingDate, meetingLabel } from './meetings.js'

// Builds the roster of ONE meeting on ONE day: who attended (split into
// on-time vs late by `lateCutoff`), who is absent, and who was added to the
// people list after the day ended.
//
// `records` may contain every meeting type — only docs matching `meetingId`
// (and `day`) count. Absences only apply on days the meeting actually occurs
// (`isScheduledDay`): an admin-override scan on an off day still shows the
// scan, but never marks the rest of the list Absent.
export function buildRosterForDay(day, records, people, { meetingId, lateCutoff }) {
    const endOfDay = cairoEndOfDay(day)
    const dayRecords = records.filter((r) => r.date === day && r.type === meetingId)
    const attendedById = new Map(dayRecords.map((r) => [r.personId, r]))

    const isScheduledDay = isMeetingDate(meetingId, day)

    // A day is "finalised" only once Cairo midnight has rolled past it.
    // Until then we don't mark anyone Absent — we just hide non-scanners.
    const isFinalised = isCairoPastDay(day)

    const attended = []
    const absent = []
    const addedLater = []
    const late = []

    // Prefer the Late flag frozen onto the record at scan time; fall back to
    // the live cutoff only for older records that don't carry one.
    const wasLate = (r) =>
        typeof r.late === 'boolean' ? r.late : !!(lateCutoff && r.time > lateCutoff + ':00')

    for (const p of people) {
        if (attendedById.has(p.id)) {
            const r = attendedById.get(p.id)
            const isLate = wasLate(r)
            const item = {
                id: p.id,
                recordId: r.id, // attendance doc id — lets admins delete this scan
                name: p.name,
                time: r.time,
            }
            if (isLate) {
                late.push(item)
            } else {
                attended.push(item)
            }
            continue
        }
        const createdMs = msFromTimestamp(p.createdAt)
        if (endOfDay && createdMs !== null && createdMs > endOfDay.getTime()) {
            const cDate = new Date(createdMs)
            const addedDate = cairoDateStr(cDate)
            const addedTime = cDate.toLocaleTimeString('en-US', { timeZone: 'Africa/Cairo', hour12: false, hour: '2-digit', minute: '2-digit' })
            addedLater.push({
                id: p.id,
                name: p.name,
                addedOn: addedDate,
                time: addedTime,
            })
        } else if (isFinalised && isScheduledDay) {
            absent.push({ id: p.id, name: p.name })
        }
        // else: today / future / off-schedule day → not attended, not
        // added-later → don't list
    }
    attended.sort((a, b) => a.time.localeCompare(b.time))
    late.sort((a, b) => a.time.localeCompare(b.time))
    absent.sort((a, b) => a.name.localeCompare(b.name))
    addedLater.sort((a, b) => a.name.localeCompare(b.name))

    // Edge case: scans for people no longer in /people.
    const knownIds = new Set(people.map((p) => p.id))
    for (const r of dayRecords) {
        if (!knownIds.has(r.personId)) {
            const isLate = wasLate(r)
            const item = {
                id: r.personId,
                recordId: r.id, // attendance doc id — lets admins delete this scan
                name: `[Deleted User ${r.personId.slice(0, 5)}]`,
                time: r.time,
            }
            if (isLate) {
                late.push(item)
            } else {
                attended.push(item)
            }
        }
    }
    attended.sort((a, b) => a.time.localeCompare(b.time))

    return {
        day,
        meetingId,
        meetingLabel: meetingLabel(meetingId),
        isScheduledDay,
        isFinalised,
        attended,
        absent,
        addedLater,
        late,
    }
}
