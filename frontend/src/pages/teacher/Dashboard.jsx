import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { leavesApi, teachersApi, academicCalendarApi } from '../../api/services'
import { StatusBadge, Spinner, DayTypeBadge, CreditChip } from '../../components/ui'
import { PlusIcon, CalIcon, DocIcon } from '../../components/icons'

export default function TeacherDashboard() {
  const { user } = useAuth()
  const [leaves, setLeaves] = useState([])
  const [balance, setBalance] = useState(0)
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([leavesApi.myLeaves(), teachersApi.credits(user.id), academicCalendarApi.myTodaySummary()])
      .then(([l, c, s]) => { setLeaves(l.data); setBalance(c.data.balance); setSummary(s.data) })
      .finally(() => setLoading(false))
  }, [user.id])

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>

  const pending = leaves.filter(x => x.status === 'pending').length
  const nextHoliday = summary?.upcoming_non_working_days?.[0]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Hi, {user.name.split(' ')[0]}</h1>
        <p className="text-sm text-gray-500">{user.department || 'Faculty'}</p>
      </div>

      {/* Today status */}
      {summary && (
        summary.blocks_operations ? (
          <div className="card p-5 bg-amber-50/60 border-amber-200 flex items-center gap-3">
            <DayTypeBadge dayType={summary.day_type} />
            <p className="text-sm text-amber-800">No classes scheduled today.</p>
          </div>
        ) : summary.is_on_leave_today ? (
          <div className="card p-5 bg-green-50/60 border-green-200 flex items-center gap-3">
            <span className="w-10 h-10 rounded-full bg-green-100 text-green-700 flex items-center justify-center font-bold text-xs shrink-0">DO {summary.day_order}</span>
            <p className="text-sm text-green-800">You're on approved leave today — enjoy the day off.</p>
          </div>
        ) : (
          <div className="card p-5 flex items-center gap-3">
            <span className="w-10 h-10 rounded-full bg-green-100 text-green-700 flex items-center justify-center font-bold text-xs shrink-0">DO {summary.day_order}</span>
            <div>
              <p className="text-sm font-semibold text-gray-800">Today is Day Order {summary.day_order}</p>
              <p className="text-xs text-gray-500">{summary.periods_today} period{summary.periods_today === 1 ? '' : 's'} on your timetable</p>
            </div>
          </div>
        )
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-3 gap-3">
        <Link to="/teacher/leave/apply" className="card p-4 flex flex-col items-center gap-2 text-center hover:border-primary-300 transition-colors">
          <span className="w-10 h-10 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center"><PlusIcon className="w-5 h-5" /></span>
          <span className="text-xs font-medium text-gray-700">Apply for leave</span>
        </Link>
        <Link to="/teacher/timetable" className="card p-4 flex flex-col items-center gap-2 text-center hover:border-primary-300 transition-colors">
          <span className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center"><CalIcon className="w-5 h-5" /></span>
          <span className="text-xs font-medium text-gray-700">My timetable</span>
        </Link>
        <Link to="/teacher/leaves" className="card p-4 flex flex-col items-center gap-2 text-center hover:border-primary-300 transition-colors">
          <span className="w-10 h-10 rounded-full bg-yellow-100 text-yellow-700 flex items-center justify-center"><DocIcon className="w-5 h-5" /></span>
          <span className="text-xs font-medium text-gray-700">{pending > 0 ? `${pending} pending` : 'Leave history'}</span>
        </Link>
      </div>

      {/* Credit balance, simplified */}
      <div className="card p-5 flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">Credit balance</p>
          <p className="text-xs text-gray-400">Covering a class earns +1 · taking leave costs &minus;1</p>
        </div>
        <CreditChip value={balance} />
      </div>

      {/* Recent requests */}
      <div className="card">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-800">Recent leave requests</h2>
          <Link to="/teacher/leave/apply" className="text-xs text-primary-600 hover:underline font-medium">+ New request</Link>
        </div>
        <div className="divide-y divide-gray-50">
          {leaves.slice(0, 5).map(leave => (
            <div key={leave.id} className="flex items-center justify-between px-5 py-3">
              <div>
                <p className="text-sm font-medium text-gray-800">{leave.date} · Day Order {leave.day_order} · Period {leave.period_number}</p>
                <p className="text-xs text-gray-400 truncate max-w-xs">{leave.reason}</p>
              </div>
              <StatusBadge status={leave.status} />
            </div>
          ))}
          {leaves.length === 0 && (
            <p className="px-5 py-8 text-sm text-gray-400 text-center">No leave requests yet.</p>
          )}
        </div>
      </div>

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
