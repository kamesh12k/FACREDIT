import { useState } from 'react'
import { academicCalendarApi } from '../../api/services'
import { ErrorAlert, EmptyState, DayTypeBadge, CreditChip } from '../../components/ui'

function DateRangePicker({ start, end, onStart, onEnd, onRun, loading }) {
  return (
    <div className="card p-5 flex flex-wrap items-end gap-3">
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Start date</label>
        <input type="date" className="input" value={start} onChange={e => onStart(e.target.value)} />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">End date</label>
        <input type="date" className="input" value={end} onChange={e => onEnd(e.target.value)} />
      </div>
      <button onClick={onRun} disabled={loading || !start || !end} className="btn-primary disabled:opacity-40">
        {loading ? 'Running…' : 'Run Report'}
      </button>
    </div>
  )
}

function WorkingDaysReport() {
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [rows, setRows] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const run = async () => {
    setError(''); setLoading(true)
    try {
      const { data } = await academicCalendarApi.workingDayReport(start, end)
      setRows(data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load report.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <DateRangePicker start={start} end={end} onStart={setStart} onEnd={setEnd} onRun={run} loading={loading} />
      <ErrorAlert message={error} />
      {rows && (
        <div className="card overflow-hidden">
          {rows.length === 0 ? <EmptyState message="No calendar entries in this range." /> : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>{['Date', 'Day Order', 'Working?'].map(h => <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rows.map(r => (
                  <tr key={r.date} className="hover:bg-gray-50/50">
                    <td className="px-5 py-2.5 text-gray-700">{r.date}</td>
                    <td className="px-5 py-2.5 text-gray-500">{r.day_order ?? '—'}</td>
                    <td className="px-5 py-2.5">{r.is_working ? <span className="text-green-600 text-xs font-medium">Working</span> : <span className="text-gray-400 text-xs">Non-working</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}

function HolidaysReport() {
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [rows, setRows] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const run = async () => {
    setError(''); setLoading(true)
    try {
      const { data } = await academicCalendarApi.holidayReport(start, end)
      setRows(data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load report.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <DateRangePicker start={start} end={end} onStart={setStart} onEnd={setEnd} onRun={run} loading={loading} />
      <ErrorAlert message={error} />
      {rows && (
        <div className="card overflow-hidden">
          {rows.length === 0 ? <EmptyState message="No holidays/non-working days in this range." /> : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>{['Date', 'Type', 'Label'].map(h => <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rows.map(r => (
                  <tr key={r.date} className="hover:bg-gray-50/50">
                    <td className="px-5 py-2.5 text-gray-700">{r.date}</td>
                    <td className="px-5 py-2.5"><DayTypeBadge dayType={r.day_type} /></td>
                    <td className="px-5 py-2.5 text-gray-500">{r.label || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}

function DayOrderReport() {
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [rows, setRows] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const run = async () => {
    setError(''); setLoading(true)
    try {
      const { data } = await academicCalendarApi.dayOrderReport(start, end)
      setRows(data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load report.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <DateRangePicker start={start} end={end} onStart={setStart} onEnd={setEnd} onRun={run} loading={loading} />
      <ErrorAlert message={error} />
      {rows && (
        <div className="card overflow-hidden">
          {rows.length === 0 ? <EmptyState message="No Day Order occurrences in this range." /> : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>{['Day Order', 'Occurrences', 'Dates'].map(h => <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rows.map(r => (
                  <tr key={r.day_order} className="hover:bg-gray-50/50">
                    <td className="px-5 py-2.5 font-semibold text-gray-800">Day Order {r.day_order}</td>
                    <td className="px-5 py-2.5 text-gray-600">{r.occurrences}</td>
                    <td className="px-5 py-2.5 text-gray-400 text-xs">{r.dates.join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}

function FacultyWorkloadReport() {
  const [rows, setRows] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const run = async () => {
    setError(''); setLoading(true)
    try {
      const { data } = await academicCalendarApi.facultyWorkloadReport()
      setRows(data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load report.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="card p-5">
        <p className="text-xs text-gray-500 mb-3">Total periods taught per teacher, counting only actual working-day occurrences — holidays and non-working days are excluded automatically.</p>
        <button onClick={run} disabled={loading} className="btn-primary">{loading ? 'Running…' : 'Run Report'}</button>
      </div>
      <ErrorAlert message={error} />
      {rows && (
        <div className="card overflow-hidden">
          {rows.length === 0 ? <EmptyState message="No teachers found." /> : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>{['Teacher', 'Department', 'Total Periods (excl. holidays)', 'Credit Balance'].map(h => <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rows.map(r => (
                  <tr key={r.teacher_id} className="hover:bg-gray-50/50">
                    <td className="px-5 py-2.5 font-medium text-gray-800">{r.name}</td>
                    <td className="px-5 py-2.5 text-gray-500">{r.department || '—'}</td>
                    <td className="px-5 py-2.5 text-gray-700 font-mono">{r.total_periods}</td>
                    <td className="px-5 py-2.5"><CreditChip value={r.credit_balance} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}

const TABS = [
  { key: 'working', label: 'Working Days', Component: WorkingDaysReport },
  { key: 'holidays', label: 'Holidays', Component: HolidaysReport },
  { key: 'day-orders', label: 'Day Orders', Component: DayOrderReport },
  { key: 'workload', label: 'Faculty Workload', Component: FacultyWorkloadReport },
]

export default function AcademicCalendarReports() {
  const [active, setActive] = useState('working')
  const ActiveComponent = TABS.find(t => t.key === active)?.Component || WorkingDaysReport

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Calendar Reports</h1>
        <p className="text-sm text-gray-500 mt-0.5">Working day, holiday, Day Order, and workload reports — all holiday-aware</p>
      </div>

      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setActive(t.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              active === t.key ? 'border-primary-600 text-primary-700' : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <ActiveComponent />
    </div>
  )
}
