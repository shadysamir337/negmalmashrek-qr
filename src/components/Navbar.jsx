import { useEffect, useRef, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
    QrCode,
    Users,
    UserCog,
    BarChart3,
    LogIn,
    LogOut,
    ScanLine,
    Calendar,
    Unlock,
    Lock,
    Clock,
    Settings,
    X,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { MEETINGS } from '../utils/meetings.js'

export default function Navbar() {
    const {
        isAdmin,
        user,
        logout,
        scanOverride,
        setScanOverride,
        lateCutoffs,
        setMeetingCutoff,
    } = useAuth()
    const navigate = useNavigate()
    const [adminOpen, setAdminOpen] = useState(false)
    const popRef = useRef(null)

    async function handleLogout() {
        setAdminOpen(false)
        await logout()
        navigate('/login', { replace: true })
    }

    // Close popover on outside click / Esc
    useEffect(() => {
        if (!adminOpen) return
        function onDoc(e) {
            if (popRef.current && !popRef.current.contains(e.target)) setAdminOpen(false)
        }
        function onKey(e) {
            if (e.key === 'Escape') setAdminOpen(false)
        }
        document.addEventListener('mousedown', onDoc)
        document.addEventListener('keydown', onKey)
        return () => {
            document.removeEventListener('mousedown', onDoc)
            document.removeEventListener('keydown', onKey)
        }
    }, [adminOpen])

    const desktopLink = ({ isActive }) =>
        `inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all ${isActive
            ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md'
            : 'text-slate-600 hover:bg-white/70 hover:text-slate-900'
        }`

    const mobileTab = ({ isActive }) =>
        `relative flex flex-col items-center justify-center flex-1 gap-0.5 text-[10px] font-semibold py-2 transition-colors ${isActive ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-700'
        }`

    return (
        <>
            {/* Top header */}
            <header className="no-print sticky top-0 z-30 backdrop-blur-xl bg-white/75 border-b border-white/60 safe-pad-top">
                <div className="max-w-6xl mx-auto px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between gap-2">
                    {/* Brand */}
                    <NavLink to="/scan" className="flex items-center gap-2 min-w-0">
                        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-md ring-1 ring-white/40 flex-shrink-0">
                            <QrCode size={20} />
                        </div>
                        <div className="flex flex-col leading-tight min-w-0">
                            <span className="font-bold text-base sm:text-lg text-gradient truncate">
                                QR Attendance
                            </span>
                            {isAdmin && (
                                <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-600 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    Admin mode
                                </span>
                            )}
                        </div>
                    </NavLink>

                    {/* Desktop nav */}
                    <div className="hidden md:flex items-center gap-1">
                        <NavLink to="/scan" className={desktopLink}>
                            <ScanLine size={16} /> Scan
                        </NavLink>
                        {isAdmin && (
                            <NavLink to="/" end className={desktopLink}>
                                <Users size={16} /> People
                            </NavLink>
                        )}
                        {isAdmin && (
                            <NavLink to="/records" className={desktopLink}>
                                <BarChart3 size={16} /> Records
                            </NavLink>
                        )}
                        {isAdmin && (
                            <NavLink to="/events" className={desktopLink}>
                                <Calendar size={16} /> Events
                            </NavLink>
                        )}
                        {isAdmin && (
                            <NavLink to="/users" className={desktopLink}>
                                <UserCog size={16} /> Users
                            </NavLink>
                        )}
                    </div>

                    {/* Right side actions */}
                    <div className="flex items-center gap-1.5 sm:gap-2">
                        {isAdmin && (
                            <div className="relative" ref={popRef}>
                                <button
                                    onClick={() => setAdminOpen((v) => !v)}
                                    className={`btn btn-icon btn-sm ${adminOpen ? 'btn-secondary' : 'btn-ghost'}`}
                                    aria-label="Admin tools"
                                    title="Admin tools"
                                >
                                    <Settings size={16} />
                                </button>
                                {adminOpen && (
                                    <div className="absolute right-0 mt-2 w-72 card p-3 z-50 animate-slide-down">
                                        <div className="flex items-center justify-between mb-2">
                                            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">
                                                Admin tools
                                            </h3>
                                            <button
                                                onClick={() => setAdminOpen(false)}
                                                className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                                                aria-label="Close"
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>

                                        <div className="space-y-2.5">
                                            {/* Late cutoffs (one per meeting) */}
                                            <div className="bg-orange-50 border border-orange-200 rounded-xl px-3 py-2.5">
                                                <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-orange-700 mb-1.5">
                                                    <Clock size={12} />
                                                    Late cutoffs
                                                </label>
                                                <div className="space-y-1.5">
                                                    {MEETINGS.map((m) => (
                                                        <div key={m.id} className="flex items-center gap-2">
                                                            <span className="flex-1 text-xs font-semibold text-orange-800 truncate">
                                                                {m.label}
                                                            </span>
                                                            <input
                                                                type="time"
                                                                value={lateCutoffs[m.id]}
                                                                onChange={(e) => setMeetingCutoff(m.id, e.target.value)}
                                                                className="w-28 bg-white/70 border border-orange-200 rounded-lg px-2 py-1 text-sm font-bold text-orange-900 focus:outline-none focus:ring-2 focus:ring-orange-400/40"
                                                            />
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Scan override */}
                                            <button
                                                onClick={() => setScanOverride(!scanOverride)}
                                                className={`w-full inline-flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors border ${scanOverride
                                                    ? 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100'
                                                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                                                    }`}
                                            >
                                                <span className="flex items-center gap-2">
                                                    {scanOverride ? <Unlock size={14} /> : <Lock size={14} />}
                                                    {scanOverride ? 'Scan unlocked' : 'Scan locked'}
                                                </span>
                                                <span className={`text-[10px] font-bold uppercase tracking-wide ${scanOverride ? 'text-amber-700' : 'text-slate-500'}`}>
                                                    {scanOverride ? 'on' : 'off'}
                                                </span>
                                            </button>

                                            {user?.email && (
                                                <div className="text-[11px] text-slate-500 px-1 truncate">
                                                    Signed in as <span className="font-semibold text-slate-700">{user.email}</span>
                                                </div>
                                            )}

                                            <button
                                                onClick={handleLogout}
                                                className="btn btn-danger btn-sm w-full"
                                            >
                                                <LogOut size={14} /> Logout
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {!isAdmin && (!user || user.isAnonymous) && (
                            <NavLink
                                to="/login"
                                className="btn btn-sm bg-slate-900 text-white hover:bg-slate-800 border border-slate-900"
                            >
                                <LogIn size={14} />
                                <span>Login</span>
                            </NavLink>
                        )}
                        {!isAdmin && user && !user.isAnonymous && (
                            <button
                                onClick={handleLogout}
                                className="btn btn-sm btn-ghost text-slate-600"
                                title={`Signed in as ${user.email}`}
                            >
                                <LogOut size={14} />
                                <span className="hidden xs:inline">Logout</span>
                            </button>
                        )}
                    </div>
                </div>
            </header>

            {/* Mobile bottom tab bar */}
            <nav className="no-print md:hidden fixed bottom-0 inset-x-0 z-30 backdrop-blur-xl bg-white/90 border-t border-slate-200/60 safe-pad-bottom shadow-[0_-4px_16px_-4px_rgba(15,23,42,0.06)]">
                <div className="flex max-w-lg mx-auto">
                    <NavLink to="/scan" className={mobileTab}>
                        {({ isActive }) => (
                            <>
                                {isActive && (
                                    <span className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-1 rounded-b-full bg-gradient-to-r from-indigo-500 to-violet-500" />
                                )}
                                <ScanLine size={22} strokeWidth={isActive ? 2.4 : 2} />
                                <span>Scan</span>
                            </>
                        )}
                    </NavLink>
                    {isAdmin && (
                        <NavLink to="/" end className={mobileTab}>
                            {({ isActive }) => (
                                <>
                                    {isActive && (
                                        <span className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-1 rounded-b-full bg-gradient-to-r from-indigo-500 to-violet-500" />
                                    )}
                                    <Users size={22} strokeWidth={isActive ? 2.4 : 2} />
                                    <span>People</span>
                                </>
                            )}
                        </NavLink>
                    )}
                    {isAdmin && (
                        <NavLink to="/records" className={mobileTab}>
                            {({ isActive }) => (
                                <>
                                    {isActive && (
                                        <span className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-1 rounded-b-full bg-gradient-to-r from-indigo-500 to-violet-500" />
                                    )}
                                    <BarChart3 size={22} strokeWidth={isActive ? 2.4 : 2} />
                                    <span>Records</span>
                                </>
                            )}
                        </NavLink>
                    )}
                    {isAdmin && (
                        <NavLink to="/events" className={mobileTab}>
                            {({ isActive }) => (
                                <>
                                    {isActive && (
                                        <span className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-1 rounded-b-full bg-gradient-to-r from-indigo-500 to-violet-500" />
                                    )}
                                    <Calendar size={22} strokeWidth={isActive ? 2.4 : 2} />
                                    <span>Events</span>
                                </>
                            )}
                        </NavLink>
                    )}
                    {isAdmin && (
                        <NavLink to="/users" className={mobileTab}>
                            {({ isActive }) => (
                                <>
                                    {isActive && (
                                        <span className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-1 rounded-b-full bg-gradient-to-r from-indigo-500 to-violet-500" />
                                    )}
                                    <UserCog size={22} strokeWidth={isActive ? 2.4 : 2} />
                                    <span>Users</span>
                                </>
                            )}
                        </NavLink>
                    )}
                </div>
            </nav>
        </>
    )
}
