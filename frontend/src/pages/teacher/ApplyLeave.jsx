import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { leavesApi, academicCalendarApi } from '../../api/services'
import { ErrorAlert, Spinner, DayTypeBadge } from '../../components/ui'
import { CheckCircleIcon } from '../../components/icons'

function pad(n) { return String(n).padStart(2, '0') }
function isoFor(daysFromToday) {
  const d = new Date()
  d.setDate(d.getDate() + daysFromToday)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const REASON_CHIPS = ['Medical leave', 'Personal reason', 'Conference attendance', 'Family event']

export default function ApplyLeave() {
  // Defaults chosen for the common case: a teacher applying for a single
  // day off picks "Whole day" and a quick date shortcut, never touching
  // the period selector or the native date picker at all.
  const [form, setForm] = useState({ date: isoFor(1), mode: 'whole_day', period_number: '1', period_numbers: [], reason: '' })
  const [calendarInfo, setCalendarInfo] = useState(null)
  const [checkingDate, setCheckingDate] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    if (!form.date) { setCalendarInfo(null); return }
    setCheckingDate(true)
    academicCalendarApi.resolve(form.date)
      .then(r => setCalendarInfo(r.data))
      .catch(() => setCalendarInfo(null))
      .finally(() => setCheckingDate(false))
  }, [form.date])

  const isBlocked = calendarInfo?.blocks_operations

  const togglePeriod = (p) => {
    setForm(f => ({
      ...f,
      period_numbers: f.period_numbers.includes(p) ? f.period_numbers.filter(x => x !== p) : [...f.period_numbers, p].sort(),
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (isBlocked) {
      setError(`${form.date} is marked as ${calendarInfo.day_type.replace('_', ' ')} — leave cannot be applied for this date.`)
      return
    }
    setLoading(true)
    try {
      if (form.mode === 'single') {
        await leavesApi.apply({ date: form.date, period_number: Number(form.period_number), reason: form.reason })
      } else if (form.mode === 'whole_day') {
        await leavesApi.applyBatch({ date: form.date, whole_day: true, reason: form.reason })
      } else {
        if (form.period_numbers.length === 0) {
          setError('Select at least one period.')
          setLoading(false)
          return
        }
        await leavesApi.applyBatch({ date: form.date, period_numbers: form.period_numbers, reason: form.reason })
      }
      setSuccess(true)
      setTimeout(() => navigate('/teacher/leaves'), 1500)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to submit leave request.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-3">
        <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
          <CheckCircleIcon className="w-6 h-6 text-green-600" />
        </div>
        <p className="text-base font-semibold text-gray-800">Leave request submitted</p>
        <p className="text-sm text-gray-500">Redirecting to your leave history…</p>
      </div>
    )
  }

  const dateShortcuts = [
    { label: 'Tomorrow', value: isoFor(1) },
    { label: 'In 2 days', value: isoFor(2) },
    { label: 'Next week', value: isoFor(7) },
  ]

  return (
    <div className="max-w-md space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Apply for leave</h1>
        <p className="text-sm text-gray-500 mt-0.5">Takes less than a minute</p>
      </div>

      <div className="card p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          <ErrorAlert message={error} />

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">When</label>
            <div className="flex gap-2 mb-2 flex-wrap">
              {dateShortcuts.map(s => (
                <button
                  key={s.value} type="button"
                  onClick={() => setForm({ ...form, date: s.value })}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                    form.date === s.value ? 'bg-primary-600 text-white border-primary-600' : 'border-gray-200 text-gray-600 hover:border-primary-300'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <input
              type="date" required className="input"
              value={form.date}
              min={new Date().toISOString().split('T')[0]}
              onChange={e => setForm({ ...form, date: e.target.value })}
            />
            {checkingDate && <p className="text-xs text-gray-400 mt-1.5">Checking calendar…</p>}
            {calendarInfo && !checkingDate && (
              <div className="mt-2 flex items-center gap-2">
                {calendarInfo.day_type === 'working' ? (
                  <span className="inline-flex items-center rounded-full font-medium bg-green-100 text-green-700 px-2.5 py-0.5 text-xs">
                    Day Order {calendarInfo.day_order}
                  </span>
                ) : (
                  <DayTypeBadge dayType={calendarInfo.day_type} small />
                )}
                {isBlocked && <span className="text-xs text-red-600">Leave can't be applied for this date.</span>}
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">How much time</label>
            <div className="flex gap-2">
              {[
                { value: 'whole_day', label: 'Whole day' },
                { value: 'single', label: 'One period' },
                { value: 'custom', label: 'A few periods' },
              ].map(opt => (
                <button
                  key={opt.value} type="button"
                  onClick={() => setForm({ ...form, mode: opt.value })}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                    form.mode === opt.value ? 'bg-primary-600 text-white border-primary-600' : 'border-gray-200 text-gray-600 hover:border-primary-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {form.mode === 'single' && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Period</label>
              <select className="input" value={form.period_number} onChange={e => setForm({ ...form, period_number: e.target.value })}>
                {[1, 2, 3, 4, 5].map(p => <option key={p} value={p}>Period {p}</option>)}
              </select>
            </div>
          )}

          {form.mode === 'custom' && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Tap each period</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map(p => (
                  <button
                    key={p} type="button"
                    onClick={() => togglePeriod(p)}
                    className={`w-10 h-10 rounded-lg border text-sm font-medium transition-colors ${
                      form.period_numbers.includes(p) ? 'bg-primary-600 text-white border-primary-600' : 'border-gray-200 text-gray-600 hover:border-primary-300'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Reason</label>
            <div className="flex gap-2 mb-2 flex-wrap">
              {REASON_CHIPS.map(chip => (
                <button
                  key={chip} type="button"
                  onClick={() => setForm({ ...form, reason: chip })}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                    form.reason === chip ? 'bg-primary-600 text-white border-primary-600' : 'border-gray-200 text-gray-600 hover:border-primary-300'
                  }`}
                >
                  {chip}
                </button>
              ))}
            </div>
            <textarea
              required rows={3} className="input resize-none"
              placeholder="Or type your own reason…"
              value={form.reason}
              onChange={e => setForm({ ...form, reason: e.target.value })}
            />
          </div>

          <button type="submit" disabled={loading || isBlocked} className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-40">
            {loading ? <Spinner size="sm" /> : null}
            {loading ? 'Submitting…' : 'Submit request'}
          </button>
        </form>
      </div>
    </div>
  )
}
