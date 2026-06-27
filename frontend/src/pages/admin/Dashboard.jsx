import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { academicCalendarApi, teachersApi } from '../../api/services'
import { Spinner, DayTypeBadge } from '../../components/ui'
import { UsersIcon, DocIcon, CalIcon, SwapIcon, PlusIcon } from '../../components/icons'

export default function AdminDashboard() {
  const [summary, setSummary] = useState(null)
  const [teacherCount, setTeacherCount] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([academicCalendarApi.todaySummary(), teachersApi.list()])
      .then(([s, t]) => { setSummary(s.data); setTeacherCount(t.data.length) })
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>

  const nextHoliday = summary.upcoming_non_working_days[0]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Good to see you</h1>
        <p className="text-sm text-gray-500 mt-0.5">Here's what's happening today</p>
      </div>

      {/* Today status — the one thing everyone needs first */}
      {summary.blocks_operations ? (
        <div className="card p-5 bg-amber-50/60 border-amber-200">
          <div className="flex items-center gap-3">
            <DayTypeBadge dayType={summary.day_type} />
            <p className="text-sm text-amber-800">
              No classes, substitutes, or credits are scheduled today.
            </p>
          </div>
        </div>
      ) : (
        <div className="card p-5 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <span className="w-11 h-11 rounded-xl bg-green-100 text-green-700 flex items-center justify-center font-bold text-sm shrink-0">
              DO {summary.day_order}
            </span>
            <div>
              <p className="text-sm font-semibold text-gray-800">Today is a working day</p>
              <p className="text-xs text-gray-500">Day Order {summary.day_order} · {summary.teachers_on_leave.length} {summary.teachers_on_leave.length === 1 ? 'teacher' : 'teachers'} on leave</p>
            </div>
          </div>
          <Link to="/admin/leaves" className="btn-secondary text-sm">Review leave</Link>
        </div>
      )}

      {/* Quick actions — the things admins reach for most */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Link to="/admin/leaves" className="card p-4 flex flex-col items-center gap-2 text-center hover:border-primary-300 transition-colors">
          <span className="w-10 h-10 rounded-full bg-yellow-100 text-yellow-700 flex items-center justify-center"><DocIcon className="w-5 h-5" /></span>
          <span className="text-sm font-semibold text-gray-800">{summary.pending_leave_count}</span>
          <span className="text-xs text-gray-500">Pending leave{summary.pending_leave_count === 1 ? '' : 's'}</span>
        </Link>
        <Link to="/admin/teachers" className="card p-4 flex flex-col items-center gap-2 text-center hover:border-primary-300 transition-colors">
          <span className="w-10 h-10 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center"><UsersIcon className="w-5 h-5" /></span>
          <span className="text-sm font-semibold text-gray-800">{teacherCount}</span>
          <span className="text-xs text-gray-500">Teachers</span>
        </Link>
        <Link to="/admin/academic-calendar" className="card p-4 flex flex-col items-center gap-2 text-center hover:border-primary-300 transition-colors">
          <span className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center"><CalIcon className="w-5 h-5" /></span>
          <span className="text-sm font-semibold text-gray-800">Calendar</span>
          <span className="text-xs text-gray-500">Holidays &amp; Day Order</span>
        </Link>
        <Link to="/admin/timetable" className="card p-4 flex flex-col items-center gap-2 text-center hover:border-primary-300 transition-colors">
          <span className="w-10 h-10 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center"><PlusIcon className="w-5 h-5" /></span>
          <span className="text-sm font-semibold text-gray-800">Timetable</span>
          <span className="text-xs text-gray-500">Add a slot</span>
        </Link>
      </div>

      {/* Who's on leave today */}
      {!summary.blocks_operations && (
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-800">On leave today</h2>
          </div>
          {summary.teachers_on_leave.length === 0 ? (
            <p className="px-5 py-8 text-sm text-gray-400 text-center">Nobody is on approved leave today.</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {summary.teachers_on_leave.map((t, i) => (
                <div key={i} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{t.name}</p>
                    <p className="text-xs text-gray-400">{t.department || 'No department'} · Period {t.period_number}</p>
                  </div>
                  {t.has_substitute ? (
                    <span className="flex items-center gap-1.5 text-xs text-green-600 font-medium">
                      <SwapIcon className="w-3.5 h-3.5" /> {t.substitute_name}
                    </span>
                  ) : (
                    <Link to="/admin/leaves" className="text-xs text-amber-600 font-medium hover:underline">Needs substitute</Link>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Upcoming holiday reminder */}
      {nextHoliday && (
        <div className="rounded-lg bg-blue-50 border border-blue-100 px-4 py-3 flex items-center gap-3 text-sm text-blue-800">
          <DayTypeBadge dayType={nextHoliday.day_type} small />
          <span>
            {nextHoliday.label || nextHoliday.day_type.replace('_', ' ')} on {nextHoliday.date}
            {' '}({nextHoliday.days_away === 0 ? 'today' : nextHoliday.days_away === 1 ? 'tomorrow' : `in ${nextHoliday.days_away} days`})
          </span>
        </div>
      )}
    </div>
  )
}
