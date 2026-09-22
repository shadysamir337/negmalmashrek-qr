import { Navigate, useLocation } from 'react-router-dom'
import { ShieldOff, LogOut } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

// Scanning is for signed-in accounts only (admin or scanner role).
export default function RequireScanner({ children }) {
    const { user, canScan, loading, logout } = useAuth()
    const location = useLocation()

    if (loading) {
        return <div className="text-center text-slate-500 py-10">Loading…</div>
    }
    if (!user || user.isAnonymous) {
        return <Navigate to="/login" replace state={{ from: location.pathname }} />
    }
    if (!canScan) {
        // Signed in, but the admin hasn't granted (or has revoked) access.
        return (
            <div className="max-w-sm mx-auto mt-12 card p-6 text-center animate-fade-in">
                <div className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-500 flex items-center justify-center mx-auto mb-3">
                    <ShieldOff size={26} />
                </div>
                <h1 className="heading-1 text-slate-900 mb-1">No access</h1>
                <p className="text-sm text-slate-500 mb-4">
                    Your account ({user.email}) has no role assigned. Ask the admin to
                    add you from the Users page.
                </p>
                <button onClick={logout} className="btn btn-secondary w-full">
                    <LogOut size={15} /> Sign out
                </button>
            </div>
        )
    }
    return children
}
