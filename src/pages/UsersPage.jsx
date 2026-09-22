import { useEffect, useMemo, useState } from 'react'
import {
    UserCog,
    UserPlus,
    Mail,
    Lock,
    Loader2,
    Trash2,
    ShieldCheck,
    ScanLine,
    Eye,
    EyeOff,
    Crown,
    AlertCircle,
} from 'lucide-react'
import {
    subscribeUsers,
    createUserAccount,
    setUserRole,
    removeUserAccess,
    USER_ROLES,
} from '../services/firestoreService.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../context/ToastContext.jsx'

const ROLE_META = {
    admin: { label: 'Admin', icon: ShieldCheck, pill: 'bg-violet-100 text-violet-700 border-violet-200' },
    scanner: { label: 'Scanner', icon: ScanLine, pill: 'bg-sky-100 text-sky-700 border-sky-200' },
}

export default function UsersPage() {
    const { adminEmail, user: me } = useAuth()
    const toast = useToast()
    const [users, setUsers] = useState([])
    const [loading, setLoading] = useState(true)

    // Create form
    const [name, setName] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [showPw, setShowPw] = useState(false)
    const [role, setRole] = useState('scanner')
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState(null)

    const [confirmRemove, setConfirmRemove] = useState(null) // uid | null
    const [rowBusy, setRowBusy] = useState(null) // uid | null

    useEffect(() => {
        const unsub = subscribeUsers((items) => {
            setUsers(items)
            setLoading(false)
        })
        return () => unsub && unsub()
    }, [])

    const canSubmit = email.trim() && password.length >= 6 && !busy

    async function handleCreate(e) {
        e.preventDefault()
        if (!canSubmit) return
        setBusy(true)
        setError(null)
        try {
            await createUserAccount({ name, email, password, role })
            toast?.success?.(`Account created for ${email.trim()}`)
            setName('')
            setEmail('')
            setPassword('')
            setRole('scanner')
        } catch (err) {
            const msg =
                err?.code === 'auth/email-already-in-use'
                    ? 'An account with this email already exists.'
                    : err?.code === 'auth/invalid-email'
                        ? 'Invalid email address.'
                        : err?.code === 'auth/weak-password'
                            ? 'Password is too weak (min 6 characters).'
                            : err?.message || 'Failed to create the account.'
            setError(msg)
        } finally {
            setBusy(false)
        }
    }

    async function handleRoleChange(u, newRole) {
        if (u.role === newRole) return
        setRowBusy(u.id)
        try {
            await setUserRole(u.id, newRole)
            toast?.success?.(`${u.name || u.email} is now ${ROLE_META[newRole].label}`)
        } catch {
            toast?.error?.('Failed to change role.')
        } finally {
            setRowBusy(null)
        }
    }

    async function handleRemove(u) {
        setRowBusy(u.id)
        try {
            await removeUserAccess(u.id)
            toast?.success?.(`Access revoked for ${u.name || u.email}`)
        } catch {
            toast?.error?.('Failed to remove the user.')
        } finally {
            setRowBusy(null)
            setConfirmRemove(null)
        }
    }

    const sortedUsers = useMemo(
        () => [...users].sort((a, b) => (a.role === b.role ? (a.name || '').localeCompare(b.name || '') : a.role === 'admin' ? -1 : 1)),
        [users]
    )

    return (
        <div className="space-y-4 animate-fade-in max-w-3xl mx-auto">
            {/* Header */}
            <div className="card p-4 sm:p-5">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-md">
                        <UserCog size={20} />
                    </div>
                    <div className="flex-1">
                        <h1 className="text-xl font-bold">Users</h1>
                        <p className="text-xs text-slate-500">
                            Accounts that can sign in — Admins manage everything, Scanners can only scan
                        </p>
                    </div>
                </div>
            </div>

            {/* Create account */}
            <div className="card p-4 sm:p-5">
                <h2 className="heading-2 text-slate-800 flex items-center gap-2 mb-3">
                    <UserPlus size={17} className="text-indigo-600" /> Create account
                </h2>
                <form onSubmit={handleCreate} className="space-y-3">
                    <div className="grid sm:grid-cols-2 gap-3">
                        <input
                            type="text"
                            value={name}
                            maxLength={100}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Name (optional)"
                            className="input"
                        />
                        <div className="relative">
                            <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="email"
                                required
                                maxLength={120}
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="email@example.com"
                                className="input pl-9"
                                autoComplete="off"
                            />
                        </div>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-3">
                        <div className="relative">
                            <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type={showPw ? 'text' : 'password'}
                                required
                                minLength={6}
                                maxLength={200}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Password (min 6 chars)"
                                className="input pl-9 pr-10"
                                autoComplete="new-password"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPw((v) => !v)}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                                aria-label={showPw ? 'Hide password' : 'Show password'}
                                tabIndex={-1}
                            >
                                {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                            </button>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5 bg-slate-100 rounded-xl p-1">
                            {USER_ROLES.map((r) => {
                                const Meta = ROLE_META[r]
                                const active = role === r
                                return (
                                    <button
                                        key={r}
                                        type="button"
                                        onClick={() => setRole(r)}
                                        className={`px-2 py-2 rounded-lg text-xs font-semibold transition-colors inline-flex items-center justify-center gap-1.5 ${active
                                            ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow'
                                            : 'text-slate-600 hover:bg-white'
                                            }`}
                                    >
                                        <Meta.icon size={13} /> {Meta.label}
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    {error && (
                        <div className="flex items-center gap-1.5 text-xs text-rose-600 font-semibold">
                            <AlertCircle size={13} /> {error}
                        </div>
                    )}

                    <button type="submit" disabled={!canSubmit} className="btn btn-primary w-full sm:w-auto">
                        {busy ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
                        {busy ? 'Creating…' : 'Create account'}
                    </button>
                </form>
            </div>

            {/* User list */}
            <div className="card p-4 sm:p-5">
                <h2 className="heading-2 text-slate-800 mb-3">
                    Accounts{' '}
                    <span className="text-slate-400 font-normal text-sm">({users.length + 1})</span>
                </h2>

                <ul className="divide-y divide-slate-100">
                    {/* Root admin — fixed, cannot be edited or removed */}
                    <li className="py-3 flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white flex-shrink-0">
                            <Crown size={16} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-slate-800 truncate">Owner</div>
                            <div className="text-xs text-slate-500 truncate">{adminEmail}</div>
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full border bg-amber-100 text-amber-700 border-amber-200">
                            Root admin
                        </span>
                    </li>

                    {loading && (
                        <li className="py-6 text-center text-sm text-slate-400">Loading…</li>
                    )}

                    {!loading && sortedUsers.map((u) => {
                        const Meta = ROLE_META[u.role] ?? ROLE_META.scanner
                        const isMe = me?.uid === u.id
                        return (
                            <li key={u.id} className="py-3 flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 flex-shrink-0">
                                    <Meta.icon size={16} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-semibold text-slate-800 truncate">
                                        {u.name || u.email}
                                        {isMe && <span className="ml-1.5 text-[10px] text-indigo-500 font-bold">(you)</span>}
                                    </div>
                                    <div className="text-xs text-slate-500 truncate">{u.email}</div>
                                </div>

                                {confirmRemove === u.id ? (
                                    <div className="flex items-center gap-1.5">
                                        <button
                                            onClick={() => handleRemove(u)}
                                            disabled={rowBusy === u.id}
                                            className="btn btn-danger btn-sm"
                                        >
                                            {rowBusy === u.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                                            Confirm
                                        </button>
                                        <button onClick={() => setConfirmRemove(null)} className="btn btn-ghost btn-sm">
                                            Cancel
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-1.5">
                                        <select
                                            value={u.role}
                                            disabled={rowBusy === u.id}
                                            onChange={(e) => handleRoleChange(u, e.target.value)}
                                            className="text-xs font-semibold border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
                                        >
                                            {USER_ROLES.map((r) => (
                                                <option key={r} value={r}>{ROLE_META[r].label}</option>
                                            ))}
                                        </select>
                                        <button
                                            onClick={() => setConfirmRemove(u.id)}
                                            disabled={rowBusy === u.id}
                                            className="btn btn-icon btn-sm btn-ghost text-rose-500 hover:bg-rose-50"
                                            title="Revoke access"
                                            aria-label={`Revoke access for ${u.email}`}
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                )}
                            </li>
                        )
                    })}

                    {!loading && users.length === 0 && (
                        <li className="py-6 text-center text-sm text-slate-400">
                            No extra accounts yet — create the first one above.
                        </li>
                    )}
                </ul>

                <p className="mt-3 text-[11px] text-slate-400">
                    Removing a user revokes their access immediately. Their login still
                    exists in Firebase Authentication — delete it from the Firebase
                    console if you also want to free up the email.
                </p>
            </div>
        </div>
    )
}
