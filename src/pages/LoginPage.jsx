import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Lock, Mail, Loader2, ShieldCheck, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
    const { login, isAdmin, canScan } = useAuth()
    const navigate = useNavigate()
    const location = useLocation()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [showPw, setShowPw] = useState(false)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState(null)

    const from = location.state?.from || '/'

    // Admins land on the page they came from; scanners go straight to Scan.
    useEffect(() => {
        if (isAdmin) navigate(from, { replace: true })
        else if (canScan) navigate('/scan', { replace: true })
    }, [isAdmin, canScan, from, navigate])

    async function handleSubmit(e) {
        e.preventDefault()
        if (busy) return
        setBusy(true)
        setError(null)
        try {
            await login(email, password)
            // The effect above redirects once the role has loaded.
        } catch (err) {
            const msg =
                err?.code === 'auth/invalid-credential' ||
                    err?.code === 'auth/wrong-password' ||
                    err?.code === 'auth/user-not-found'
                    ? 'Wrong email or password.'
                    : err?.code === 'auth/too-many-requests'
                        ? 'Too many attempts. Try again later.'
                        : err?.code === 'auth/network-request-failed'
                            ? 'Network error. Check your connection.'
                            : 'Login failed.'
            setError(msg)
        } finally {
            setBusy(false)
        }
    }

    return (
        <div className="max-w-sm mx-auto mt-4 sm:mt-12 animate-fade-in">
            <div className="card p-6 sm:p-8">
                <div className="flex flex-col items-center text-center mb-6">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 flex items-center justify-center text-white shadow-glow mb-3 ring-1 ring-white/30">
                        <ShieldCheck size={28} />
                    </div>
                    <h1 className="heading-1 text-slate-900">Sign in</h1>
                    <p className="text-xs sm:text-sm text-slate-500 mt-1">
                        Admins manage everything · Scanners record attendance
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="label" htmlFor="email">Email</label>
                        <div className="relative">
                            <Mail
                                size={16}
                                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                            />
                            <input
                                id="email"
                                type="email"
                                autoComplete="email"
                                required
                                maxLength={120}
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="input pl-9"
                                placeholder="admin@example.com"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="label" htmlFor="password">Password</label>
                        <div className="relative">
                            <Lock
                                size={16}
                                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                            />
                            <input
                                id="password"
                                type={showPw ? 'text' : 'password'}
                                autoComplete="current-password"
                                required
                                maxLength={200}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="input pl-9 pr-10"
                                placeholder="••••••••"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPw(v => !v)}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                                aria-label={showPw ? 'Hide password' : 'Show password'}
                                tabIndex={-1}
                            >
                                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                    </div>

                    {error && (
                        <div className="text-sm bg-rose-50 border border-rose-200 text-rose-700 rounded-xl px-3 py-2 animate-fade-in">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={busy || !email || !password}
                        className="btn btn-primary w-full text-base py-3"
                    >
                        {busy && <Loader2 size={16} className="animate-spin" />}
                        {busy ? 'Signing in…' : 'Sign in'}
                    </button>
                </form>

                <p className="mt-5 text-[11px] sm:text-xs text-slate-500 text-center">
                    No account? Ask the admin to create one for you.
                </p>
            </div>
        </div>
    )
}
