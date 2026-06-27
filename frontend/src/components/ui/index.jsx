// Spinner
export function Spinner({ size = 'md' }) {
  const s = size === 'sm' ? 'h-4 w-4' : size === 'lg' ? 'h-8 w-8' : 'h-6 w-6'
  return (
    <div className={`${s} animate-spin rounded-full border-2 border-gray-200 border-t-primary-600`} />
  )
}

// Status badge
export function StatusBadge({ status }) {
  return <span className={`badge-${status}`}>{status.charAt(0).toUpperCase() + status.slice(1)}</span>
}

// Day-type badge for the academic calendar (holiday / exam / working / etc.)
const DAY_TYPE_STYLES = {
  working: 'bg-green-100 text-green-700',
  holiday: 'bg-red-100 text-red-700',
  college_leave: 'bg-orange-100 text-orange-700',
  government_holiday: 'bg-rose-100 text-rose-700',
  exam_day: 'bg-purple-100 text-purple-700',
  special_event: 'bg-blue-100 text-blue-700',
  department_activity: 'bg-cyan-100 text-cyan-700',
  non_working: 'bg-gray-200 text-gray-600',
}

const DAY_TYPE_LABELS = {
  working: 'Working',
  holiday: 'Holiday',
  college_leave: 'College Leave',
  government_holiday: 'Government Holiday',
  exam_day: 'Exam Day',
  special_event: 'Special Event',
  department_activity: 'Dept. Activity',
  non_working: 'Non-Working',
}

export function DayTypeBadge({ dayType, small = false }) {
  const cls = DAY_TYPE_STYLES[dayType] || 'bg-gray-100 text-gray-600'
  const label = DAY_TYPE_LABELS[dayType] || dayType
  return (
    <span className={`inline-flex items-center rounded-full font-medium ${cls} ${small ? 'px-1.5 py-0.5 text-[10px]' : 'px-2.5 py-0.5 text-xs'}`}>
      {label}
    </span>
  )
}

// Substitution assignment-type badge — colors loosely follow the spec's
// scheme (auto = purple, emergency = red, override = amber) while staying
// inside the app's existing palette rather than introducing new hues.
const ASSIGNMENT_TYPE_STYLES = {
  auto_assigned: 'bg-purple-100 text-purple-700',
  faculty_recommended: 'bg-blue-100 text-blue-700',
  admin_assigned: 'bg-gray-100 text-gray-600',
  auto_swapped: 'bg-purple-100 text-purple-700',
  overridden: 'bg-amber-100 text-amber-700',
  emergency: 'bg-red-100 text-red-700',
}

const ASSIGNMENT_TYPE_LABELS = {
  auto_assigned: 'Auto Assigned',
  faculty_recommended: 'Recommended',
  admin_assigned: 'Admin Assigned',
  auto_swapped: 'Auto Swapped',
  overridden: 'Overridden',
  emergency: 'Emergency',
}

export function AssignmentTypeBadge({ type, small = false }) {
  const cls = ASSIGNMENT_TYPE_STYLES[type] || 'bg-gray-100 text-gray-600'
  const label = ASSIGNMENT_TYPE_LABELS[type] || type
  return (
    <span className={`inline-flex items-center rounded-full font-medium ${cls} ${small ? 'px-1.5 py-0.5 text-[10px]' : 'px-2.5 py-0.5 text-xs'}`}>
      {label}
    </span>
  )
}

export { DAY_TYPE_LABELS, DAY_TYPE_STYLES }

// Credit chip — green for positive, red for negative
export function CreditChip({ value }) {
  const isPos = value > 0
  return (
    <span className={`font-mono text-sm font-semibold px-2 py-0.5 rounded ${isPos ? 'text-green-700 bg-green-50' : 'text-red-700 bg-red-50'}`}>
      {isPos ? `+${value}` : value}
    </span>
  )
}

// Empty state
export function EmptyState({ message = 'Nothing here yet.' }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-gray-400">
      <svg className="w-10 h-10 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
      <p className="text-sm">{message}</p>
    </div>
  )
}

// Error alert
export function ErrorAlert({ message }) {
  if (!message) return null
  return (
    <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
      {message}
    </div>
  )
}

// Stat card for dashboards
export function StatCard({ label, value, sub, accent }) {
  const colors = {
    indigo: 'bg-primary-50 text-primary-700',
    green:  'bg-green-50 text-green-700',
    yellow: 'bg-yellow-50 text-yellow-700',
    red:    'bg-red-50 text-red-700',
  }
  return (
    <div className="card p-5">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-3xl font-bold font-mono ${colors[accent] ?? 'text-gray-800'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

// Modal wrapper
export function Modal({ open, onClose, title, children }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6 z-10">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-gray-800">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
