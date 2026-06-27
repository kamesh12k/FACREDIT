import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { teachersApi } from '../../api/services'
import { SearchIcon, CloseIcon, UsersIcon, CalIcon } from '../icons'

export default function QuickSearch({ open, onClose }) {
  const [query, setQuery] = useState('')
  const [teachers, setTeachers] = useState([])
  const [loaded, setLoaded] = useState(false)
  const inputRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (open && !loaded) {
      teachersApi.list().then(r => { setTeachers(r.data); setLoaded(true) })
    }
    if (open) {
      setQuery('')
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose() }
    if (open) document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  if (!open) return null

  const q = query.trim().toLowerCase()
  const isDateLike = /^\d{4}-\d{2}-\d{2}$/.test(q) || /^\d{1,2}[/-]\d{1,2}([/-]\d{2,4})?$/.test(q)

  const matchingTeachers = q
    ? teachers.filter(t =>
        t.name.toLowerCase().includes(q) ||
        (t.department || '').toLowerCase().includes(q) ||
        (t.email || '').toLowerCase().includes(q)
      ).slice(0, 8)
    : []

  const goToTeacherTimetable = (teacherId) => {
    onClose()
    navigate(`/admin/timetable?teacher=${teacherId}`)
  }

  const goToDate = () => {
    onClose()
    navigate(`/admin/academic-calendar?date=${q}`)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white rounded-xl shadow-xl overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
          <SearchIcon className="w-5 h-5 text-gray-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search teachers, or type a date (YYYY-MM-DD)…"
            className="flex-1 text-sm outline-none placeholder:text-gray-400"
          />
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-80 overflow-y-auto">
          {!q && (
            <p className="px-4 py-8 text-sm text-gray-400 text-center">Start typing a teacher's name or a date.</p>
          )}

          {isDateLike && (
            <button onClick={goToDate} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-left border-b border-gray-50">
              <span className="w-8 h-8 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center shrink-0">
                <CalIcon className="w-4 h-4" />
              </span>
              <span className="text-sm text-gray-700">Jump to <span className="font-medium">{query}</span> on the calendar</span>
            </button>
          )}

          {q && !isDateLike && matchingTeachers.length === 0 && (
            <p className="px-4 py-8 text-sm text-gray-400 text-center">No teachers found for "{query}".</p>
          )}

          {matchingTeachers.map(t => (
            <button
              key={t.id}
              onClick={() => goToTeacherTimetable(t.id)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-left"
            >
              <span className="w-8 h-8 rounded-lg bg-gray-100 text-gray-500 flex items-center justify-center shrink-0">
                <UsersIcon className="w-4 h-4" />
              </span>
              <span className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{t.name}</p>
                <p className="text-xs text-gray-400 truncate">{t.department || 'No department'}</p>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
