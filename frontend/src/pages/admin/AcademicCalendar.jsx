import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { academicCalendarApi } from '../../api/services'
import { Spinner, ErrorAlert, Modal } from '../../components/ui'

// ─── Constants ───────────────────────────────────────────────────────────────

const LEAVE_TYPES = [
  { value: 'holiday',              label: 'Holiday',             icon: '🏖️', color: 'red' },
  { value: 'college_leave',        label: 'College Leave',       icon: '🏫', color: 'orange' },
  { value: 'government_holiday',   label: 'Govt. Holiday',       icon: '🏛️', color: 'rose' },
  { value: 'exam_day',             label: 'Exam Day',            icon: '📝', color: 'purple' },
  { value: 'special_event',        label: 'Special Event',       icon: '⭐', color: 'blue' },
  { value: 'department_activity',  label: 'Dept. Activity',      icon: '🎓', color: 'cyan' },
  { value: 'non_working',          label: 'Non-Working',         icon: '🚫', color: 'gray' },
]

const ALL_DAY_TYPES = [
  { value: 'working', label: 'Working Day' },
  ...LEAVE_TYPES,
]

const LEAVE_TYPE_META = {
  holiday:             { bg: '#FEE2E2', text: '#991B1B', border: '#FCA5A5', dot: '#EF4444', label: 'Holiday' },
  college_leave:       { bg: '#FED7AA', text: '#9A3412', border: '#FDBA74', dot: '#F97316', label: 'Leave' },
  government_holiday:  { bg: '#FCE7F3', text: '#9D174D', border: '#F9A8D4', dot: '#EC4899', label: 'Govt.' },
  exam_day:            { bg: '#EDE9FE', text: '#5B21B6', border: '#C4B5FD', dot: '#8B5CF6', label: 'Exam' },
  special_event:       { bg: '#DBEAFE', text: '#1E40AF', border: '#93C5FD', dot: '#3B82F6', label: 'Event' },
  department_activity: { bg: '#CFFAFE', text: '#155E75', border: '#67E8F9', dot: '#06B6D4', label: 'Dept.' },
  non_working:         { bg: '#F3F4F6', text: '#374151', border: '#D1D5DB', dot: '#6B7280', label: 'Off' },
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

function pad(n) { return String(n).padStart(2, '0') }
function isoDate(y, m, d) { return `${y}-${pad(m + 1)}-${pad(d)}` }

// ─── Day-Order Badge ─────────────────────────────────────────────────────────

const DO_COLORS = [
  null,
  { bg: '#EFF6FF', text: '#1E40AF', border: '#BFDBFE' }, // DO1 – blue
  { bg: '#F0FDF4', text: '#166534', border: '#BBF7D0' }, // DO2 – green
  { bg: '#FFF7ED', text: '#9A3412', border: '#FED7AA' }, // DO3 – orange
  { bg: '#FAF5FF', text: '#6B21A8', border: '#E9D5FF' }, // DO4 – purple
  { bg: '#FFFBEB', text: '#92400E', border: '#FDE68A' }, // DO5 – amber
  { bg: '#FFF1F2', text: '#9F1239', border: '#FECDD3' }, // DO6 – rose
]

function DayOrderPill({ order, size = 'md' }) {
  if (!order || order < 1 || order > 6) return null
  const c = DO_COLORS[order]
  const isLg = size === 'lg'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      background: c.bg, color: c.text, border: `1px solid ${c.border}`,
      borderRadius: isLg ? 8 : 5,
      fontSize: isLg ? 14 : 10,
      fontWeight: 700,
      padding: isLg ? '4px 10px' : '1px 5px',
      lineHeight: 1.2,
      userSelect: 'none',
      whiteSpace: 'nowrap',
    }}>
      {isLg ? (
        `Day Order ${order}`
      ) : (
        <>
          <span className="hidden sm:inline">DO{order}</span>
          <span className="inline sm:hidden">{order}</span>
        </>
      )}
    </span>
  )
}

// ─── Leave-Type Badge ─────────────────────────────────────────────────────────

function LeaveTypePill({ dayType, size = 'sm' }) {
  const meta = LEAVE_TYPE_META[dayType]
  if (!meta) return null
  const isLg = size === 'lg'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: meta.bg, color: meta.text, border: `1px solid ${meta.border}`,
      borderRadius: isLg ? 8 : 5,
      fontSize: isLg ? 13 : 9,
      fontWeight: 600,
      padding: isLg ? '4px 10px' : '1px 5px',
      lineHeight: 1.2,
      whiteSpace: 'nowrap',
    }}>
      <span style={{ width: isLg ? 7 : 5, height: isLg ? 7 : 5, borderRadius: '50%', background: meta.dot, flexShrink: 0 }} />
      <span className={isLg ? "" : "hidden sm:inline"}>
        {isLg ? LEAVE_TYPES.find(t => t.value === dayType)?.label || meta.label : meta.label}
      </span>
    </span>
  )
}

// ─── Month Grid ───────────────────────────────────────────────────────────────

function MonthGrid({ year, month, daysByDate, onDayClick }) {
  const firstOfMonth = new Date(year, month, 1)
  const startWeekday = firstOfMonth.getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const today = new Date()
  const todayStr = isoDate(today.getFullYear(), today.getMonth(), today.getDate())

  const cells = []
  for (let i = 0; i < startWeekday; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  // pad to complete last row
  while (cells.length % 7 !== 0) cells.push(null)

  const isWeekend = (cellIndex) => {
    const dayOfWeek = cellIndex % 7
    return dayOfWeek === 0 || dayOfWeek === 6
  }

  return (
    <div style={{ width: '100%' }}>
      {/* Weekday headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 6 }}>
        {WEEKDAY_LABELS.map((d, i) => (
          <div key={i} style={{
            textAlign: 'center', fontSize: 11, fontWeight: 600, letterSpacing: '0.05em',
            color: (i === 0 || i === 6) ? '#DC2626' : 'var(--text-muted)',
            padding: '4px 0', textTransform: 'uppercase',
          }}>
            <span className="hidden sm:inline">{d}</span>
            <span className="inline sm:hidden">{d[0]}</span>
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {cells.map((d, i) => {
          if (d === null) return <div key={i} style={{ aspectRatio: '1', borderRadius: 8 }} />

          const dateStr = isoDate(year, month, d)
          const entry = daysByDate[dateStr]
          const isToday = dateStr === todayStr
          const isLeave = entry && entry.day_type !== 'working'
          const isWorking = entry && entry.day_type === 'working'
          const weekend = isWeekend(i)

          let cellBg = 'var(--surface-2)'
          let cellBorder = '1px solid var(--border)'
          let dateColor = weekend ? '#DC2626' : 'var(--text-primary)'
          let cursor = 'pointer'

          if (isLeave) {
            const meta = LEAVE_TYPE_META[entry.day_type]
            cellBg = meta?.bg || '#F3F4F6'
            cellBorder = `1.5px solid ${meta?.border || '#D1D5DB'}`
          } else if (isWorking) {
            cellBg = '#F0FDF4'
            cellBorder = '1.5px solid #BBF7D0'
          }

          if (isToday) {
            cellBorder = '2px solid #6366F1'
          }

          return (
            <button
              key={i}
              onClick={() => onDayClick(dateStr, entry)}
              title={entry?.label || (isWorking ? `Day Order ${entry.day_order}` : '')}
              style={{
                aspectRatio: '1',
                borderRadius: 8,
                border: cellBorder,
                background: cellBg,
                cursor,
                padding: 4,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                transition: 'all 0.12s ease',
                position: 'relative',
                outline: 'none',
                minHeight: 0,
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.04)'; e.currentTarget.style.zIndex = 2 }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.zIndex = 1 }}
            >
              {/* Today indicator */}
              {isToday && (
                <span style={{
                  position: 'absolute', top: 3, right: 3,
                  width: 5, height: 5, borderRadius: '50%', background: '#6366F1',
                }} />
              )}

              {/* Date number */}
              <span style={{
                fontSize: 12, fontWeight: isToday ? 700 : 500,
                color: isToday ? '#6366F1' : dateColor,
                lineHeight: 1,
              }}>{d}</span>

              {/* Content area */}
              <div style={{ width: '100%' }}>
                {isWorking && entry.day_order && (
                  <DayOrderPill order={entry.day_order} />
                )}
                {isLeave && (
                  <LeaveTypePill dayType={entry.day_type} />
                )}
                {!entry && !weekend && (
                  <span className="hidden sm:inline" style={{ fontSize: 9, color: 'var(--text-muted)', fontStyle: 'italic' }}>unset</span>
                )}
              </div>

              {/* Manual override indicator */}
              {entry?.is_manual_override && (
                <span style={{
                  position: 'absolute', bottom: 2, right: 3,
                  fontSize: 8, color: '#D97706', fontWeight: 600,
                }}>✎</span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Stats Bar ────────────────────────────────────────────────────────────────

function MonthStats({ days }) {
  const counts = useMemo(() => {
    const c = { working: 0, leave: 0, unset: 0 }
    for (const d of days) {
      if (d.day_type === 'working') c.working++
      else c.leave++
    }
    return c
  }, [days])

  return (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
      <StatChip label="Working days" value={counts.working} color="#166534" bg="#F0FDF4" border="#BBF7D0" />
      <StatChip label="Leave / holiday" value={counts.leave} color="#9A3412" bg="#FEF3C7" border="#FDE68A" />
    </div>
  )
}

function StatChip({ label, value, color, bg, border }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      background: bg, border: `1px solid ${border}`,
      borderRadius: 8, padding: '6px 12px',
    }}>
      <span style={{ fontSize: 20, fontWeight: 700, color, lineHeight: 1 }}>{value}</span>
      <span style={{ fontSize: 12, color, opacity: 0.8 }}>{label}</span>
    </div>
  )
}

// ─── Leave Quick-Mark Panel ───────────────────────────────────────────────────
// This is the key new feature: click a leave type, then click days on the
// calendar. Working days auto-receive Day Order from the sequence.

function LeaveQuickPanel({ activeLeaveType, onSelect }) {
  return (
    <div style={{
      background: 'var(--surface-1)', borderRadius: 12,
      border: '1px solid var(--border)',
      padding: '14px 16px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div>
          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
            Mark leave days
          </p>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '2px 0 0' }}>
            Pick a type, then click any day. Working days get Day Order automatically.
          </p>
        </div>
        {activeLeaveType && (
          <button
            onClick={() => onSelect(null)}
            style={{
              fontSize: 11, padding: '4px 10px', borderRadius: 6,
              background: 'var(--surface-2)', border: '1px solid var(--border)',
              color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 500,
            }}
          >
            ✕ Clear selection
          </button>
        )}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {LEAVE_TYPES.map(t => {
          const meta = LEAVE_TYPE_META[t.value]
          const isActive = activeLeaveType === t.value
          return (
            <button
              key={t.value}
              onClick={() => onSelect(isActive ? null : t.value)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 12px', borderRadius: 8,
                background: isActive ? meta.bg : 'var(--surface-2)',
                border: isActive ? `2px solid ${meta.dot}` : '1px solid var(--border)',
                color: isActive ? meta.text : 'var(--text-secondary)',
                cursor: 'pointer',
                fontWeight: isActive ? 700 : 500,
                fontSize: 12,
                transition: 'all 0.1s ease',
                transform: isActive ? 'scale(1.03)' : 'scale(1)',
              }}
            >
              <span>{t.icon}</span>
              <span>{t.label}</span>
              {isActive && <span style={{ marginLeft: 2, fontSize: 10 }}>✓ active</span>}
            </button>
          )
        })}
      </div>

      {activeLeaveType && (
        <div style={{
          marginTop: 10, padding: '8px 12px', borderRadius: 8,
          background: LEAVE_TYPE_META[activeLeaveType]?.bg,
          border: `1px solid ${LEAVE_TYPE_META[activeLeaveType]?.border}`,
          color: LEAVE_TYPE_META[activeLeaveType]?.text,
          fontSize: 12, fontWeight: 500,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span>👆</span>
          <span>
            Click days on the calendar to mark them as{' '}
            <strong>{LEAVE_TYPES.find(t => t.value === activeLeaveType)?.label}</strong>.
            Other days continue their Day Order sequence automatically.
          </span>
        </div>
      )}
    </div>
  )
}

// ─── Mark Day Modal ──────────────────────────────────────────────────────────

function MarkDayModal({ open, onClose, date, existing, onSaved }) {
  const [dayType, setDayType] = useState(existing?.day_type || 'working')
  const [dayOrder, setDayOrder] = useState(existing?.day_order || '')
  const [label, setLabel] = useState(existing?.label || '')
  const [notes, setNotes] = useState(existing?.notes || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setDayType(existing?.day_type || 'working')
    setDayOrder(existing?.day_order || '')
    setLabel(existing?.label || '')
    setNotes(existing?.notes || '')
    setError('')
  }, [existing, date])

  const handleSave = async (e) => {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      await academicCalendarApi.markDay({
        date,
        day_type: dayType,
        day_order: dayType === 'working' && dayOrder ? Number(dayOrder) : null,
        label: label || null,
        notes: notes || null,
      })
      onSaved()
      onClose()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setSaving(true)
    try {
      await academicCalendarApi.deleteDay(date)
      onSaved()
      onClose()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to delete.')
    } finally {
      setSaving(false)
    }
  }

  const handleClearOverride = async () => {
    setSaving(true)
    try {
      await academicCalendarApi.clearOverride(date)
      onSaved()
      onClose()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to clear override.')
    } finally {
      setSaving(false)
    }
  }

  const parsedDate = date ? new Date(date + 'T00:00:00') : null
  const displayDate = parsedDate
    ? parsedDate.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : date

  return (
    <Modal open={open} onClose={onClose} title={displayDate || ''}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <ErrorAlert message={error} />

        {/* Day type selector — visual cards */}
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Day type
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {/* Working day card */}
            <button
              type="button"
              onClick={() => setDayType('working')}
              style={{
                padding: '10px 12px', borderRadius: 8, textAlign: 'left', cursor: 'pointer',
                background: dayType === 'working' ? '#F0FDF4' : 'var(--surface-1)',
                border: dayType === 'working' ? '2px solid #16A34A' : '1px solid var(--border)',
                transition: 'all 0.1s ease',
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, color: dayType === 'working' ? '#166534' : 'var(--text-primary)' }}>
                📅 Working Day
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                Day Order assigned automatically
              </div>
            </button>

            {/* Leave type cards */}
            {LEAVE_TYPES.map(t => {
              const meta = LEAVE_TYPE_META[t.value]
              const isActive = dayType === t.value
              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setDayType(t.value)}
                  style={{
                    padding: '10px 12px', borderRadius: 8, textAlign: 'left', cursor: 'pointer',
                    background: isActive ? meta.bg : 'var(--surface-1)',
                    border: isActive ? `2px solid ${meta.dot}` : '1px solid var(--border)',
                    transition: 'all 0.1s ease',
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 700, color: isActive ? meta.text : 'var(--text-primary)' }}>
                    {t.icon} {t.label}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Day Order override — only for working days */}
        {dayType === 'working' && (
          <div style={{
            background: '#F0FDF4', border: '1px solid #BBF7D0',
            borderRadius: 8, padding: '12px 14px',
          }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#166534', marginBottom: 8 }}>
              Day Order (optional override)
            </label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setDayOrder('')}
                style={{
                  padding: '6px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
                  background: dayOrder === '' ? '#166534' : '#DCFCE7',
                  color: dayOrder === '' ? '#fff' : '#166534',
                  border: '1px solid #86EFAC', fontWeight: 600,
                }}
              >
                Auto (sequence)
              </button>
              {[1, 2, 3, 4, 5, 6].map(n => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setDayOrder(String(n))}
                  style={{
                    padding: '6px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
                    background: dayOrder === String(n) ? DO_COLORS[n].bg : 'white',
                    color: dayOrder === String(n) ? DO_COLORS[n].text : '#374151',
                    border: `1px solid ${dayOrder === String(n) ? DO_COLORS[n].border : '#D1D5DB'}`,
                    fontWeight: 700,
                  }}
                >
                  DO {n}
                </button>
              ))}
            </div>
            <p style={{ fontSize: 11, color: '#4B7C4B', margin: '8px 0 0' }}>
              {existing?.is_manual_override
                ? 'Manual override active — leave blank to keep current value.'
                : 'Leave on auto to continue the sequence from the previous working day.'}
            </p>
          </div>
        )}

        {/* Label for non-working days */}
        {dayType !== 'working' && (
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
              Label <span style={{ fontWeight: 400, opacity: 0.7 }}>(optional)</span>
            </label>
            <input
              type="text"
              style={{ width: '100%', boxSizing: 'border-box' }}
              className="input"
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder="e.g. Annual Sports Day"
            />
          </div>
        )}

        {/* Notes */}
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
            Notes <span style={{ fontWeight: 400, opacity: 0.7 }}>(optional)</span>
          </label>
          <textarea rows={2} className="input resize-none" value={notes} onChange={e => setNotes(e.target.value)} style={{ width: '100%', boxSizing: 'border-box' }} />
        </div>

        {/* Blocks operations notice */}
        {existing?.blocks_operations && (
          <div style={{
            background: '#FFFBEB', border: '1px solid #FDE68A',
            borderRadius: 8, padding: '10px 12px', fontSize: 12, color: '#92400E',
          }}>
            ⚠️ This date is excluded from timetable scheduling, substitute assignment, credit/workload calculation, and attendance.
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
          {existing && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={saving}
              className="btn-secondary"
              style={{ color: '#DC2626' }}
            >
              Delete
            </button>
          )}
          {existing?.is_manual_override && (
            <button type="button" onClick={handleClearOverride} disabled={saving} className="btn-secondary">
              Clear override
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary"
            style={{ flex: 1 }}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Skip / Reassign Panel ────────────────────────────────────────────────────

function SkipReassignPanel({ onDone }) {
  const [mode, setMode] = useState('assign')
  const [date, setDate] = useState('')
  const [value, setValue] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      if (mode === 'assign') {
        await academicCalendarApi.assignDayOrder({ date, day_order: Number(value) })
      } else {
        await academicCalendarApi.skipDayOrder({ date, skip_to_day_order: Number(value) })
      }
      setDate('')
      setValue('')
      onDone()
    } catch (err) {
      setError(err.response?.data?.detail || 'Operation failed.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px' }}>
      <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 4px' }}>
        Reassign or skip a Day Order
      </h3>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 14px' }}>
        Pin an explicit Day Order for a date, or deliberately jump the rotation (e.g. 3 → skip 4 → 5). Dates after this one auto-resequence.
      </p>
      <ErrorAlert message={error} />
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 10 }}>
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Action</label>
          <select className="input" value={mode} onChange={e => setMode(e.target.value)}>
            <option value="assign">Reassign Day Order</option>
            <option value="skip">Skip to Day Order</option>
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Date</label>
          <input type="date" required className="input" value={date} onChange={e => setDate(e.target.value)} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
            {mode === 'assign' ? 'Day Order' : 'Skip to'}
          </label>
          <select required className="input" value={value} onChange={e => setValue(e.target.value)}>
            <option value="">Select…</option>
            {[1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>Day Order {n}</option>)}
          </select>
        </div>
        <button type="button" disabled={saving} className="btn-primary" onClick={handleSubmit}>
          {saving ? 'Applying…' : 'Apply'}
        </button>
      </div>
    </div>
  )
}

// ─── Bulk Holiday Panel ───────────────────────────────────────────────────────

function BulkHolidayPanel({ onDone }) {
  const [form, setForm] = useState({ start_date: '', end_date: '', day_type: 'government_holiday', label: '' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      await academicCalendarApi.bulkMarkDays(form)
      setForm({ start_date: '', end_date: '', day_type: 'government_holiday', label: '' })
      onDone()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to bulk-mark.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px' }}>
      <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 4px' }}>
        Bulk-mark a date range
      </h3>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 14px' }}>
        Mark a contiguous block of dates the same way in one go — e.g. a week of Government Holiday.
      </p>
      <ErrorAlert message={error} />
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 10 }}>
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Start date</label>
          <input type="date" required className="input" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>End date</label>
          <input type="date" required className="input" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Day type</label>
          <select className="input" value={form.day_type} onChange={e => setForm({ ...form, day_type: e.target.value })}>
            {LEAVE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Label</label>
          <input type="text" className="input" value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} placeholder="e.g. Diwali Break" />
        </div>
        <button type="button" disabled={saving} className="btn-primary" onClick={handleSubmit}>
          {saving ? 'Marking…' : 'Mark range'}
        </button>
      </div>
    </div>
  )
}

// ─── Academic Years Panel ─────────────────────────────────────────────────────

function AcademicYearsPanel({ academicYears, onRefresh }) {
  const [form, setForm] = useState({ name: '', start_date: '', end_date: '' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [semesters, setSemesters] = useState({})
  const [semForm, setSemForm] = useState({})

  useEffect(() => {
    academicYears.forEach(y => {
      academicCalendarApi.listSemesters(y.id).then(r => setSemesters(s => ({ ...s, [y.id]: r.data })))
    })
  }, [academicYears])

  const handleCreateYear = async (e) => {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      await academicCalendarApi.createAcademicYear(form)
      setForm({ name: '', start_date: '', end_date: '' })
      onRefresh()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create academic year.')
    } finally {
      setSaving(false)
    }
  }

  const handleCreateSemester = async (yearId, e) => {
    e.preventDefault()
    const data = semForm[yearId] || {}
    try {
      await academicCalendarApi.createSemester({ academic_year_id: yearId, ...data })
      setSemForm(s => ({ ...s, [yearId]: { name: '', start_date: '', end_date: '' } }))
      academicCalendarApi.listSemesters(yearId).then(r => setSemesters(s => ({ ...s, [yearId]: r.data })))
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create semester.')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxHeight: '70vh', overflowY: 'auto' }}>
      <ErrorAlert message={error} />

      <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px' }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 12px' }}>
          New academic year
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input type="text" required placeholder="2026-2027" className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <div style={{ display: 'flex', gap: 8 }}>
            <input type="date" required className="input" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} style={{ flex: 1 }} />
            <input type="date" required className="input" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} style={{ flex: 1 }} />
          </div>
          <button type="button" onClick={handleCreateYear} disabled={saving} className="btn-primary" style={{ fontSize: 13 }}>
            {saving ? 'Creating…' : 'Create academic year'}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {academicYears.map(y => (
          <div key={y.id} style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px' }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 2px' }}>{y.name}</p>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 10px' }}>{y.start_date} → {y.end_date}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
              {(semesters[y.id] || []).map(s => (
                <div key={s.id} style={{
                  display: 'flex', justifyContent: 'space-between',
                  background: 'var(--surface-2)', borderRadius: 6,
                  padding: '6px 10px', fontSize: 12, color: 'var(--text-primary)',
                }}>
                  <span style={{ fontWeight: 500 }}>{s.name}</span>
                  <span style={{ color: 'var(--text-muted)' }}>{s.start_date} → {s.end_date}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <input type="text" required placeholder="Semester name" className="input" style={{ fontSize: 12, flex: '1 1 120px' }}
                value={semForm[y.id]?.name || ''} onChange={e => setSemForm(s => ({ ...s, [y.id]: { ...s[y.id], name: e.target.value } }))} />
              <input type="date" required className="input" style={{ fontSize: 12, flex: '1 1 130px' }}
                value={semForm[y.id]?.start_date || ''} onChange={e => setSemForm(s => ({ ...s, [y.id]: { ...s[y.id], start_date: e.target.value } }))} />
              <input type="date" required className="input" style={{ fontSize: 12, flex: '1 1 130px' }}
                value={semForm[y.id]?.end_date || ''} onChange={e => setSemForm(s => ({ ...s, [y.id]: { ...s[y.id], end_date: e.target.value } }))} />
              <button type="button" className="btn-secondary" style={{ fontSize: 12 }} onClick={(e) => handleCreateSemester(y.id, e)}>
                + Add semester
              </button>
            </div>
          </div>
        ))}
        {academicYears.length === 0 && (
          <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>
            No academic years yet.
          </p>
        )}
      </div>
    </div>
  )
}

// ─── Legend ───────────────────────────────────────────────────────────────────

function CalendarLegend() {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
      {/* Working day */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ width: 14, height: 14, borderRadius: 4, background: '#F0FDF4', border: '1.5px solid #BBF7D0' }} />
        <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Working + Day Order</span>
      </div>
      {LEAVE_TYPES.map(t => {
        const meta = LEAVE_TYPE_META[t.value]
        return (
          <div key={t.value} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 14, height: 14, borderRadius: 4, background: meta.bg, border: `1.5px solid ${meta.border}` }} />
            <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{t.label}</span>
          </div>
        )
      })}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ width: 14, height: 14, borderRadius: 4, background: 'var(--surface-2)', border: '2px solid #6366F1' }} />
        <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Today</span>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AcademicCalendar() {
  const today = new Date()
  const [searchParams, setSearchParams] = useSearchParams()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [days, setDays] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalState, setModalState] = useState(null)
  const [academicYears, setAcademicYears] = useState([])
  const [yearModalOpen, setYearModalOpen] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [pendingJumpDate, setPendingJumpDate] = useState(null)

  // Quick-mark mode: when set, clicking a day immediately marks it as that leave type
  const [activeLeaveType, setActiveLeaveType] = useState(null)
  const [quickSaving, setQuickSaving] = useState(null) // date string being saved

  useEffect(() => {
    const jumpDate = searchParams.get('date')
    if (!jumpDate) return
    const parsed = new Date(jumpDate + 'T00:00:00')
    if (isNaN(parsed.getTime())) return
    setYear(parsed.getFullYear())
    setMonth(parsed.getMonth())
    setPendingJumpDate(jumpDate)
    setSearchParams({}, { replace: true })
  }, [searchParams, setSearchParams])

  const monthStart = isoDate(year, month, 1)
  const monthEnd = isoDate(year, month, new Date(year, month + 1, 0).getDate())

  const load = () => {
    setLoading(true)
    academicCalendarApi.getRange(monthStart, monthEnd)
      .then(r => setDays(r.data))
      .finally(() => setLoading(false))
  }

  const refreshYears = () => academicCalendarApi.listAcademicYears().then(r => setAcademicYears(r.data))

  useEffect(() => { load() }, [year, month])
  useEffect(() => { refreshYears() }, [])

  const daysByDate = useMemo(() => {
    const map = {}
    for (const d of days) map[d.date] = d
    return map
  }, [days])

  useEffect(() => {
    if (!pendingJumpDate || loading) return
    const jumpMonthKey = pendingJumpDate.slice(0, 7)
    const loadedMonthKey = monthStart.slice(0, 7)
    if (jumpMonthKey !== loadedMonthKey) return
    setModalState({ date: pendingJumpDate, existing: daysByDate[pendingJumpDate] || null })
    setPendingJumpDate(null)
  }, [pendingJumpDate, loading, daysByDate, monthStart])

  const goPrevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11) } else { setMonth(m => m - 1) }
  }
  const goNextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0) } else { setMonth(m => m + 1) }
  }

  // Handle day click — quick-mark if a leave type is active, else open modal
  const handleDayClick = async (dateStr, entry) => {
    if (activeLeaveType) {
      // Quick-mark: immediately set to the active leave type
      setQuickSaving(dateStr)
      try {
        await academicCalendarApi.markDay({
          date: dateStr,
          day_type: activeLeaveType,
          day_order: null,
          label: null,
          notes: null,
        })
        load()
      } catch (err) {
        // Fail silently — open modal so user can see the error
        setModalState({ date: dateStr, existing: entry || null })
      } finally {
        setQuickSaving(null)
      }
    } else {
      setModalState({ date: dateStr, existing: entry || null })
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px' }}>
            Academic Calendar
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
            Select leave days — working days get Day Order automatically.
          </p>
        </div>
        <button
          onClick={() => setYearModalOpen(true)}
          className="btn-secondary"
          style={{ fontSize: 13, whiteSpace: 'nowrap' }}
        >
          Manage academic years
        </button>
      </div>

      {/* ── Leave Quick-Mark Panel ── */}
      <LeaveQuickPanel activeLeaveType={activeLeaveType} onSelect={setActiveLeaveType} />

      {/* ── Calendar Card ── */}
      <div style={{
        background: 'var(--surface-2)', border: '1px solid var(--border)',
        borderRadius: 16, padding: '20px 20px 16px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
      }}>

        {/* Month nav */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <button onClick={goPrevMonth} style={{
            padding: '6px 12px', borderRadius: 8, fontSize: 16, lineHeight: 1, cursor: 'pointer',
            background: 'var(--surface-1)', border: '1px solid var(--border)', color: 'var(--text-primary)',
          }}>←</button>

          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              {MONTH_NAMES[month]}
            </p>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '2px 0 0' }}>{year}</p>
          </div>

          <button onClick={goNextMonth} style={{
            padding: '6px 12px', borderRadius: 8, fontSize: 16, lineHeight: 1, cursor: 'pointer',
            background: 'var(--surface-1)', border: '1px solid var(--border)', color: 'var(--text-primary)',
          }}>→</button>
        </div>

        {/* Month stats */}
        {!loading && days.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <MonthStats days={days} />
          </div>
        )}

        {/* Grid */}
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
            <Spinner />
          </div>
        ) : (
          <MonthGrid
            year={year}
            month={month}
            daysByDate={daysByDate}
            onDayClick={handleDayClick}
          />
        )}

        {/* Active mode hint */}
        {activeLeaveType && (
          <div style={{
            marginTop: 12, padding: '8px 12px', borderRadius: 8,
            background: '#FFFBEB', border: '1px solid #FDE68A',
            fontSize: 12, color: '#92400E', display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <span>⚡</span>
            <span>
              Quick-mark mode active — clicking any day marks it as{' '}
              <strong>{LEAVE_TYPES.find(t => t.value === activeLeaveType)?.label}</strong>.{' '}
              Working days nearby continue the Day Order sequence automatically.
            </span>
          </div>
        )}

        {/* Legend */}
        <div style={{ borderTop: '1px solid var(--border)', marginTop: 16, paddingTop: 14 }}>
          <CalendarLegend />
        </div>
      </div>

      {/* ── Advanced Tools ── */}
      <div>
        <button
          onClick={() => setAdvancedOpen(o => !o)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)',
            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
          }}
        >
          <span style={{
            display: 'inline-block',
            transform: advancedOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.15s ease',
            fontSize: 11,
          }}>▼</span>
          Advanced tools
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>
            (skip/reassign Day Order, bulk-mark a range)
          </span>
        </button>
        {advancedOpen && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
            <SkipReassignPanel onDone={load} />
            <BulkHolidayPanel onDone={load} />
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      <MarkDayModal
        open={!!modalState}
        onClose={() => setModalState(null)}
        date={modalState?.date}
        existing={modalState?.existing}
        onSaved={load}
      />

      <Modal open={yearModalOpen} onClose={() => setYearModalOpen(false)} title="Academic years and semesters">
        <AcademicYearsPanel academicYears={academicYears} onRefresh={refreshYears} />
      </Modal>
    </div>
  )
}