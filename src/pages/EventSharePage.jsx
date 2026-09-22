import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { signInAnonymously } from 'firebase/auth'
import { auth } from '../firebase'
import { getEvent, addEventInterest } from '../services/firestoreService'
import { CalendarDays, Users, CheckCircle2, Loader2, Sparkles, User, Phone } from 'lucide-react'

export default function EventSharePage() {
    const { id } = useParams()
    const [event, setEvent] = useState(null)
    const [loading, setLoading] = useState(true)
    const [interested, setInterested] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState(null)
    const [name, setName] = useState('')
    const [phone, setPhone] = useState('')

    useEffect(() => {
        if (localStorage.getItem(`interested_${id}`)) {
            setInterested(true)
        }
        // This page is shared publicly: visitors aren't logged in, so sign in
        // anonymously first — the rules allow anonymous users to read events
        // (and bump the interest count), but nothing else.
        const ensureAuth = auth.currentUser
            ? Promise.resolve()
            : signInAnonymously(auth).catch(() => {})
        ensureAuth.then(() => getEvent(id)).then((data) => {
            setEvent(data)
            setLoading(false)
        }).catch(err => {
            console.error(err)
            setLoading(false)
        })
    }, [id])

    const handleInterested = async (e) => {
        e?.preventDefault?.()
        if (interested || submitting) return
        if (!name.trim()) {
            setError('Please enter your name.')
            return
        }
        setSubmitting(true)
        setError(null)
        try {
            await addEventInterest(id, { name: name.trim(), phone: phone.trim() })
            setInterested(true)
            localStorage.setItem(`interested_${id}`, 'true')
            setEvent(prev => prev ? { ...prev, interestedCount: (prev.interestedCount || 0) + 1 } : prev)
        } catch (err) {
            console.error(err)
            setError('Failed to record interest. Please try again.')
        } finally {
            setSubmitting(false)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <Loader2 className="animate-spin text-indigo-500" size={32} />
            </div>
        )
    }

    if (!event) {
        return (
            <div className="max-w-md mx-auto card p-10 text-center mt-6 sm:mt-12 animate-fade-in">
                <CalendarDays className="mx-auto h-12 w-12 text-slate-300 mb-3" />
                <p className="font-semibold text-slate-700">Event not found</p>
                <p className="text-sm text-slate-500 mt-1">It may have been deleted.</p>
            </div>
        )
    }

    return (
        <div className="max-w-md mx-auto animate-fade-in">
            <div className="card overflow-hidden">
                {/* Hero */}
                <div className="relative bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 p-6 sm:p-8 text-white text-center overflow-hidden">
                    <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-3xl -mr-12 -mt-12" />
                    <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -ml-10 -mb-10" />
                    <div className="absolute inset-0 opacity-20" style={{
                        backgroundImage:
                            'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.4) 1px, transparent 0)',
                        backgroundSize: '24px 24px',
                    }} />

                    <div className="relative z-10">
                        <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white/15 backdrop-blur-sm ring-1 ring-white/30 mb-4 shadow-lg">
                            <CalendarDays size={36} className="text-white" />
                        </div>
                        <h1 className="heading-1 mb-3 leading-tight">{event.name}</h1>
                        <p className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm ring-1 ring-white/25 px-3 py-1.5 rounded-full text-sm font-semibold">
                            <CalendarDays size={14} />
                            {event.date}
                            {event.endDate && event.endDate !== event.date ? ` → ${event.endDate}` : ''}
                        </p>
                    </div>
                </div>

                {/* Body */}
                <div className="p-5 sm:p-6">
                    <div className="mb-6">
                        <h3 className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <Sparkles size={12} className="text-indigo-500" />
                            About this event
                        </h3>
                        <p className="text-slate-700 leading-relaxed whitespace-pre-wrap text-sm sm:text-base">
                            {event.description || <span className="italic text-slate-400">No description provided.</span>}
                        </p>
                    </div>

                    <div className="bg-gradient-to-br from-indigo-50 to-violet-50 border border-indigo-100 rounded-2xl p-4 sm:p-5 mb-5 flex items-center justify-between">
                        <div>
                            <div className="text-[10px] sm:text-xs font-bold text-indigo-700/70 uppercase tracking-wide mb-1">
                                Interested
                            </div>
                            <div className="text-2xl sm:text-3xl font-black text-indigo-900 tabular-nums">
                                {event.interestedCount || 0}
                            </div>
                        </div>
                        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-white/70 text-indigo-600 flex items-center justify-center shadow-sm">
                            <Users size={26} />
                        </div>
                    </div>

                    {error && (
                        <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-sm font-medium animate-fade-in">
                            {error}
                        </div>
                    )}

                    {interested ? (
                        <div className="w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 size={20} />
                            You're marked as interested!
                        </div>
                    ) : (
                        <form onSubmit={handleInterested} className="space-y-3">
                            <div className="relative">
                                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Your name"
                                    maxLength={100}
                                    required
                                    className="input pl-9"
                                />
                            </div>
                            <div className="relative">
                                <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="tel"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    placeholder="Phone number (optional)"
                                    maxLength={30}
                                    className="input pl-9"
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={submitting}
                                className="btn btn-primary w-full text-base py-4"
                            >
                                {submitting ? (
                                    <><Loader2 size={20} className="animate-spin" /> Recording…</>
                                ) : (
                                    <>Count me in! ✨</>
                                )}
                            </button>
                        </form>
                    )}
                </div>
            </div>

            <p className="text-center text-[11px] text-slate-500 mt-4">
                Powered by QR Attendance
            </p>
        </div>
    )
}
