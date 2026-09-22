import { useEffect, useMemo, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import {
    Camera,
    StopCircle,
    CheckCircle2,
    AlertTriangle,
    XCircle,
    Users,
    ListChecks,
    ScanLine,
    FlipHorizontal2,
} from 'lucide-react'
import {
    subscribePeople,
    addAttendance,
    subscribeAttendance,
    subscribeEvents,
} from '../services/firestoreService.js'
import { todayDateStr, nowTimeStr } from '../utils/dateUtils.js'
import { useAuth } from '../context/AuthContext.jsx'

const SCANNER_ELEMENT_ID = 'qr-scanner-region'

export default function ScanPage() {
    const { scanOverride, lateCutoffs } = useAuth()
    const [people, setPeople] = useState([])
    const [todayList, setTodayList] = useState([])
    const [events, setEvents] = useState([])
    const [scanning, setScanning] = useState(false)
    const [status, setStatus] = useState(null)
    const [cameraError, setCameraError] = useState(null)
    const [cameras, setCameras] = useState([])
    const [cameraIdx, setCameraIdx] = useState(0)
    const [selectedEventId, setSelectedEventId] = useState('')

    const scannerRef = useRef(null)
    const peopleRef = useRef([])
    const selectedEventIdRef = useRef(selectedEventId)
    const lastScanRef = useRef({ id: null, time: 0 })
    const processingRef = useRef(false)
    const camerasRef = useRef([])
    const cameraIdxRef = useRef(0)

    useEffect(() => {
        const unsub = subscribePeople((items) => {
            setPeople(items)
            peopleRef.current = items
        })
        return () => unsub && unsub()
    }, [])

    useEffect(() => {
        const today = todayDateStr()
        const unsub = subscribeAttendance((items) => {
            setTodayList(items)
        }, today)
        return () => unsub && unsub()
    }, [])

    useEffect(() => {
        const unsub = subscribeEvents((items) => setEvents(items))
        return () => unsub && unsub()
    }, [])

    useEffect(() => {
        if (!selectedEventId && events.length > 0) {
            const today = todayDateStr()
            const todayEv = events.find((e) => e.date <= today && today <= (e.endDate || e.date))
            setSelectedEventId(todayEv ? todayEv.id : events[0].id)
        }
    }, [events, selectedEventId])

    useEffect(() => {
        return () => { stopScanner() }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
        selectedEventIdRef.current = selectedEventId
    }, [selectedEventId])

    // Auto-dismiss status banner after 3.5 s
    useEffect(() => {
        if (!status) return
        const t = setTimeout(() => setStatus(null), 3500)
        return () => clearTimeout(t)
    }, [status])

    function beep(ok = true) {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)()
            const o = ctx.createOscillator()
            const g = ctx.createGain()
            o.connect(g)
            g.connect(ctx.destination)
            o.frequency.value = ok ? 880 : 280
            g.gain.value = 0.15
            o.start()
            setTimeout(() => { o.stop(); ctx.close() }, 150)
        } catch { /* ignore */ }
    }

    async function handleDecoded(decodedText) {
        if (processingRef.current) return
        const now = Date.now()
        if (
            lastScanRef.current.id === decodedText &&
            now - lastScanRef.current.time < 2500
        ) return
        lastScanRef.current = { id: decodedText, time: now }
        processingRef.current = true
        try {
            if (!/^[A-Za-z0-9_-]{1,128}$/.test(decodedText)) {
                beep(false)
                setStatus({ type: 'error', text: 'Invalid QR code.' })
                return
            }
            const person = peopleRef.current.find((p) => p.id === decodedText)
            if (!person) {
                beep(false)
                setStatus({ type: 'error', text: 'Unknown QR code (person not in the list).' })
                return
            }
            await checkIn(person)
        } catch (err) {
            beep(false)
            setStatus({ type: 'error', text: err.message || 'Failed to record' })
        } finally {
            setTimeout(() => { processingRef.current = false }, 800)
        }
    }

    async function checkIn(person) {
        const date = todayDateStr()
        const type = 'events'
        const label = 'Events'
        const time = nowTimeStr()
        
        const eventId = selectedEventIdRef.current
        if (!eventId) {
            beep(false)
            setStatus({ type: 'error', text: 'Please select an event to check into.' })
            return
        }
        const eventObj = events.find(e => e.id === eventId)
        const eventName = eventObj?.name
        
        const cutoff = lateCutoffs?.[type]
        const late = !!(cutoff && time > cutoff + ':00')
        try {
            await addAttendance({ personId: person.id, name: person.name, date, time, type, late, eventId, eventName })
            beep(true)
            setStatus({ type: 'success', text: `Welcome, ${person.name}!`, name: person.name })
        } catch (err) {
            if (err?.code === 'already-checked-in') {
                beep(false)
                setStatus({ type: 'warn', text: `${person.name} already checked in for ${eventName || label} today.` })
            } else {
                throw err
            }
        }
    }

    async function startScanner(overrideCamIdx) {
        if (scannerRef.current) return
        setCameraError(null)
        setStatus(null)

        let camList = camerasRef.current
        if (camList.length === 0) {
            try {
                camList = await Html5Qrcode.getCameras()
            } catch { camList = [] }
            camerasRef.current = camList
            setCameras(camList)
        }

        const idx = overrideCamIdx !== undefined ? overrideCamIdx : cameraIdxRef.current
        const cameraConstraint = camList[idx]?.id ?? { facingMode: 'environment' }

        let html5
        try {
            html5 = new Html5Qrcode(SCANNER_ELEMENT_ID, false)
            scannerRef.current = html5
            await html5.start(
                cameraConstraint,
                { fps: 10, qrbox: { width: 240, height: 240 } },
                (decodedText) => handleDecoded(decodedText),
                () => {}
            )
            setScanning(true)
        } catch (err) {
            setCameraError(
                err?.message ||
                'Could not start camera. Use HTTPS or localhost and grant camera permission.'
            )
            if (html5) { try { await html5.clear() } catch { } }
            scannerRef.current = null
        }
    }

    async function stopScanner() {
        const s = scannerRef.current
        scannerRef.current = null
        setScanning(false)
        if (!s) return
        try {
            const state = typeof s.getState === 'function' ? s.getState() : 2
            if (state === 2) await s.stop()
        } catch { /* ignore */ }
        try { await s.clear() } catch { /* ignore */ }
    }

    async function flipCamera() {
        if (!scanning || camerasRef.current.length < 2) return
        const nextIdx = (cameraIdxRef.current + 1) % camerasRef.current.length
        cameraIdxRef.current = nextIdx
        setCameraIdx(nextIdx)
        await stopScanner()
        await startScanner(nextIdx)
    }

    // Today's check-ins for the SELECTED event only
    const todayForMeeting = useMemo(
        () => todayList.filter((r) => r.type === 'events' && r.eventId === selectedEventId),
        [todayList, selectedEventId]
    )

    return (
        <div className="space-y-4 animate-fade-in">
            {/* Header */}
            <div className="card p-4 sm:p-5">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-md flex-shrink-0">
                        <ScanLine size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h1 className="heading-1 text-slate-900">Scan Attendance</h1>
                        <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                            <Users size={12} />
                            {todayForMeeting.length} / {people.length} checked in
                            {selectedEventId && (
                                <span className="text-indigo-600 font-semibold truncate"> · {events.find(e => e.id === selectedEventId)?.name}</span>
                            )}
                            {scanning && (
                                <>
                                    <span className="text-slate-300">·</span>
                                    <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                        Live
                                    </span>
                                </>
                            )}
                        </p>
                    </div>
                </div>

                {/* Event picker */}
                <div className="mt-3 bg-slate-100 rounded-xl p-1">
                    <select
                        value={selectedEventId}
                        onChange={(e) => setSelectedEventId(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg text-sm font-semibold text-slate-800 bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                        {events.length === 0 && <option value="">No events available</option>}
                        {events.map((ev) => (
                            <option key={ev.id} value={ev.id}>
                                {ev.name} ({ev.date})
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
                {/* Camera */}
                <div className="card p-3 sm:p-4">
                    <div className="relative w-full aspect-square bg-slate-900 rounded-2xl overflow-hidden text-white text-sm shadow-inner">
                        <div id={SCANNER_ELEMENT_ID} className="absolute inset-0" />

                        {!scanning && (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-gradient-to-br from-slate-900 to-slate-800">
                                <div className="text-center px-4">
                                    <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-sm ring-1 ring-white/20 mx-auto flex items-center justify-center mb-3">
                                        <Camera size={32} className="opacity-80" />
                                    </div>
                                    <p className="text-sm opacity-80 font-semibold">Camera is off</p>
                                    <p className="text-xs opacity-50 mt-1">Tap "Start camera" below</p>
                                </div>
                            </div>
                        )}

                        {scanning && (
                            <>
                                <div className="pointer-events-none absolute inset-6 sm:inset-10">
                                    <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-indigo-400 rounded-tl-lg" />
                                    <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-indigo-400 rounded-tr-lg" />
                                    <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-indigo-400 rounded-bl-lg" />
                                    <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-indigo-400 rounded-br-lg" />
                                </div>
                                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                                    <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse-ring" />
                                </div>
                                <div className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-black/40 backdrop-blur-sm text-[11px] font-semibold inline-flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                    Scanning…
                                </div>
                                {cameras.length >= 2 && (
                                    <button
                                        onClick={flipCamera}
                                        className="absolute bottom-3 right-3 w-9 h-9 rounded-xl bg-black/40 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/60 transition-colors"
                                        title="Switch camera"
                                        aria-label="Switch camera"
                                    >
                                        <FlipHorizontal2 size={18} />
                                    </button>
                                )}
                            </>
                        )}
                    </div>

                    <div className="mt-3">
                        {false ? (
                            <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-3 text-sm text-center font-semibold">
                                <AlertTriangle size={20} className="mx-auto mb-1.5" />
                            </div>
                        ) : !scanning ? (
                            <button onClick={() => startScanner()} className="btn btn-success w-full text-base py-3.5">
                                <Camera size={18} /> Start camera
                            </button>
                        ) : (
                            <button onClick={stopScanner} className="btn btn-danger w-full text-base py-3.5">
                                <StopCircle size={18} /> Stop camera
                            </button>
                        )}
                    </div>

                    {cameraError && (
                        <div className="mt-3 text-sm bg-rose-50 border border-rose-200 text-rose-700 rounded-xl px-3 py-2 animate-fade-in">
                            {cameraError}
                        </div>
                    )}

                    {status && (
                        <div
                            className={`mt-3 rounded-2xl px-4 py-3 text-center font-semibold shadow-sm animate-slide-up border ${status.type === 'success'
                                ? 'bg-gradient-to-br from-emerald-50 to-emerald-100 text-emerald-800 border-emerald-200'
                                : status.type === 'warn'
                                    ? 'bg-gradient-to-br from-amber-50 to-amber-100 text-amber-800 border-amber-200'
                                    : 'bg-gradient-to-br from-rose-50 to-rose-100 text-rose-800 border-rose-200'
                                }`}
                        >
                            <div className="flex items-center justify-center gap-2">
                                {status.type === 'success' && <CheckCircle2 size={20} />}
                                {status.type === 'warn' && <AlertTriangle size={20} />}
                                {status.type === 'error' && <XCircle size={20} />}
                                <span>{status.text}</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Today's check-ins */}
                <div className="card p-4">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2 min-w-0">
                            <ListChecks size={18} className="text-indigo-600 flex-shrink-0" />
                            <h2 className="heading-2 text-slate-800 truncate">
                                Today's check-ins
                                {selectedEventId && <span className="text-slate-400 font-normal text-xs"> · {events.find(e => e.id === selectedEventId)?.name}</span>}
                            </h2>
                        </div>
                        <span className="text-xs font-bold bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-2.5 py-1 rounded-full shadow-sm tabular-nums">
                            {todayForMeeting.length}
                        </span>
                    </div>
                    {todayForMeeting.length === 0 ? (
                        <div className="text-slate-500 text-sm text-center py-10 border border-dashed border-slate-200 rounded-xl bg-slate-50/40">
                            <ListChecks size={28} className="mx-auto text-slate-300 mb-2" />
                            <p className="font-medium">No check-ins yet today.</p>
                            <p className="text-xs text-slate-400 mt-0.5">Start scanning to see them appear here.</p>
                        </div>
                    ) : (
                        <ul className="divide-y divide-slate-100 max-h-[420px] overflow-auto -mx-1 px-1">
                            {todayForMeeting.map((r) => (
                                <li
                                    key={r.id}
                                    className="py-2.5 flex justify-between items-center text-sm gap-2"
                                >
                                    <span className="font-medium text-slate-800 flex items-center gap-2 min-w-0">
                                        <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
                                            <CheckCircle2 size={13} />
                                        </span>
                                        <span className="truncate">{r.name}</span>
                                    </span>
                                    <span className="text-slate-500 tabular-nums text-xs flex-shrink-0 font-medium">
                                        {r.time}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>

        </div>
    )
}
