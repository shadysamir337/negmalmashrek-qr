import {
    collection,
    addDoc,
    getDocs,
    deleteDoc,
    doc,
    setDoc,
    getDoc,
    query,
    where,
    onSnapshot,
    orderBy,
    serverTimestamp,
    updateDoc,
    writeBatch,
    increment,
} from 'firebase/firestore'
import { initializeApp, deleteApp } from 'firebase/app'
import {
    getAuth,
    createUserWithEmailAndPassword,
    signOut as authSignOut,
} from 'firebase/auth'
import { db, auth, firebaseConfig } from '../firebase'
import { MEETING_IDS, LEGACY_TYPE, normalizeType } from '../utils/meetings.js'

const peopleCol = collection(db, 'people')
const attendanceCol = collection(db, 'attendance')
const archivesCol = collection(db, 'archives')
const eventsCol = collection(db, 'events')
const usersCol = collection(db, 'users')

const MAX_NAME = 100

function sanitizeName(name) {
    const t = String(name ?? '').trim()
    if (!t) throw new Error('Name is required')
    if (t.length > MAX_NAME)
        throw new Error(`Name is too long (max ${MAX_NAME} characters)`)
    return t
}

// ----- People -----

export function subscribePeople(cb) {
    const q = query(peopleCol, orderBy('name'))
    return onSnapshot(
        q,
        (snap) => {
            const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
            cb(items)
        },
        (err) => {
            // eslint-disable-next-line no-console
            console.error('[firestore] people listener error:', err)
        }
    )
}

export async function addPerson(name) {
    const trimmed = sanitizeName(name)
    const ref = await addDoc(peopleCol, {
        name: trimmed,
        createdAt: serverTimestamp(),
    })
    return ref.id
}

export async function addPeopleBulk(names) {
    // Dedup within input
    const unique = []
    const seen = new Set()
    for (const n of names) {
        try {
            const t = sanitizeName(n)
            const key = t.toLowerCase()
            if (!seen.has(key)) {
                seen.add(key)
                unique.push(t)
            }
        } catch {
            // skip invalid entries
        }
    }
    // Avoid re-adding existing names
    const existing = await getDocs(peopleCol)
    const existingNames = new Set(
        existing.docs.map((d) => String(d.data().name || '').toLowerCase())
    )
    const toAdd = unique.filter((n) => !existingNames.has(n.toLowerCase()))

    let added = 0
    for (let i = 0; i < toAdd.length; i += 450) {
        const chunk = toAdd.slice(i, i + 450)
        const batch = writeBatch(db)
        for (const name of chunk) {
            const ref = doc(peopleCol)
            batch.set(ref, { name, createdAt: serverTimestamp() })
        }
        await batch.commit()
        added += chunk.length
    }
    return { added, skipped: unique.length - toAdd.length }
}

export async function updatePersonName(id, name) {
    const trimmed = sanitizeName(name)
    await setDoc(doc(db, 'people', id), { name: trimmed }, { merge: true })
}

export async function deletePerson(id) {
    await deleteDoc(doc(db, 'people', id))
}

// Delete many people in batches.
export async function deletePeopleBulk(ids) {
    let removed = 0
    for (let i = 0; i < ids.length; i += 450) {
        const chunk = ids.slice(i, i + 450)
        const batch = writeBatch(db)
        for (const id of chunk) {
            batch.delete(doc(db, 'people', id))
        }
        await batch.commit()
        removed += chunk.length
    }
    return { removed }
}

// ----- Attendance -----

// We use a DETERMINISTIC document ID `${personId}_${date}_${type}` so that:
// 1) The same person can never be checked in twice for the same meeting on
//    the same day (Firestore rejects the second setDoc via rules).
// 2) The race condition (two scanners scanning at the same instant) is
//    eliminated server-side -- only one of them wins.
// Docs created before meeting types existed use the legacy `${personId}_${date}`
// ID and have no `type` field — they normalize to LEGACY_TYPE at read time.
function attendanceDocId(personId, date, type, eventId) {
    if (eventId) {
        return `${personId}_${date}_${type}_${eventId}`
    }
    return `${personId}_${date}_${type}`
}

function legacyAttendanceDocId(personId, date) {
    return `${personId}_${date}`
}

// Single chokepoint for legacy docs: every read path MUST map docs through
// this so records without a `type` field get a meeting inferred from their
// own date/time (null when the date is not a meeting day).
function normalizeAttendance(d) {
    const data = d.data()
    return { id: d.id, ...data, type: normalizeType(data.type, data.date, data.time) }
}

export function subscribeAttendance(cb, dateFilter = null) {
    // A date filter + orderBy(timestamp) would require a composite index;
    // a single day's records are few, so sort those client-side instead.
    const q = dateFilter
        ? query(attendanceCol, where('date', '==', dateFilter))
        : query(attendanceCol, orderBy('timestamp', 'desc'))

    return onSnapshot(
        q,
        (snap) => {
            const items = snap.docs.map(normalizeAttendance)
            if (dateFilter) items.sort((a, b) => String(b.time).localeCompare(String(a.time)))
            cb(items)
        },
        (err) => {
            // eslint-disable-next-line no-console
            console.error('[firestore] attendance listener error:', err)
        }
    )
}

export async function hasCheckedInToday(personId, date, type, eventId) {
    const ref = doc(db, 'attendance', attendanceDocId(personId, date, type, eventId))
    const snap = await getDoc(ref)
    if (snap.exists()) return true
    if (type === LEGACY_TYPE) {
        const legacy = await getDoc(doc(db, 'attendance', legacyAttendanceDocId(personId, date)))
        return legacy.exists()
    }
    return false
}

export async function addAttendance({ personId, name, date, time, type, late, eventId, eventName }) {
    if (!personId || typeof personId !== 'string')
        throw new Error('personId is required')
    const cleanName = sanitizeName(name)
    if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date))
        throw new Error('invalid date')
    if (!/^[0-9]{2}:[0-9]{2}:[0-9]{2}$/.test(time))
        throw new Error('invalid time')
    if (!MEETING_IDS.includes(type))
        throw new Error('invalid meeting type')

    const id = attendanceDocId(personId, date, type, eventId)
    const ref = doc(db, 'attendance', id)
    // Pre-check (so rules error becomes a friendly message).
    const existing = await getDoc(ref)
    if (existing.exists()) {
        const err = new Error('already-checked-in')
        err.code = 'already-checked-in'
        throw err
    }
    // Cutover guard: a Sunday scan recorded by the OLD app version used the
    // legacy ID, which the new ID scheme wouldn't collide with.
    if (type === LEGACY_TYPE) {
        const legacy = await getDoc(doc(db, 'attendance', legacyAttendanceDocId(personId, date)))
        if (legacy.exists()) {
            const err = new Error('already-checked-in')
            err.code = 'already-checked-in'
            throw err
        }
    }
    const payload = {
        personId,
        name: cleanName,
        date,
        time,
        type,
        timestamp: serverTimestamp(),
    }
    if (eventId) payload.eventId = eventId
    if (eventName) payload.eventName = eventName
    // Frozen Late/On-time decision captured at record time. Optional so older
    // records (without it) fall back to the live cutoff in reports.
    if (typeof late === 'boolean') payload.late = late
    await setDoc(ref, payload)
    return id
}

// Delete a single attendance record by its document id. Admin-only (enforced
// by Firestore rules). Works for both new (`personId_date_type`) and legacy
// (`personId_date`) ids since we just delete by the doc's own id.
export async function deleteAttendance(id) {
    if (!id || typeof id !== 'string') throw new Error('record id is required')
    await deleteDoc(doc(db, 'attendance', id))
}

export async function clearAttendance() {
    const snap = await getDocs(attendanceCol)
    for (let i = 0; i < snap.docs.length; i += 450) {
        const chunk = snap.docs.slice(i, i + 450)
        const batch = writeBatch(db)
        chunk.forEach((d) => batch.delete(d.ref))
        await batch.commit()
    }
}

// ----- Archives (year-end) -----
//
// Schema:
//   /archives/{year}              { year, archivedAt, archivedBy,
//                                    totalScans, months: { "1": n, ... } }
//   /archives/{year}/records/{id} -- frozen copies of attendance docs from `year`
//
// Doc ID is the year ("2026"), so a year can only be archived once. Re-archive
// = delete + re-create.

// Live list of all archived years. Sorted newest first.
export function subscribeArchives(cb) {
    const q = query(archivesCol, orderBy('year', 'desc'))
    return onSnapshot(
        q,
        (snap) => {
            const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
            cb(items)
        },
        (err) => {
            // eslint-disable-next-line no-console
            console.error('[firestore] archives listener error:', err)
        }
    )
}

export async function getArchiveSummary(year) {
    const ref = doc(db, 'archives', String(year))
    const snap = await getDoc(ref)
    return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

// Returns all the frozen records for an archived year, ordered by date+time desc.
// Single-field orderBy → no custom index needed.
export async function getArchivedRecords(year) {
    const sub = collection(db, 'archives', String(year), 'records')
    const snap = await getDocs(query(sub, orderBy('timestamp', 'desc')))
    return snap.docs.map(normalizeAttendance)
}

// Reads the live attendance docs whose `date` falls inside the given year and
// copies them into /archives/{year}/records/* in batches. Also writes the
// summary doc /archives/{year}.
//
// Idempotent for the same year: caller should check getArchiveSummary first.
// We additionally guard against accidental re-archive by using setDoc with
// merge:false on the summary doc.
export async function archiveYear(year) {
    const yearStr = String(year)
    const start = `${yearStr}-01-01`
    const end = `${yearStr}-12-31`

    // 1) Pull all attendance docs in the year from the live collection.
    const yearQ = query(
        attendanceCol,
        where('date', '>=', start),
        where('date', '<=', end)
    )
    const yearSnap = await getDocs(yearQ)
    const records = yearSnap.docs.map((d) => ({ id: d.id, data: d.data() }))

    // 2) Compute monthly + per-meeting counts.
    const months = {}
    for (let m = 1; m <= 12; m++) months[String(m)] = 0
    const byType = Object.fromEntries(MEETING_IDS.map((t) => [t, 0]))
    for (const { data } of records) {
        const m = parseInt(String(data.date).slice(5, 7), 10)
        if (m >= 1 && m <= 12) months[String(m)]++
        const t = normalizeType(data.type, data.date, data.time)
        if (t in byType) byType[t]++
    }

    // 3) Write the records into /archives/{year}/records/* in batches.
    const recordsCol = collection(db, 'archives', yearStr, 'records')
    for (let i = 0; i < records.length; i += 450) {
        const chunk = records.slice(i, i + 450)
        const batch = writeBatch(db)
        for (const r of chunk) {
            // Strip the live `timestamp` field-value (it's a Firestore Timestamp,
            // which is fine to copy as-is).
            batch.set(doc(recordsCol, r.id), {
                personId: r.data.personId,
                name: r.data.name,
                date: r.data.date,
                time: r.data.time,
                type: normalizeType(r.data.type, r.data.date, r.data.time),
                timestamp: r.data.timestamp ?? null,
            })
        }
        await batch.commit()
    }

    // 4) Write the summary doc.
    const summaryRef = doc(db, 'archives', yearStr)
    await setDoc(summaryRef, {
        year: parseInt(yearStr, 10),
        archivedAt: serverTimestamp(),
        archivedBy: auth.currentUser?.email ?? auth.currentUser?.uid ?? 'unknown',
        totalScans: records.length,
        months,
        byType,
    })

    return { totalScans: records.length, months, byType }
}

// Delete /archives/{year} and all of its sub-records. Admin-only.
export async function deleteArchive(year) {
    const yearStr = String(year)
    const sub = collection(db, 'archives', yearStr, 'records')
    const snap = await getDocs(sub)
    for (let i = 0; i < snap.docs.length; i += 450) {
        const chunk = snap.docs.slice(i, i + 450)
        const batch = writeBatch(db)
        chunk.forEach((d) => batch.delete(d.ref))
        await batch.commit()
    }
    await deleteDoc(doc(db, 'archives', yearStr))
}

// Convenience: delete + archive (admin-only flow).
export async function reArchiveYear(year) {
    await deleteArchive(year)
    return archiveYear(year)
}

// ----- Events -----

export function subscribeEvents(cb) {
    const q = query(eventsCol, orderBy('createdAt', 'desc'))
    return onSnapshot(
        q,
        (snap) => {
            const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
            cb(items)
        },
        (err) => {
            console.error('[firestore] events listener error:', err)
        }
    )
}

export async function addEvent({ name, date, endDate, description }) {
    const ref = await addDoc(eventsCol, {
        name: sanitizeName(name),
        date,
        endDate: endDate || date,
        description,
        interestedCount: 0,
        createdAt: serverTimestamp(),
    })
    return ref.id
}

export async function updateEvent(id, { name, date, endDate, description }) {
    await setDoc(doc(db, 'events', id), {
        name: sanitizeName(name),
        date,
        endDate: endDate || date,
        description,
    }, { merge: true })
}

export async function deleteEvent(id) {
    await deleteDoc(doc(db, 'events', id))
}

export async function getEvent(id) {
    const ref = doc(db, 'events', id)
    const snap = await getDoc(ref)
    return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

export async function incrementEventInterest(id) {
    const ref = doc(db, 'events', id)
    await setDoc(ref, { interestedCount: increment(1) }, { merge: true })
}

// Record an interested person on the public share page. Stores their name
// (and optional phone) under /events/{id}/interested AND bumps the event's
// interestedCount — both in one atomic batch so the list and the number stay
// in sync. Anonymous visitors are allowed to create here (see firestore.rules).
export async function addEventInterest(eventId, { name, phone }) {
    if (!eventId) throw new Error('eventId is required')
    const clean = sanitizeName(name)
    const data = { name: clean, createdAt: serverTimestamp() }
    const phoneClean = String(phone ?? '').trim()
    if (phoneClean) data.phone = phoneClean.slice(0, 30)

    const batch = writeBatch(db)
    const interestRef = doc(collection(db, 'events', eventId, 'interested'))
    batch.set(interestRef, data)
    batch.set(doc(db, 'events', eventId), { interestedCount: increment(1) }, { merge: true })
    await batch.commit()
    return interestRef.id
}

// Live list of people who marked interest in an event (newest first).
// Admin-only read per firestore.rules.
export function subscribeEventInterested(eventId, cb) {
    const q = query(
        collection(db, 'events', eventId, 'interested'),
        orderBy('createdAt', 'desc')
    )
    return onSnapshot(
        q,
        (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
        (err) => {
            // eslint-disable-next-line no-console
            console.error('[firestore] interested listener error:', err)
        }
    )
}

// Remove one interested entry (admin — e.g. spam/test rows). Intentionally
// does NOT decrement interestedCount, so the historical total is preserved.
export async function deleteEventInterest(eventId, interestId) {
    await deleteDoc(doc(db, 'events', eventId, 'interested', interestId))
}

// ----- App settings (shared across all devices) -----
//
// A single doc /settings/general holds org-wide configuration that must be
// the same on every phone/laptop — currently the per-meeting late cutoffs.
// Stored in Firestore (not localStorage) so it persists and stays in sync
// across devices and sessions.

const settingsDoc = doc(db, 'settings', 'general')

export function subscribeSettings(cb) {
    return onSnapshot(
        settingsDoc,
        (snap) => cb(snap.exists() ? snap.data() : {}),
        (err) => {
            // eslint-disable-next-line no-console
            console.error('[firestore] settings listener error:', err)
            cb({})
        }
    )
}

// Set one meeting's late cutoff (admin only, per rules). Deep-merges so the
// other meetings' cutoffs are untouched.
export async function setAppCutoff(meetingId, time) {
    if (!/^\d{2}:\d{2}$/.test(time)) throw new Error('invalid time')
    await setDoc(settingsDoc, { lateCutoffs: { [meetingId]: time } }, { merge: true })
}

// ----- Users (admin-managed accounts with roles) -----

export const USER_ROLES = ['admin', 'scanner']

export function subscribeUsers(cb) {
    const q = query(usersCol, orderBy('createdAt', 'desc'))
    return onSnapshot(
        q,
        (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
        (err) => {
            // eslint-disable-next-line no-console
            console.error('[firestore] users listener error:', err)
        }
    )
}

// Creates the Firebase Auth account on a throwaway secondary app instance so
// the admin's own session is untouched, then writes the role doc that the
// security rules use to grant access.
export async function createUserAccount({ name, email, password, role }) {
    if (!USER_ROLES.includes(role)) throw new Error('Invalid role')
    const cleanEmail = String(email ?? '').trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) throw new Error('Invalid email')
    if (String(password ?? '').length < 6) throw new Error('Password must be at least 6 characters')

    const secondary = initializeApp(firebaseConfig, `account-creation-${Date.now()}`)
    try {
        const secondaryAuth = getAuth(secondary)
        const cred = await createUserWithEmailAndPassword(secondaryAuth, cleanEmail, password)
        const uid = cred.user.uid
        await authSignOut(secondaryAuth)
        await setDoc(doc(db, 'users', uid), {
            email: cleanEmail,
            name: sanitizeName(name || cleanEmail.split('@')[0]),
            role,
            createdAt: serverTimestamp(),
        })
        return uid
    } finally {
        await deleteApp(secondary)
    }
}

export async function setUserRole(uid, role) {
    if (!USER_ROLES.includes(role)) throw new Error('Invalid role')
    await updateDoc(doc(db, 'users', uid), { role })
}

// Deleting the role doc revokes all app access immediately (the rules check
// it on every read/write). The Auth account itself can only be deleted from
// the Firebase console.
export async function removeUserAccess(uid) {
    await deleteDoc(doc(db, 'users', uid))
}

