import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function RequireAdmin({ children }) {
    const { isAdmin, loading } = useAuth()
    const location = useLocation()

    if (loading) {
        return (
            <div className="text-center text-slate-500 py-10">Loading…</div>
        )
    }
    if (!isAdmin) {
        return (
            <Navigate to="/login" replace state={{ from: location.pathname }} />
        )
    }
    return children
}
