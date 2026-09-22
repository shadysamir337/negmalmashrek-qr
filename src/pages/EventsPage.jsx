import { useState, useEffect } from 'react'
import {
    subscribeEvents,
    addEvent,
    updateEvent,
    deleteEvent,
    subscribeEventInterested,
    deleteEventInterest,
} from '../services/firestoreService'
import { cairoDateStr } from '../utils/dateUtils'
import {
    CalendarDays,
    Plus,
    Trash2,
    Share2,
    Users,
    AlertCircle,
    Loader2,
    X,
    Copy,
    MessageCircle,
    Sparkles,
    Pencil,
    Phone,
} from 'lucide-react'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import { SkeletonList } from '../components/Skeleton.jsx'
import { useToast } from '../context/ToastContext.jsx'

export default function EventsPage() {
    const toast = useToast()
    const [events, setEvents] = useState([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [editingEvent, setEditingEvent] = useState(null) // event being edited, or null for create
    const [shareEvent, setShareEvent] = useState(null)
    const [interestedEvent, setInterestedEvent] = useState(null) // event whose interested list is open
    const [confirmDelete, setConfirmDelete] = useState(null)
    const [deleting, setDeleting] = useState(false)

    const [name, setName] = useState('')
    const [date, setDate] = useState('')
    const [endDate, setEndDate] = useState('')
    const [description, setDescription] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState('')

    useEffect(() => {
        const unsub = subscribeEvents((data) => {
            setEvents(data)
            setLoading(false)
        })
        return () => unsub()
    }, [])

    function openEdit(event) {
        setEditingEvent(event)
        setName(event.name)
        setDate(event.date)
        setEndDate(event.endDate && event.endDate !== event.date ? event.endDate : '')
        setDescription(event.description || '')
        setError('')
        setShowForm(true)
    }

    function closeForm() {
        setShowForm(false)
        setEditingEvent(null)
        setName('')
        setDate('')
        setEndDate('')
        setDescription('')
        setError('')
    }

    const handleAddEvent = async (e) => {
        e.preventDefault()
        if (!name.trim() || !date) {
            setError('Name and date are required')
            return
        }
        if (!editingEvent) {
            const todayDate = cairoDateStr()
            if (date < todayDate) {
                setError('Event start date cannot be in the past')
                return
            }
        }
        if (endDate && endDate < date) {
            setError('End date cannot be before start date')
            return
        }

        setError('')
        setSubmitting(true)
        try {
            if (editingEvent) {
                await updateEvent(editingEvent.id, { name: name.trim(), date, endDate: endDate || date, description: description.trim() })
                toast.success(`Event "${name.trim()}" updated`)
            } else {
                await addEvent({ name: name.trim(), date, endDate: endDate || date, description: description.trim() })
                toast.success(`Event "${name.trim()}" created`)
            }
            closeForm()
        } catch (err) {
            setError(err.message || 'Failed to save event')
        } finally {
            setSubmitting(false)
        }
    }

    const doDelete = async () => {
        if (!confirmDelete) return
        setDeleting(true)
        try {
            await deleteEvent(confirmDelete.id)
            toast.success(`Deleted "${confirmDelete.name}"`)
            setConfirmDelete(null)
        } catch (err) {
            toast.error('Failed to delete event')
        } finally {
            setDeleting(false)
        }
    }

    return (
        <div className="space-y-4 animate-fade-in">
            {/* Header */}
            <div className="card p-4 sm:p-5">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-md flex-shrink-0">
                        <CalendarDays size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h1 className="heading-1 text-slate-900">Events</h1>
                        <p className="text-xs text-slate-500 mt-0.5">
                            {events.length} {events.length === 1 ? 'event' : 'events'} · share to gauge interest
                        </p>
                    </div>
                    {!showForm && (
                        <button
                            onClick={() => { setEditingEvent(null); setShowForm(true) }}
                            className="btn btn-primary"
                        >
                            <Plus size={16} /> <span className="hidden xs:inline">New event</span><span className="xs:hidden">New</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Form */}
            {showForm && (
                <div className="card p-4 sm:p-5 animate-slide-down">
                    <div className="flex items-center gap-2 mb-3">
                        {editingEvent ? <Pencil size={16} className="text-indigo-500" /> : <Sparkles size={16} className="text-indigo-500" />}
                        <h2 className="heading-2 text-slate-800">{editingEvent ? 'Edit event' : 'Create new event'}</h2>
                    </div>
                    {error && (
                        <div className="mb-3 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center gap-2 text-sm font-medium animate-fade-in">
                            <AlertCircle size={16} />
                            {error}
                        </div>
                    )}
                    <form onSubmit={handleAddEvent} className="space-y-3 sm:space-y-4">
                        <div>
                            <label className="label">Event name</label>
                            <input
                                type="text"
                                required
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="input"
                                placeholder="e.g. Sunday Gathering"
                            />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                            <div>
                                <label className="label">Start date</label>
                                <input
                                    type="date"
                                    required
                                    min={cairoDateStr()}
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    className="input"
                                />
                            </div>
                            <div>
                                <label className="label">End date <span className="text-slate-400 normal-case font-medium">(optional)</span></label>
                                <input
                                    type="date"
                                    min={date || cairoDateStr()}
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="input"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="label">Description <span className="text-slate-400 normal-case font-medium">(optional)</span></label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                rows={3}
                                className="input resize-none"
                                placeholder="Add some details about the event…"
                            />
                        </div>
                        <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end pt-1">
                            <button
                                type="button"
                                onClick={closeForm}
                                className="btn btn-ghost"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={submitting}
                                className="btn btn-primary"
                            >
                                {submitting ? <Loader2 size={16} className="animate-spin" /> : editingEvent ? <Pencil size={16} /> : <Plus size={16} />}
                                {editingEvent ? 'Save changes' : 'Add event'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* List */}
            {loading ? (
                <SkeletonList count={3} />
            ) : events.length === 0 ? (
                <div className="card p-10 text-center">
                    <CalendarDays className="mx-auto h-12 w-12 text-slate-300 mb-3" />
                    <p className="font-semibold text-slate-700">No events yet</p>
                    <p className="text-sm text-slate-500 mt-1">Create one to get started!</p>
                    {!showForm && (
                        <button
                            onClick={() => { setEditingEvent(null); setShowForm(true) }}
                            className="btn btn-primary mt-4"
                        >
                            <Plus size={16} /> New event
                        </button>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                    {events.map(event => (
                        <div
                            key={event.id}
                            className="card overflow-hidden flex flex-col group hover:-translate-y-0.5"
                        >
                            <div className="p-4 sm:p-5 flex-1">
                                <div className="flex justify-between items-start gap-2 mb-2">
                                    <h3 className="font-bold text-base sm:text-lg text-slate-900 leading-tight">
                                        {event.name}
                                    </h3>
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-100 text-indigo-700 text-xs font-bold flex-shrink-0">
                                        <CalendarDays size={12} />
                                        {event.date}
                                        {event.endDate && event.endDate !== event.date ? ` → ${event.endDate}` : ''}
                                    </span>
                                </div>
                                <p className="text-sm text-slate-600 line-clamp-2 mt-1">
                                    {event.description || <span className="italic text-slate-400">No description provided.</span>}
                                </p>

                                <button
                                    onClick={() => setInterestedEvent(event)}
                                    className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-700 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-700 px-3 py-1.5 rounded-lg transition-colors"
                                    title="View who's interested"
                                >
                                    <Users size={15} className="text-indigo-500" />
                                    <span className="tabular-nums">{event.interestedCount || 0}</span>
                                    <span className="font-medium">interested</span>
                                    <span className="text-indigo-500 text-xs font-bold">· View</span>
                                </button>
                            </div>
                            <div className="border-t border-slate-100 p-2.5 flex gap-2 justify-end bg-slate-50/40">
                                <button
                                    onClick={() => setShareEvent(event)}
                                    className="btn btn-sm btn-secondary"
                                    title="Share Event"
                                >
                                    <Share2 size={14} /> Share
                                </button>
                                <button
                                    onClick={() => openEdit(event)}
                                    className="btn btn-sm bg-sky-50 text-sky-700 border border-sky-100 hover:bg-sky-100"
                                    title="Edit event"
                                >
                                    <Pencil size={14} /> Edit
                                </button>
                                <button
                                    onClick={() => setConfirmDelete(event)}
                                    className="btn btn-sm bg-rose-50 text-rose-700 border border-rose-100 hover:bg-rose-100"
                                >
                                    <Trash2 size={14} /> Delete
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {shareEvent && <ShareModal event={shareEvent} onClose={() => setShareEvent(null)} />}

            {interestedEvent && (
                <InterestedModal event={interestedEvent} onClose={() => setInterestedEvent(null)} />
            )}

            <ConfirmDialog
                open={!!confirmDelete}
                title={`Delete "${confirmDelete?.name ?? ''}"?`}
                description="This will permanently remove the event. People who already marked themselves as interested will no longer be tracked."
                confirmText="Delete"
                tone="danger"
                busy={deleting}
                onConfirm={doDelete}
                onCancel={() => !deleting && setConfirmDelete(null)}
            />
        </div>
    )
}

function ShareModal({ event, onClose }) {
    const url = `${window.location.origin}/event/${event.id}`
    const [copied, setCopied] = useState(false)

    useEffect(() => {
        const prev = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        const onKey = (e) => e.key === 'Escape' && onClose()
        window.addEventListener('keydown', onKey)
        return () => {
            document.body.style.overflow = prev
            window.removeEventListener('keydown', onKey)
        }
    }, [onClose])

    const handleCopy = () => {
        navigator.clipboard.writeText(url)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    const handleWhatsApp = () => {
        window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(`Check out this event: ${event.name}\n\n${url}`)}`, '_blank')
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
            <div className="modal-backdrop animate-fade-in" />
            <div className="modal-sheet" onClick={e => e.stopPropagation()}>
                <div className="sheet-grabber" />
                <div className="px-4 py-3 sm:p-4 border-b border-slate-200 flex items-center justify-between">
                    <h3 className="font-bold text-base sm:text-lg text-slate-800">Share event</h3>
                    <button onClick={onClose} className="w-9 h-9 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500" aria-label="Close">
                        <X size={18} />
                    </button>
                </div>
                <div className="p-4 sm:p-5 space-y-4">
                    <p className="text-sm text-slate-600">
                        Share the link for <strong className="text-slate-900">{event.name}</strong> so people can mark themselves as interested.
                    </p>

                    <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 p-1.5 rounded-xl">
                        <input
                            type="text"
                            readOnly
                            value={url}
                            className="flex-1 bg-transparent text-sm text-slate-700 focus:outline-none px-2 min-w-0"
                            onClick={e => e.target.select()}
                        />
                        <button
                            onClick={handleCopy}
                            className={`btn btn-sm ${copied ? 'btn-success' : 'btn-secondary'}`}
                        >
                            <Copy size={14} /> {copied ? 'Copied!' : 'Copy'}
                        </button>
                    </div>

                    <button
                        onClick={handleWhatsApp}
                        className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-[#25D366] text-white rounded-xl font-bold shadow-md hover:bg-[#20bd5a] transition-colors min-h-[48px]"
                    >
                        <MessageCircle size={18} />
                        Share via WhatsApp
                    </button>
                </div>
            </div>
        </div>
    )
}

function InterestedModal({ event, onClose }) {
    const [people, setPeople] = useState([])
    const [loading, setLoading] = useState(true)
    const [removing, setRemoving] = useState(null)

    useEffect(() => {
        const unsub = subscribeEventInterested(event.id, (data) => {
            setPeople(data)
            setLoading(false)
        })
        return () => unsub()
    }, [event.id])

    useEffect(() => {
        const prev = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        const onKey = (e) => e.key === 'Escape' && onClose()
        window.addEventListener('keydown', onKey)
        return () => {
            document.body.style.overflow = prev
            window.removeEventListener('keydown', onKey)
        }
    }, [onClose])

    const total = event.interestedCount || 0
    const named = people.length
    const anonymous = Math.max(0, total - named)

    async function handleRemove(person) {
        setRemoving(person.id)
        try {
            await deleteEventInterest(event.id, person.id)
        } catch (err) {
            console.error(err)
        } finally {
            setRemoving(null)
        }
    }

    function waLink(phone) {
        const digits = String(phone).replace(/[^\d+]/g, '')
        return `https://api.whatsapp.com/send?phone=${encodeURIComponent(digits)}`
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
            <div className="modal-backdrop animate-fade-in" />
            <div className="modal-sheet modal-lg" onClick={e => e.stopPropagation()}>
                <div className="sheet-grabber" />
                <div className="px-4 py-3 sm:p-4 border-b border-slate-200 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center text-white flex-shrink-0">
                        <Users size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-base sm:text-lg text-slate-800 truncate">Interested in {event.name}</h3>
                        <p className="text-xs text-slate-500">
                            {total} interested · {named} {named === 1 ? 'name' : 'names'} collected
                        </p>
                    </div>
                    <button onClick={onClose} className="w-9 h-9 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500 flex-shrink-0" aria-label="Close">
                        <X size={18} />
                    </button>
                </div>

                <div className="overflow-auto p-3 sm:p-4 flex-1">
                    {loading ? (
                        <div className="flex items-center justify-center py-12 text-slate-400">
                            <Loader2 className="animate-spin" size={24} />
                        </div>
                    ) : named === 0 ? (
                        <div className="text-center py-10 text-slate-500">
                            <Users className="mx-auto h-10 w-10 text-slate-300 mb-2" />
                            <p className="font-semibold text-slate-700">No names yet</p>
                            <p className="text-xs text-slate-500 mt-1">
                                {total > 0
                                    ? `${total} ${total === 1 ? 'person' : 'people'} tapped interested before names were collected.`
                                    : 'New responses will show their name and phone here.'}
                            </p>
                        </div>
                    ) : (
                        <ul className="space-y-2">
                            {people.map((p, i) => (
                                <li
                                    key={p.id}
                                    className="flex items-center gap-3 border border-slate-200 rounded-xl p-2.5 hover:border-indigo-200 transition-colors"
                                >
                                    <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                                        {i + 1}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-semibold text-sm text-slate-800 truncate">{p.name}</div>
                                        {p.phone ? (
                                            <a
                                                href={`tel:${p.phone}`}
                                                className="text-xs text-slate-500 inline-flex items-center gap-1 hover:text-indigo-600 tabular-nums"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <Phone size={11} /> {p.phone}
                                            </a>
                                        ) : (
                                            <span className="text-xs text-slate-400 italic">no phone</span>
                                        )}
                                    </div>
                                    {p.phone && (
                                        <a
                                            href={waLink(p.phone)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            onClick={(e) => e.stopPropagation()}
                                            className="w-8 h-8 rounded-lg bg-[#25D366]/10 text-[#1da851] hover:bg-[#25D366]/20 flex items-center justify-center flex-shrink-0"
                                            title="Message on WhatsApp"
                                        >
                                            <MessageCircle size={15} />
                                        </a>
                                    )}
                                    <button
                                        onClick={() => handleRemove(p)}
                                        disabled={removing === p.id}
                                        className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 flex items-center justify-center flex-shrink-0 disabled:opacity-50"
                                        title="Remove from list"
                                        aria-label={`Remove ${p.name}`}
                                    >
                                        {removing === p.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}

                    {!loading && anonymous > 0 && named > 0 && (
                        <p className="text-[11px] text-slate-400 text-center mt-3">
                            + {anonymous} earlier {anonymous === 1 ? 'response' : 'responses'} recorded before names were collected.
                        </p>
                    )}
                </div>
            </div>
        </div>
    )
}
