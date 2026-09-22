import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'
import Navbar from './components/Navbar.jsx'
import RequireAdmin from './components/RequireAdmin.jsx'
import RequireScanner from './components/RequireScanner.jsx'
import PeoplePage from './pages/PeoplePage.jsx'
import ScanPage from './pages/ScanPage.jsx'
import RecordsPage from './pages/RecordsPage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import EventsPage from './pages/EventsPage.jsx'
import EventSharePage from './pages/EventSharePage.jsx'
import UsersPage from './pages/UsersPage.jsx'

function Shell() {
    const { loading } = useAuth()
    return (
        <div className="min-h-dvh flex flex-col">
            <Navbar />
            <main className="flex-1 max-w-6xl w-full mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 pb-28 md:pb-8">
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="flex items-center gap-3 text-slate-600">
                            <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                            <span className="text-sm">Connecting…</span>
                        </div>
                    </div>
                ) : (
                    <Routes>
                        <Route
                            path="/scan"
                            element={
                                <RequireScanner>
                                    <ScanPage />
                                </RequireScanner>
                            }
                        />
                        <Route path="/login" element={<LoginPage />} />
                        <Route path="/event/:id" element={<EventSharePage />} />
                        <Route
                            path="/"
                            element={
                                <RequireAdmin>
                                    <PeoplePage />
                                </RequireAdmin>
                            }
                        />
                        <Route
                            path="/records"
                            element={
                                <RequireAdmin>
                                    <RecordsPage />
                                </RequireAdmin>
                            }
                        />
                        <Route
                            path="/events"
                            element={
                                <RequireAdmin>
                                    <EventsPage />
                                </RequireAdmin>
                            }
                        />
                        <Route
                            path="/users"
                            element={
                                <RequireAdmin>
                                    <UsersPage />
                                </RequireAdmin>
                            }
                        />
                        <Route path="*" element={<Navigate to="/scan" replace />} />
                    </Routes>
                )}
            </main>
            <footer className="no-print text-center text-[11px] text-slate-500 py-4 hidden md:block">
                <span className="inline-flex items-center gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-indigo-400" />
                    QR Attendance · Secured with Firebase
                    <span className="text-slate-400">· v{__APP_VERSION__}</span>
                </span>
            </footer>
        </div>
    )
}

export default function App() {
    return (
        <AuthProvider>
            <Shell />
        </AuthProvider>
    )
}
