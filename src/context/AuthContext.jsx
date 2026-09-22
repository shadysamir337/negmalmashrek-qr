import { createContext, useContext, useEffect, useState } from 'react'
import {
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signOut,
} from 'firebase/auth'
import { doc, onSnapshot } from 'firebase/firestore'
import { auth, db, ADMIN_EMAIL } from '../firebase'
import { cairoDateStr } from '../utils/dateUtils'
import { MEETINGS } from '../utils/meetings.js'
import { subscribeSettings, setAppCutoff } from '../services/firestoreService.js'

const DEFAULT_CUTOFFS = Object.fromEntries(
    MEETINGS.map((m) => [m.id, m.defaultCutoff])
)

// Merge a remote lateCutoffs map onto the defaults, keeping only valid HH:MM.
function mergeCutoffs(remote = {}) {
    const out = { ...DEFAULT_CUTOFFS }
    for (const id of Object.keys(DEFAULT_CUTOFFS)) {
        if (typeof remote[id] === 'string' && /^\d{2}:\d{2}$/.test(remote[id])) {
            out[id] = remote[id]
        }
    }
    return out
}

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null)
    // 'admin' | 'scanner' | null — from /users/{uid}, or implicit for the
    // root admin account. null = signed out or no access granted.
    const [role, setRole] = useState(null)
    const [loading, setLoading] = useState(true)
    const [scanOverride, setScanOverride] = useState(() => {
        try {
            const raw = localStorage.getItem('qrAttendance.scanOverrideObj')
            if (raw) {
                const parsed = JSON.parse(raw)
                if (parsed.date === cairoDateStr()) {
                    return parsed.unlocked
                }
            }
        } catch (e) {
            // ignore JSON parse errors
        }
        return false
    })
    // Per-meeting late cutoffs are stored ORG-WIDE in Firestore (/settings),
    // so the value is the same on every device and survives sessions. We warm-
    // start from a localStorage cache to avoid a flash to the defaults, then
    // the live subscription below makes Firestore authoritative.
    const [lateCutoffs, setLateCutoffs] = useState(() => {
        try {
            const raw = localStorage.getItem('qrAttendance.lateCutoffs')
            if (raw) return mergeCutoffs(JSON.parse(raw))
        } catch (e) {
            // ignore
        }
        return { ...DEFAULT_CUTOFFS }
    })

    // Live org-wide cutoffs from Firestore (for any signed-in app user).
    useEffect(() => {
        if (!user || user.isAnonymous) return
        const unsub = subscribeSettings((data) => {
            const merged = mergeCutoffs(data?.lateCutoffs)
            setLateCutoffs(merged)
            try {
                localStorage.setItem('qrAttendance.lateCutoffs', JSON.stringify(merged))
            } catch (e) { /* ignore */ }
        })
        return () => unsub()
    }, [user])

    // Admin edits a cutoff → write to Firestore; the subscription echoes it
    // back to every device. Optimistic local update keeps the input snappy.
    async function setMeetingCutoff(meetingId, time) {
        if (!/^\d{2}:\d{2}$/.test(time)) return
        setLateCutoffs((prev) => ({ ...prev, [meetingId]: time }))
        try {
            await setAppCutoff(meetingId, time)
        } catch (e) {
            // eslint-disable-next-line no-console
            console.error('[settings] failed to save cutoff', e)
        }
    }

    useEffect(() => {
        if (!scanOverride) {
            localStorage.removeItem('qrAttendance.scanOverrideObj')
        } else {
            localStorage.setItem('qrAttendance.scanOverrideObj', JSON.stringify({
                unlocked: true,
                date: cairoDateStr()
            }))
        }
    }, [scanOverride])

    // Scanning requires a real account now — no more silent anonymous
    // sign-in. (The public event share page signs in anonymously on its own.)
    useEffect(() => {
        let unsubRole = null
        const unsub = onAuthStateChanged(auth, (u) => {
            if (unsubRole) {
                unsubRole()
                unsubRole = null
            }
            setUser(u)
            if (!u || u.isAnonymous) {
                setRole(null)
                setLoading(false)
                return
            }
            if (u.email === ADMIN_EMAIL) {
                setRole('admin')
                setLoading(false)
                return
            }
            // Live role subscription so a demotion/removal applies instantly.
            unsubRole = onSnapshot(
                doc(db, 'users', u.uid),
                (snap) => {
                    setRole(snap.exists() ? snap.data().role : null)
                    setLoading(false)
                },
                () => {
                    setRole(null)
                    setLoading(false)
                }
            )
        })
        return () => {
            unsub()
            if (unsubRole) unsubRole()
        }
    }, [])

    const isAdmin = !!user && !user.isAnonymous && (user.email === ADMIN_EMAIL || role === 'admin')
    const canScan = isAdmin || (!!user && !user.isAnonymous && role === 'scanner')

    async function login(email, password) {
        await signInWithEmailAndPassword(auth, email.trim(), password)
    }

    async function logout() {
        await signOut(auth)
    }

    const value = {
        user,
        role,
        isAdmin,
        canScan,
        loading,
        login,
        loginAdmin: login, // legacy alias
        logout,
        adminEmail: ADMIN_EMAIL,
        scanOverride,
        setScanOverride,
        lateCutoffs,
        setMeetingCutoff,
    }

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
    const ctx = useContext(AuthContext)
    if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
    return ctx
}
