import { useEffect, useState, useCallback, useReducer, useRef } from 'react'
import { teachersApi, timetableApi, subjectsApi, classesApi, roomsApi } from '../../api/services'
import { Spinner } from '../../components/ui'

// ── Constants ─────────────────────────────────────────────────────────────────
const DAY_ORDERS = [1, 2, 3, 4, 5, 6]
const PERIODS    = [1, 2, 3, 4, 5]


const DAY_SHORT = { 1: 'DO1', 2: 'DO2', 3: 'DO3', 4: 'DO4', 5: 'DO5', 6: 'DO6' }
const DAY_FULL  = { 1: 'Day Order 1', 2: 'Day Order 2', 3: 'Day Order 3', 4: 'Day Order 4', 5: 'Day Order 5', 6: 'Day Order 6' }
const PERIOD_TIMES = {
  1: '8:00–9:00',
  2: '9:00–10:00',
  3: '10:15–11:15',
  4: '11:15–12:15',
  5: '1:00–2:00',
}

const SUBJECT_COLORS = [
  { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' },
  { bg: '#F0FDF4', text: '#15803D', border: '#BBF7D0' },
  { bg: '#FFFBEB', text: '#B45309', border: '#FDE68A' },
  { bg: '#FDF4FF', text: '#9333EA', border: '#E9D5FF' },
  { bg: '#FFF1F2', text: '#BE123C', border: '#FECDD3' },
  { bg: '#FFF7ED', text: '#C2410C', border: '#FED7AA' },
  { bg: '#ECFEFF', text: '#0E7490', border: '#A5F3FC' },
  { bg: '#F0FDF4', text: '#166534', border: '#86EFAC' },
]

const colorMap = {}
let colorIdx = 0
function getColor(subjectId) {
  if (subjectId === null || subjectId === undefined) {
    return { bg: '#EEF2FF', text: '#4F46E5', border: '#C7D2FE' }
  }
  if (!colorMap[subjectId]) colorMap[subjectId] = SUBJECT_COLORS[colorIdx++ % SUBJECT_COLORS.length]
  return colorMap[subjectId]
}

function abbrev(name) {
  if (!name) return '?'
  return name.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 3)
}

function initials(name) {
  if (!name) return '??'
  const parts = name.trim().split(/\s+/)
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase()
}

// ── History reducer ───────────────────────────────────────────────────────────
function historyReducer(state, action) {
  switch (action.type) {
    case 'SET':  return { past: [...state.past.slice(-19), state.present], present: action.payload, future: [] }
    case 'UNDO': if (!state.past.length) return state
      return { past: state.past.slice(0, -1), present: state.past[state.past.length - 1], future: [state.present, ...state.future] }
    case 'REDO': if (!state.future.length) return state
      return { past: [...state.past, state.present], present: state.future[0], future: state.future.slice(1) }
    case 'INIT': return { past: [], present: action.payload, future: [] }
    default:     return state
  }
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ toasts }) {
  return (
    <div className="tt-toast-wrap">
      {toasts.map(t => (
        <div key={t.id} className={`tt-toast tt-toast--${t.type || 'success'}`}>
          <span className="tt-toast-dot" />
          {t.message}
        </div>
      ))}
    </div>
  )
}

// ── SVG icons ─────────────────────────────────────────────────────────────────
const IconSearch  = () => <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
const IconPaint   = () => <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M2 20c.5-1.5 2-2.5 3.5-2.5 2 0 3.5 1.5 3.5 3.5 0 1-1 1-1 2 0 .83.67 1.5 1.5 1.5C19 24.5 22 17 22 12A10 10 0 0 0 2 12c0 2.5.6 4.7 0 8z"/></svg>
const IconUndo    = () => <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24"><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></svg>
const IconRedo    = () => <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24"><polyline points="15 14 20 9 15 4"/><path d="M4 20v-7a4 4 0 0 1 4-4h12"/></svg>
const IconTrash   = () => <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
const IconChevron = () => <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
const IconCheck   = () => <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
const IconWarning = () => <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>

// ── Main component ────────────────────────────────────────────────────────────
export default function AdminTimetable() {
  // ── Master data ──────────────────────────────────────────────────────────
  const [teachers,    setTeachers]    = useState([])
  const [subjects,    setSubjects]    = useState([])
  const [classes,     setClasses]     = useState([])
  const [rooms,       setRooms]       = useState([])
  const [masterReady, setMasterReady] = useState(false)

  // ── UI state ──────────────────────────────────────────────────────────────
  const [selectedTeacherId, setSelectedTeacherId] = useState('')
  const [teacherSearch,     setTeacherSearch]     = useState('')
  const [subjectSearch,     setSubjectSearch]     = useState('')
  const [roomFilter,        setRoomFilter]        = useState('')
  const [loading,           setLoading]           = useState(false)
  const [saving,            setSaving]            = useState(false)
  const [activeSubject,     setActiveSubject]     = useState(null)
  const [selectedCell,      setSelectedCell]      = useState(null)
  const [paintMode,         setPaintMode]         = useState(false)
  const [isPainting,        setIsPainting]        = useState(false)
  const [paintHover,        setPaintHover]        = useState(null)
  const [dragSubject,       setDragSubject]       = useState(null)
  const [dragOver,          setDragOver]          = useState(null)
  const [conflicts,         setConflicts]         = useState({})
  const [toasts,            setToasts]            = useState([])
  const [editRoom,          setEditRoom]          = useState('')
  const [poppedCells,       setPoppedCells]       = useState(new Set())

  const [selectedClassId,   setSelectedClassId]   = useState('')
  const [selectedSubjectId, setSelectedSubjectId] = useState('')
  const [selectedRoomId,    setSelectedRoomId]    = useState('')

  useEffect(() => {
    setSelectedClassId('')
    setSelectedSubjectId('')
    setSelectedRoomId('')
    if (selectedCell?.slot) {
      setEditRoom(selectedCell.slot.room_id ? String(selectedCell.slot.room_id) : '')
    } else {
      setEditRoom('')
    }
  }, [selectedCell])

  // ── Slot history ──────────────────────────────────────────────────────────
  const [history, dispatch] = useReducer(historyReducer, { past: [], present: [], future: [] })
  const slots = history.present

  const toastId = useRef(0)
  const toast = useCallback((message, type = 'success') => {
    const id = ++toastId.current
    setToasts(t => [...t, { id, message, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3000)
  }, [])

  // ── Enrich slot ───────────────────────────────────────────────────────────
  const enrich = useCallback((slot, subjs, clss, rms) => ({
    ...slot,
    subject_name: slot.subject_id ? (subjs.find(x => x.id === slot.subject_id)?.name || `Subject #${slot.subject_id}`) : 'Assigned',
    subject_code: slot.subject_id ? (subjs.find(x => x.id === slot.subject_id)?.code || '???') : '',
    class_name:   (() => { const c = clss.find(x => x.id === slot.class_id); return c ? `${c.name}-${c.section}` : `Class #${slot.class_id}` })(),
    room_name:    rms.find(x => x.id === slot.room_id)?.room_number || '',
  }), [])

  // ── Load master data ──────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([teachersApi.list(), subjectsApi.list(), classesApi.list(), roomsApi.list()])
      .then(([t, s, c, r]) => {
        setTeachers(t.data); setSubjects(s.data); setClasses(c.data); setRooms(r.data)
        setMasterReady(true)
      })
      .catch(() => toast('Failed to load master data', 'error'))
  }, [])

  // ── Load slots ────────────────────────────────────────────────────────────
  const loadSlots = useCallback((subjs, clss, rms) => {
    if (!selectedTeacherId || !masterReady) return
    setLoading(true)
    timetableApi.getByTeacher(selectedTeacherId)
      .then(r => {
        dispatch({ type: 'INIT', payload: r.data.map(s => enrich(s, subjs, clss, rms)) })
        setSelectedCell(null); setActiveSubject(null)
      })
      .catch(() => toast('Failed to load timetable', 'error'))
      .finally(() => setLoading(false))
  }, [selectedTeacherId, masterReady, enrich])

  useEffect(() => {
    if (masterReady && selectedTeacherId) loadSlots(subjects, classes, rooms)
  }, [selectedTeacherId, masterReady])

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const handler = e => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault(); dispatch({ type: 'UNDO' }); toast('Undone', 'warn')
      } else if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault(); dispatch({ type: 'REDO' }); toast('Redone', 'warn')
      } else if (e.key === 'p' || e.key === 'P') {
        setPaintMode(m => !m)
      } else if (e.key === 'Escape') {
        setActiveSubject(null); setSelectedCell(null)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [toast])

  // ── Slot lookup ───────────────────────────────────────────────────────────
  const slotAt = (day, period) => slots.find(s => s.day_order === day && s.period_number === period)

  // ── Pop animation helper ──────────────────────────────────────────────────
  const popCell = (day, period) => {
    const key = `${day}-${period}`
    setPoppedCells(s => new Set([...s, key]))
    setTimeout(() => setPoppedCells(s => { const n = new Set(s); n.delete(key); return n }), 300)
  }

  // ── Assign slot ───────────────────────────────────────────────────────────
  const assignSlot = useCallback(async (day, period, subjectOverride) => {
    const subj = subjectOverride || activeSubject
    if (!subj) return
    if (slotAt(day, period)) { toast(`${DAY_SHORT[day]} · P${period} is already occupied`, 'warn'); return }
    const cls = subj.cls || classes[0]
    if (!cls) { toast('No class found — add a class first', 'error'); return }
    setSaving(true)
    try {
      const res = await timetableApi.createSlot({
        teacher_id:    Number(selectedTeacherId),
        subject_id:    subj.subject.id,
        class_id:      cls.id,
        room_id:       null,
        day_order:     day,
        period_number: period,
      })
      dispatch({ type: 'SET', payload: [...slots, enrich(res.data, subjects, classes, rooms)] })
      popCell(day, period)
      toast(`${subj.subject.code} → ${DAY_SHORT[day]} P${period}`)
    } catch (err) {
      const msg = err.response?.data?.detail || 'Failed to assign slot'
      toast(msg, 'error')
      setConflicts(c => ({ ...c, [`${day}-${period}`]: msg }))
      setTimeout(() => setConflicts(c => { const n = { ...c }; delete n[`${day}-${period}`]; return n }), 4000)
    } finally { setSaving(false) }
  }, [activeSubject, selectedTeacherId, slots, subjects, classes, rooms, enrich, toast])

  // ── Remove slot ───────────────────────────────────────────────────────────
  const removeSlot = useCallback(async slotObj => {
    if (!slotObj) return
    setSaving(true)
    try {
      await timetableApi.deleteSlot(slotObj.id)
      dispatch({ type: 'SET', payload: slots.filter(s => s.id !== slotObj.id) })
      setSelectedCell(null)
      toast('Slot removed', 'warn')
    } catch (err) {
      toast(err.response?.data?.detail || 'Failed to remove slot', 'error')
    } finally { setSaving(false) }
  }, [slots, toast])

  // ── Clear all ─────────────────────────────────────────────────────────────
  const clearAll = useCallback(async () => {
    if (!slots.length) return
    if (!window.confirm(`Remove all ${slots.length} slots for this teacher?`)) return
    setSaving(true)
    try {
      await Promise.all(slots.map(s => timetableApi.deleteSlot(s.id)))
      dispatch({ type: 'INIT', payload: [] })
      setSelectedCell(null)
      toast('Timetable cleared', 'warn')
    } catch { toast('Failed to clear timetable', 'error') }
    finally { setSaving(false) }
  }, [slots, toast])

  // ── Update room ───────────────────────────────────────────────────────────
  const updateRoom = useCallback(async (slotObj, roomId) => {
    setSaving(true)
    try {
      await timetableApi.deleteSlot(slotObj.id)
      const res = await timetableApi.createSlot({
        teacher_id: slotObj.teacher_id, subject_id: slotObj.subject_id,
        class_id: slotObj.class_id, room_id: roomId ? Number(roomId) : null,
        day_order: slotObj.day_order, period_number: slotObj.period_number,
      })
      const updated = enrich(res.data, subjects, classes, rooms)
      dispatch({ type: 'SET', payload: slots.map(s => s.id === slotObj.id ? updated : s) })
      setSelectedCell(prev => prev ? { ...prev, slot: updated } : prev)
      toast('Room updated')
    } catch (err) {
      toast(err.response?.data?.detail || 'Failed to update room', 'error')
    } finally { setSaving(false) }
  }, [slots, subjects, classes, rooms, enrich, toast])

  const handleAssignFromPanel = async () => {
    if (!selectedCell || !selectedClassId || !selectedTeacherId) return
    setSaving(true)
    try {
      const res = await timetableApi.createSlot({
        teacher_id:    Number(selectedTeacherId),
        subject_id:    selectedSubjectId ? Number(selectedSubjectId) : null,
        class_id:      Number(selectedClassId),
        room_id:       selectedRoomId ? Number(selectedRoomId) : null,
        day_order:     selectedCell.day_order,
        period_number: selectedCell.period_number,
      })
      const enrichedSlot = enrich(res.data, subjects, classes, rooms)
      dispatch({ type: 'SET', payload: [...slots, enrichedSlot] })
      popCell(selectedCell.day_order, selectedCell.period_number)
      toast('Slot assigned successfully')
      setSelectedCell(null)
    } catch (err) {
      toast(err.response?.data?.detail || 'Failed to assign slot', 'error')
    } finally {
      setSaving(false)
    }
  }

  // ── Cell click ────────────────────────────────────────────────────────────
  const handleCellClick = useCallback((day, period) => {
    const slot = slotAt(day, period)
    if (activeSubject && !slot) { assignSlot(day, period); return }
    setSelectedCell({ day_order: day, period_number: period, slot })
    if (slot) setEditRoom(slot.room_id ? String(slot.room_id) : '')
  }, [activeSubject, assignSlot, slots])

  // ── Drag handlers ─────────────────────────────────────────────────────────
  const handleDrop = useCallback((day, period) => {
    setDragOver(null)
    if (!dragSubject) return
    if (slotAt(day, period)) { toast('Cell occupied', 'warn'); return }
    assignSlot(day, period, dragSubject)
    setDragSubject(null)
  }, [dragSubject, assignSlot, slots, toast])

  // ── Derived ───────────────────────────────────────────────────────────────
  const filteredTeachers = teachers.filter(t =>
    !teacherSearch || t.name.toLowerCase().includes(teacherSearch.toLowerCase()))
  const filteredSubjects = subjects.filter(s =>
    !subjectSearch ||
    s.name.toLowerCase().includes(subjectSearch.toLowerCase()) ||
    s.code.toLowerCase().includes(subjectSearch.toLowerCase()))
  const selectedTeacher = teachers.find(t => t.id === Number(selectedTeacherId))
  const creditsSummary  = subjects
    .map(s => ({ ...s, count: slots.filter(sl => sl.subject_id === s.id).length }))
    .filter(s => s.count > 0)

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="tt-root">
      <style>{CSS}</style>

      {/* ── Header ── */}
      <header className="tt-header">
        {/* Brand */}
        <div className="tt-brand">
          <svg className="tt-brand-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            <rect x="8" y="14" width="3" height="3" rx=".5"/>
          </svg>
          <div>
            <h1 className="tt-title">Timetable</h1>
            <p className="tt-subtitle">
              Select a subject → click or drag cells &nbsp;·&nbsp;
              <kbd className="tt-kbd">P</kbd> paint &nbsp;·&nbsp;
              <kbd className="tt-kbd">Esc</kbd> deselect
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="tt-controls">
          {/* Teacher picker */}
          <div className="tt-search-row">
            <div className="tt-input-icon-wrap">
              <IconSearch />
              <input
                className="tt-input tt-input--icon"
                placeholder="Search teachers…"
                value={teacherSearch}
                onChange={e => setTeacherSearch(e.target.value)}
              />
            </div>
            <select
              className="tt-select"
              value={selectedTeacherId}
              onChange={e => { setSelectedTeacherId(e.target.value); setSelectedCell(null); setActiveSubject(null) }}
            >
              <option value="">Select teacher…</option>
              {filteredTeachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>

          {/* Action buttons */}
          <div className="tt-action-row">
            <button
              className={`tt-btn ${paintMode ? 'tt-btn--paint-on' : 'tt-btn--paint-off'}`}
              onClick={() => setPaintMode(m => !m)}
              title="Toggle paint mode (P)"
            >
              {paintMode && <span className="tt-paint-pulse" />}
              <IconPaint />
              Paint {paintMode ? 'on' : 'off'}
            </button>

            <div className="tt-btn-group">
              <button
                className="tt-btn tt-btn--icon"
                onClick={() => { dispatch({ type: 'UNDO' }); toast('Undone', 'warn') }}
                disabled={!history.past.length}
                title="Undo (Ctrl+Z)"
              ><IconUndo /></button>
              <button
                className="tt-btn tt-btn--icon"
                onClick={() => { dispatch({ type: 'REDO' }); toast('Redone', 'warn') }}
                disabled={!history.future.length}
                title="Redo (Ctrl+Y)"
              ><IconRedo /></button>
            </div>

            {slots.length > 0 && selectedTeacherId && (
              <button className="tt-btn tt-btn--danger" onClick={clearAll} disabled={saving} title="Clear all slots">
                <IconTrash /> Clear all
              </button>
            )}

            {saving && (
              <span className="tt-saving">
                <span className="tt-saving-dot" /> Saving…
              </span>
            )}
          </div>
        </div>
      </header>

      {/* ── Three-panel body ── */}
      <div className="tt-body">

        {/* ── LEFT: subject panel ── */}
        <aside className="tt-left">
          <div className="tt-input-icon-wrap" style={{ width: '100%' }}>
            <IconSearch />
            <input
              className="tt-input tt-input--icon tt-input--sm"
              placeholder="Filter subjects…"
              value={subjectSearch}
              onChange={e => setSubjectSearch(e.target.value)}
              style={{ width: '100%', boxSizing: 'border-box' }}
            />
          </div>

          <div className="tt-panel-label">
            Subjects
            <span className="tt-badge">{subjects.length}</span>
          </div>

          {/* Subject cards */}
          <div className="tt-subject-list">
            {filteredSubjects.map(s => {
              const color   = getColor(s.id)
              const cls     = classes.find(c => c.id === s.class_id)
              const isActive = activeSubject?.subject?.id === s.id
              const slotCount = slots.filter(sl => sl.subject_id === s.id).length

              return (
                <div
                  key={s.id}
                  draggable
                  onDragStart={() => setDragSubject({ subject: s, cls, color })}
                  onDragEnd={() => setDragSubject(null)}
                  onClick={() => setActiveSubject(isActive ? null : { subject: s, cls, color })}
                  className={`tt-subject-card ${isActive ? 'tt-subject-card--active' : ''}`}
                  style={{ '--sc': color.border, '--sc-bg': color.bg, '--sc-text': color.text }}
                >
                  <div className="sc-stripe" />
                  <div className="sc-body">
                    <div className="sc-code">{s.code}</div>
                    <div className="sc-name">{s.name}</div>
                    {cls && <div className="sc-class">{cls.name}–{cls.section}</div>}
                  </div>
                  {slotCount > 0 && (
                    <div className="sc-count" style={{ color: isActive ? color.text : undefined }}>
                      {slotCount}
                    </div>
                  )}
                </div>
              )
            })}

            {filteredSubjects.length === 0 && (
              <div className="tt-empty-list">No subjects found</div>
            )}
          </div>

          {/* Active subject indicator */}
          {activeSubject && (
            <div className="tt-active-hint" style={{ '--hint-border': activeSubject.color.border, '--hint-bg': activeSubject.color.bg, '--hint-text': activeSubject.color.text }}>
              <IconCheck />
              <span><strong>{activeSubject.subject.code}</strong> selected — click empty cells to assign</span>
            </div>
          )}
        </aside>

        {/* ── CENTER: grid ── */}
        <main
          className={`tt-center ${paintMode && activeSubject ? 'tt-center--paint' : ''}`}
          onMouseDown={() => { if (paintMode) setIsPainting(true) }}
          onMouseUp={() => setIsPainting(false)}
          onMouseLeave={() => { setIsPainting(false); setPaintHover(null) }}
        >
          {!selectedTeacherId ? (
            <div className="tt-empty-state">
              <svg className="tt-empty-icon" viewBox="0 0 64 64" fill="none">
                <rect x="8" y="10" width="48" height="48" rx="6" stroke="#D1D5DB" strokeWidth="2.5"/>
                <line x1="8" y1="24" x2="56" y2="24" stroke="#D1D5DB" strokeWidth="2.5"/>
                <line x1="22" y1="10" x2="22" y2="24" stroke="#D1D5DB" strokeWidth="2.5"/>
                <line x1="8" y1="38" x2="56" y2="38" stroke="#E5E7EB" strokeWidth="1.5"/>
                <rect x="27" y="30" width="8" height="6" rx="1.5" fill="#E5E7EB"/>
                <rect x="40" y="30" width="8" height="6" rx="1.5" fill="#E5E7EB"/>
                <rect x="14" y="43" width="8" height="6" rx="1.5" fill="#E5E7EB"/>
                <rect x="27" y="43" width="8" height="6" rx="1.5" fill="#EEF2FF"/>
                <line x1="44" y1="6" x2="44" y2="14" stroke="#D1D5DB" strokeWidth="2.5" strokeLinecap="round"/>
              </svg>
              <p className="tt-empty-title">Select a teacher to start</p>
              <p className="tt-empty-sub">Use the dropdown above, then pick a subject and click cells to build their schedule</p>
            </div>
          ) : loading ? (
            <div className="tt-loading">
              <Spinner />
              <span>Loading schedule…</span>
            </div>
          ) : (
            <div className="tt-grid-wrapper">
              {/* Period header row */}
              <div className="tt-grid-head">
                <div className="tt-corner" />
                {PERIODS.map(p => (
                  <div key={p} className="tt-period-head">
                    <span className="ph-num">Period {p}</span>
                    <span className="ph-time">{PERIOD_TIMES[p]}</span>
                  </div>
                ))}
              </div>

              {/* Day rows */}
              {DAY_ORDERS.map(day => (
                <div key={day} className="tt-grid-row">
                  {/* Day label */}
                  <div className="tt-day-label">
                    <span className="dl-short">{DAY_SHORT[day]}</span>
                    <span className="dl-full">{DAY_FULL[day]}</span>
                  </div>

                  {/* Cells */}
                  {PERIODS.map(period => {
                    const slot       = slotAt(day, period)
                    const color      = slot ? getColor(slot.subject_id) : null
                    const isSelected = selectedCell?.day_order === day && selectedCell?.period_number === period
                    const isDragOver = dragOver?.day === day && dragOver?.period === period
                    const isPaintHov = paintHover?.day === day && paintHover?.period === period
                    const conflict   = conflicts[`${day}-${period}`]
                    const isPopped   = poppedCells.has(`${day}-${period}`)

                    let cellBg = '#FAFAFA'
                    if (slot) cellBg = isSelected ? (color?.border || '#E5E7EB') : (color?.bg || '#F9FAFB')
                    else if (isDragOver)                    cellBg = '#EEF2FF'
                    else if (isPaintHov && activeSubject)   cellBg = '#F5F3FF'
                    else if (isSelected)                    cellBg = '#F0F9FF'

                    let borderColor = '#E4E7EC'
                    if (conflict)        borderColor = '#EF4444'
                    else if (isSelected) borderColor = color?.border || '#6366F1'
                    else if (isDragOver) borderColor = '#818CF8'
                    else if (slot)       borderColor = color?.border || '#E4E7EC'

                    return (
                      <div
                        key={period}
                        className={[
                          'tt-cell',
                          slot       ? 'tt-cell--filled' : 'tt-cell--empty',
                          isSelected ? 'tt-cell--selected' : '',
                          isDragOver ? 'tt-cell--drag-over' : '',
                          conflict   ? 'tt-cell--conflict' : '',
                          isPopped   ? 'tt-cell--pop' : '',
                        ].join(' ')}
                        style={{
                          '--cb': cellBg,
                          '--cbr': borderColor,
                          '--ct': color?.text || '#374151',
                          '--csel': color?.border || '#818CF8',
                        }}
                        onClick={() => handleCellClick(day, period)}
                        onMouseEnter={() => {
                          setPaintHover({ day, period })
                          if (paintMode && isPainting && activeSubject && !slot) assignSlot(day, period)
                        }}
                        onMouseLeave={() => setPaintHover(null)}
                        onDragOver={e => { e.preventDefault(); setDragOver({ day, period }) }}
                        onDragLeave={() => setDragOver(null)}
                        onDrop={() => handleDrop(day, period)}
                        title={conflict || (slot ? `${slot.subject_id ? slot.subject_name : 'Assigned'} · ${slot.class_name}` : `${DAY_SHORT[day]} · Period ${period}`)}
                      >
                        {slot && color && (
                          <div className="cell-top-bar" style={{ background: color.border }} />
                        )}

                        {slot ? (
                          <div className="cell-content">
                            <span className="cell-code">{slot.subject_id ? (slot.subject_code || abbrev(slot.subject_name)) : "Assigned"}</span>
                            <span className="cell-class">{slot.class_name}</span>
                            {slot.room_name && <span className="cell-room">{slot.room_name}</span>}
                          </div>
                        ) : (
                          <span className="cell-plus">
                            {isDragOver ? '↓' : '+'}
                          </span>
                        )}

                        {conflict && <span className="cell-conflict-dot" />}
                      </div>
                    )
                  })}
                </div>
              ))}

              {/* Credits row */}
              {creditsSummary.length > 0 && (
                <div className="tt-credits">
                  <span className="credits-label">Slots assigned</span>
                  <div className="credits-chips">
                    {creditsSummary.map(s => {
                      const color = getColor(s.id)
                      return (
                        <span key={s.id} className="credit-chip"
                          style={{ '--chip-bg': color.bg, '--chip-border': color.border, '--chip-text': color.text }}>
                          <strong>{s.code}</strong>&nbsp;·&nbsp;{s.count}
                        </span>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </main>

        {/* ── RIGHT: detail panel ── */}
        <aside className="tt-right">

          {/* Teacher card */}
          {selectedTeacher && (
            <div className="tt-teacher-card">
              <div className="teacher-avatar">
                {initials(selectedTeacher.name)}
              </div>
              <div className="teacher-info">
                <div className="teacher-name">{selectedTeacher.name}</div>
                {selectedTeacher.department && (
                  <div className="teacher-dept">{selectedTeacher.department}</div>
                )}
                <div className="teacher-slots">{slots.length} slot{slots.length !== 1 ? 's' : ''} assigned</div>
              </div>
            </div>
          )}

          {/* Cell detail / placeholder */}
          {selectedCell ? (
            <div className="tt-cell-detail">
              <div className="cd-chips">
                <span className="cd-chip cd-chip--day">{DAY_SHORT[selectedCell.day_order]}</span>
                <span className="cd-chip cd-chip--period">Period {selectedCell.period_number}</span>
                <span className="cd-chip cd-chip--time">{PERIOD_TIMES[selectedCell.period_number]}</span>
              </div>

              {selectedCell.slot ? (
                <>
                  <div className="cd-subject">{selectedCell.slot.subject_name}</div>
                  <div className="cd-class">{selectedCell.slot.class_name}</div>

                  <div className="cd-section">
                    <label className="cd-label">Room</label>
                    <input
                      className="tt-input tt-input--sm"
                      placeholder="Filter rooms…"
                      value={roomFilter}
                      onChange={e => setRoomFilter(e.target.value)}
                      style={{ width: '100%', boxSizing: 'border-box', marginBottom: 5 }}
                    />
                    <select
                      className="tt-select tt-select--sm"
                      value={editRoom}
                      onChange={e => { setEditRoom(e.target.value); updateRoom(selectedCell.slot, e.target.value) }}
                      style={{ width: '100%', boxSizing: 'border-box' }}
                    >
                      <option value="">No room</option>
                      {rooms
                        .filter(r => !roomFilter || r.room_number.toLowerCase().includes(roomFilter.toLowerCase()))
                        .map(r => <option key={r.id} value={r.id}>{r.room_number}</option>)}
                    </select>
                  </div>

                  <button
                    className="tt-remove-btn"
                    onClick={() => removeSlot(selectedCell.slot)}
                    disabled={saving}
                  >
                    <IconTrash /> Remove this slot
                  </button>
                </>
              ) : (
                <div className="space-y-4 pt-4 border-t border-gray-100 mt-4">
                  {activeSubject ? (
                    <div className="cd-empty">
                      <strong style={{ color: '#4F46E5' }}>{activeSubject.subject.code}</strong> is ready — click again to assign
                    </div>
                  ) : (
                    <div className="space-y-3" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Assign Class Section</div>
                      
                      <div>
                        <label className="block text-[10px] font-medium text-gray-500 mb-1" style={{ display: 'block', fontSize: '10px', color: '#64748B', marginBottom: '3px' }}>Class Section *</label>
                        <select
                          className="tt-select w-full"
                          value={selectedClassId}
                          onChange={e => setSelectedClassId(e.target.value)}
                          style={{ width: '100%', boxSizing: 'border-box' }}
                        >
                          <option value="">Select class section…</option>
                          {classes.map(c => (
                            <option key={c.id} value={c.id}>{c.name} - {c.section}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-medium text-gray-500 mb-1" style={{ display: 'block', fontSize: '10px', color: '#64748B', marginBottom: '3px' }}>Subject (Optional)</label>
                        <select
                          className="tt-select w-full"
                          value={selectedSubjectId}
                          onChange={e => setSelectedSubjectId(e.target.value)}
                          style={{ width: '100%', boxSizing: 'border-box' }}
                        >
                          <option value="">None / General Duty</option>
                          {subjects.map(s => (
                            <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-medium text-gray-500 mb-1" style={{ display: 'block', fontSize: '10px', color: '#64748B', marginBottom: '3px' }}>Room (Optional)</label>
                        <select
                          className="tt-select w-full"
                          value={selectedRoomId}
                          onChange={e => setSelectedRoomId(e.target.value)}
                          style={{ width: '100%', boxSizing: 'border-box' }}
                        >
                          <option value="">None / No Room</option>
                          {rooms.map(r => (
                            <option key={r.id} value={r.id}>{r.room_number}</option>
                          ))}
                        </select>
                      </div>

                      <button
                        type="button"
                        className="tt-btn tt-btn--primary w-full py-2 mt-2"
                        onClick={handleAssignFromPanel}
                        disabled={!selectedClassId || saving}
                        style={{ width: '100%', display: 'block' }}
                      >
                        {saving ? 'Assigning…' : 'Assign Slot'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="tt-detail-placeholder">
              <svg viewBox="0 0 48 48" fill="none" className="dp-icon">
                <rect x="4" y="4" width="40" height="40" rx="6" stroke="#E4E7EC" strokeWidth="2"/>
                <path d="M16 24h16M24 16v16" stroke="#E4E7EC" strokeWidth="2.5" strokeLinecap="round"/>
              </svg>
              <span>Click any cell<br/>to view details</span>
            </div>
          )}

          {/* Conflicts */}
          {Object.keys(conflicts).length > 0 && (
            <div className="tt-conflicts">
              <div className="conflicts-head">
                <IconWarning />
                Conflicts
              </div>
              {Object.entries(conflicts).map(([key, msg]) => (
                <div key={key} className="conflict-item">
                  <strong>{key.replace('-', ` ${DAY_SHORT[+key.split('-')[0]]} ·`)}</strong> {msg}
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>

      <Toast toasts={toasts} />
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────
const CSS = `
/* ─── Animations ─────────────────────────────────────────────────────────── */
@keyframes ttSlide   { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:translateY(0) } }
@keyframes ttPop     { 0%,100% { transform:scale(1) } 45% { transform:scale(1.07) } }
@keyframes ttPulse   { 0%,100% { opacity:1; transform:scale(1) } 50% { opacity:.45; transform:scale(1.5) } }
@keyframes ttPaintPulse { 0%,100% { opacity:1 } 50% { opacity:.4 } }

/* ─── Root ───────────────────────────────────────────────────────────────── */
.tt-root {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif;
  background: #F7F8FC;
  color: #1E2532;
  font-size: 13px;
  line-height: 1.4;
}

/* ─── Header ─────────────────────────────────────────────────────────────── */
.tt-header {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 18px;
  background: #fff;
  border-bottom: 1px solid #E8EBEF;
  flex-wrap: wrap;
  flex-shrink: 0;
}

.tt-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 150px;
}

.tt-brand-icon {
  width: 24px;
  height: 24px;
  color: #4F46E5;
  flex-shrink: 0;
}

.tt-title {
  font-size: 16px;
  font-weight: 700;
  color: #1E2532;
  margin: 0;
  letter-spacing: -0.3px;
}

.tt-subtitle {
  font-size: 11px;
  color: #94A3B8;
  margin: 2px 0 0;
  line-height: 1;
}

.tt-kbd {
  display: inline-block;
  padding: 1px 5px;
  background: #F1F5F9;
  border: 1px solid #E2E8F0;
  border-radius: 4px;
  font-size: 10px;
  font-family: inherit;
  color: #64748B;
}

.tt-controls {
  display: flex;
  flex-direction: column;
  gap: 7px;
  align-items: flex-end;
}

.tt-search-row,
.tt-action-row {
  display: flex;
  align-items: center;
  gap: 7px;
}

/* ─── Input / Select ─────────────────────────────────────────────────────── */
.tt-input-icon-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.tt-input-icon-wrap svg {
  position: absolute;
  left: 9px;
  color: #94A3B8;
  pointer-events: none;
}

.tt-input {
  padding: 7px 10px;
  border: 1px solid #E4E7EC;
  border-radius: 8px;
  font-size: 12px;
  color: #334155;
  background: #fff;
  outline: none;
  transition: border-color .15s, box-shadow .15s;
}

.tt-input--icon { padding-left: 28px; }
.tt-input--sm   { padding: 5px 8px; font-size: 11px; border-radius: 7px; }

.tt-input:focus {
  border-color: #818CF8;
  box-shadow: 0 0 0 3px #EEF2FF;
}

.tt-select {
  padding: 7px 10px;
  border: 1px solid #E4E7EC;
  border-radius: 8px;
  font-size: 12px;
  color: #334155;
  background: #fff;
  cursor: pointer;
  outline: none;
  transition: border-color .15s;
}

.tt-select:focus { border-color: #818CF8; }
.tt-select--sm   { padding: 5px 8px; font-size: 11px; border-radius: 7px; }

/* ─── Buttons ────────────────────────────────────────────────────────────── */
.tt-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 12px;
  border: 1px solid #E4E7EC;
  border-radius: 8px;
  background: #fff;
  color: #475569;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all .14s;
  white-space: nowrap;
  font-family: inherit;
}

.tt-btn:hover:not(:disabled) { background: #F8FAFC; border-color: #C9D3DD; color: #1E2532; }
.tt-btn:disabled { opacity: .38; cursor: not-allowed; }

.tt-btn--paint-off { color: #475569; }
.tt-btn--paint-on  { background: #EEF2FF; border-color: #818CF8; color: #4338CA; }

.tt-paint-pulse {
  position: absolute;
  top: 6px;
  right: 7px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #6366F1;
  animation: ttPaintPulse 1.2s ease-in-out infinite;
}

.tt-btn--icon {
  padding: 6px 9px;
}

.tt-btn--danger {
  background: #FEF2F2;
  border-color: #FECACA;
  color: #DC2626;
}

.tt-btn--danger:hover:not(:disabled) { background: #FEE2E2; border-color: #FCA5A5; }

.tt-btn--primary {
  background: #4F46E5;
  border-color: #4F46E5;
  color: #fff;
  justify-content: center;
}

.tt-btn--primary:hover:not(:disabled) {
  background: #4338CA;
  border-color: #4338CA;
  color: #fff;
}

.tt-btn-group {
  display: flex;
  border: 1px solid #E4E7EC;
  border-radius: 8px;
  overflow: hidden;
}

.tt-btn-group .tt-btn {
  border-radius: 0;
  border: none;
  border-right: 1px solid #E4E7EC;
}

.tt-btn-group .tt-btn:last-child { border-right: none; }

.tt-saving {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: #94A3B8;
  padding: 5px 9px;
  background: #F8FAFC;
  border-radius: 7px;
  border: 1px solid #E4E7EC;
}

.tt-saving-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #94A3B8;
  animation: ttPaintPulse 1s ease-in-out infinite;
}

/* ─── Body ───────────────────────────────────────────────────────────────── */
.tt-body {
  display: flex;
  gap: 12px;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  padding: 14px 16px;
}

/* ─── Left panel ─────────────────────────────────────────────────────────── */
.tt-left {
  width: 200px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 7px;
  overflow-y: auto;
  padding-right: 2px;
}

.tt-panel-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 10px;
  font-weight: 700;
  color: #94A3B8;
  text-transform: uppercase;
  letter-spacing: .08em;
  padding: 2px 0;
}

.tt-badge {
  background: #F1F5F9;
  color: #64748B;
  border-radius: 99px;
  padding: 1px 6px;
  font-size: 9px;
  font-weight: 700;
}

.tt-subject-list {
  display: flex;
  flex-direction: column;
  gap: 5px;
  flex: 1;
}

/* Subject card */
.tt-subject-card {
  display: flex;
  align-items: stretch;
  border-radius: 10px;
  border: 1.5px solid #E8EBEF;
  background: #fff;
  cursor: grab;
  overflow: hidden;
  transition: border-color .12s, transform .1s, box-shadow .12s;
  box-shadow: 0 1px 2px rgba(30,37,50,.04);
  user-select: none;
}

.tt-subject-card:hover {
  border-color: var(--sc);
  box-shadow: 0 3px 8px rgba(30,37,50,.08);
  transform: translateY(-1px);
}

.tt-subject-card--active {
  background: var(--sc-bg);
  border-color: var(--sc);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--sc) 30%, transparent);
  transform: translateY(-1px);
}

.sc-stripe {
  width: 4px;
  background: var(--sc);
  flex-shrink: 0;
}

.sc-body {
  flex: 1;
  padding: 8px 10px;
  min-width: 0;
}

.sc-code {
  font-size: 12px;
  font-weight: 700;
  color: #1E2532;
  font-family: 'SF Mono', 'Fira Mono', monospace;
  letter-spacing: .01em;
}

.tt-subject-card--active .sc-code { color: var(--sc-text); }

.sc-name {
  font-size: 10px;
  color: #64748B;
  margin-top: 2px;
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sc-class {
  font-size: 9px;
  color: #94A3B8;
  margin-top: 3px;
}

.sc-count {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 10px;
  font-size: 13px;
  font-weight: 700;
  color: #D1D5DB;
  min-width: 30px;
}

.tt-empty-list {
  font-size: 11px;
  color: #94A3B8;
  text-align: center;
  padding: 14px 0;
}

.tt-active-hint {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  padding: 9px 11px;
  background: var(--hint-bg, #EEF2FF);
  border: 1px solid var(--hint-border, #C7D2FE);
  border-radius: 9px;
  font-size: 11px;
  color: var(--hint-text, #4338CA);
  line-height: 1.5;
  margin-top: 2px;
  flex-shrink: 0;
}

.tt-active-hint svg { margin-top: 1px; flex-shrink: 0; }

/* ─── Center ─────────────────────────────────────────────────────────────── */
.tt-center {
  flex: 1;
  min-width: 0;
  overflow: auto;
  cursor: default;
}

.tt-center--paint { cursor: crosshair; }

.tt-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 10px;
  text-align: center;
  color: #94A3B8;
}

.tt-empty-icon { width: 64px; height: 64px; margin-bottom: 4px; }
.tt-empty-title { font-size: 15px; font-weight: 600; color: #475569; margin: 0; }
.tt-empty-sub   { font-size: 12px; margin: 0; max-width: 260px; line-height: 1.6; }

.tt-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 10px;
  color: #94A3B8;
  font-size: 12px;
}

/* ─── Grid ───────────────────────────────────────────────────────────────── */
.tt-grid-wrapper { min-width: 440px; }

.tt-grid-head,
.tt-grid-row {
  display: grid;
  grid-template-columns: 78px repeat(5, 1fr);
  gap: 5px;
  margin-bottom: 5px;
}

.tt-corner { /* empty corner cell */ }

.tt-period-head {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 6px 4px;
  background: #fff;
  border: 1px solid #E8EBEF;
  border-radius: 8px;
  gap: 2px;
}

.ph-num  { font-size: 10px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: .05em; }
.ph-time { font-size: 9px; color: #94A3B8; font-family: 'SF Mono', 'Fira Mono', monospace; }

.tt-day-label {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #fff;
  border: 1px solid #E8EBEF;
  border-radius: 9px;
  height: 84px;
  gap: 1px;
}

.dl-short { font-size: 13px; font-weight: 700; color: #334155; }
.dl-full  { font-size: 8px; color: #94A3B8; letter-spacing: .04em; text-transform: uppercase; }

/* ─── Cell ───────────────────────────────────────────────────────────────── */
.tt-cell {
  position: relative;
  height: 84px;
  background: var(--cb, #FAFAFA);
  border: 2px solid var(--cbr, #E4E7EC);
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  user-select: none;
  overflow: hidden;
  transition: transform .1s ease, box-shadow .1s ease;
}

.tt-cell:hover { transform: scale(1.025); }

.tt-cell--selected {
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--csel, #818CF8) 30%, transparent);
}

.tt-cell--drag-over { border-style: dashed; }

.tt-cell--pop { animation: ttPop .28s ease; }

/* Colored top bar on filled cells */
.cell-top-bar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  border-radius: 8px 8px 0 0;
  opacity: .8;
}

.cell-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 0 5px;
  width: 100%;
}

.cell-code {
  font-size: 13px;
  font-weight: 800;
  color: var(--ct, #374151);
  font-family: 'SF Mono', 'Fira Mono', monospace;
  letter-spacing: .03em;
}

.cell-class {
  font-size: 9px;
  color: #6B7280;
  text-align: center;
  line-height: 1.2;
}

.cell-room {
  font-size: 8px;
  color: #9CA3AF;
  margin-top: 1px;
}

.cell-plus {
  font-size: 20px;
  color: #D1D5DB;
  font-weight: 300;
  transition: all .1s;
  line-height: 1;
}

.tt-cell--drag-over .cell-plus { color: #818CF8; font-size: 22px; }

.cell-conflict-dot {
  position: absolute;
  top: 5px;
  right: 5px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #EF4444;
  animation: ttPulse 1.4s ease-in-out infinite;
}

/* ─── Credits ────────────────────────────────────────────────────────────── */
.tt-credits {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
  padding: 9px 12px;
  background: #fff;
  border: 1px solid #E8EBEF;
  border-radius: 9px;
  flex-wrap: wrap;
}

.credits-label {
  font-size: 10px;
  font-weight: 700;
  color: #94A3B8;
  text-transform: uppercase;
  letter-spacing: .07em;
  white-space: nowrap;
}

.credits-chips { display: flex; flex-wrap: wrap; gap: 5px; }

.credit-chip {
  display: inline-flex;
  align-items: center;
  padding: 3px 9px;
  border-radius: 99px;
  background: var(--chip-bg);
  border: 1px solid var(--chip-border);
  font-size: 10px;
  color: var(--chip-text);
  font-weight: 500;
}

/* ─── Right panel ────────────────────────────────────────────────────────── */
.tt-right {
  width: 224px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow-y: auto;
  padding-left: 2px;
}

/* Teacher card */
.tt-teacher-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 13px;
  background: #fff;
  border: 1px solid #E8EBEF;
  border-radius: 12px;
  box-shadow: 0 1px 2px rgba(30,37,50,.04);
  flex-shrink: 0;
}

.teacher-avatar {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: linear-gradient(135deg, #818CF8 0%, #6366F1 100%);
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: .5px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 2px 6px rgba(99,102,241,.35);
}

.teacher-name  { font-size: 13px; font-weight: 700; color: #1E2532; }
.teacher-dept  { font-size: 11px; color: #64748B; margin-top: 1px; }
.teacher-slots { font-size: 10px; color: #94A3B8; margin-top: 5px; }

/* Cell detail */
.tt-cell-detail {
  padding: 13px;
  background: #fff;
  border: 1px solid #E8EBEF;
  border-radius: 12px;
  flex: 1;
  min-height: 0;
}

.cd-chips {
  display: flex;
  gap: 5px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}

.cd-chip {
  padding: 3px 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
}

.cd-chip--day    { background: #EEF2FF; color: #4F46E5; }
.cd-chip--period { background: #F1F5F9; color: #475569; }
.cd-chip--time   { background: #F8FAFC; color: #94A3B8; font-family: 'SF Mono','Fira Mono',monospace; font-size: 10px; }

.cd-subject { font-size: 14px; font-weight: 700; color: #1E2532; line-height: 1.3; }
.cd-class   { font-size: 11px; color: #64748B; margin-top: 3px; }

.cd-section { margin-top: 14px; }

.cd-label {
  display: block;
  font-size: 10px;
  font-weight: 700;
  color: #94A3B8;
  text-transform: uppercase;
  letter-spacing: .07em;
  margin-bottom: 6px;
}

.tt-remove-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin-top: 13px;
  width: 100%;
  padding: 8px 0;
  border-radius: 8px;
  border: 1px solid #FECACA;
  background: #FEF2F2;
  color: #DC2626;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all .14s;
  font-family: inherit;
}

.tt-remove-btn:hover:not(:disabled) { background: #FEE2E2; border-color: #FCA5A5; }
.tt-remove-btn:disabled { opacity: .5; cursor: not-allowed; }

.cd-empty {
  font-size: 12px;
  color: #94A3B8;
  line-height: 1.65;
  margin-top: 4px;
}

.tt-detail-placeholder {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px 16px;
  background: #FAFAFA;
  border: 1.5px dashed #E4E7EC;
  border-radius: 12px;
  color: #CBD5E1;
  font-size: 12px;
  text-align: center;
  gap: 10px;
  line-height: 1.6;
}

.dp-icon { width: 40px; height: 40px; }

/* Conflicts */
.tt-conflicts {
  padding: 10px 12px;
  background: #FEF2F2;
  border: 1px solid #FECACA;
  border-radius: 10px;
  flex-shrink: 0;
}

.conflicts-head {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 10px;
  font-weight: 700;
  color: #991B1B;
  text-transform: uppercase;
  letter-spacing: .07em;
  margin-bottom: 7px;
}

.conflict-item {
  font-size: 10px;
  color: #DC2626;
  margin-bottom: 4px;
  line-height: 1.45;
}

/* ─── Toast ──────────────────────────────────────────────────────────────── */
.tt-toast-wrap {
  position: fixed;
  bottom: 22px;
  right: 22px;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 7px;
  pointer-events: none;
}

.tt-toast {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 14px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 500;
  box-shadow: 0 4px 18px rgba(0,0,0,.13);
  animation: ttSlide .2s ease;
  max-width: 300px;
  border-width: 1px;
  border-style: solid;
}

.tt-toast-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}

.tt-toast--success { background:#ECFDF5; color:#065F46; border-color:#A7F3D0; }
.tt-toast--success .tt-toast-dot { background:#10B981; }
.tt-toast--error   { background:#FEF2F2; color:#991B1B; border-color:#FECACA; }
.tt-toast--error   .tt-toast-dot { background:#EF4444; }
.tt-toast--warn    { background:#FFFBEB; color:#92400E; border-color:#FDE68A; }
.tt-toast--warn    .tt-toast-dot { background:#F59E0B; }

/* ─── Scrollbars ─────────────────────────────────────────────────────────── */
.tt-left::-webkit-scrollbar,
.tt-right::-webkit-scrollbar,
.tt-center::-webkit-scrollbar { width: 5px; height: 5px; }
.tt-left::-webkit-scrollbar-track,
.tt-right::-webkit-scrollbar-track,
.tt-center::-webkit-scrollbar-track { background: transparent; }
.tt-left::-webkit-scrollbar-thumb,
.tt-right::-webkit-scrollbar-thumb,
.tt-center::-webkit-scrollbar-thumb { background: #E2E8F0; border-radius: 99px; }

/* ─── Mobile / Tablet Optimizations ─────────────────────────────────────── */
@media (max-width: 1024px) {
  .tt-header {
    padding: 10px;
    gap: 10px;
  }
  .tt-brand {
    width: 100%;
  }
  .tt-controls {
    align-items: stretch;
    width: 100%;
  }
  .tt-search-row,
  .tt-action-row {
    flex-wrap: wrap;
    width: 100%;
    gap: 6px;
  }
  .tt-search-row > *,
  .tt-action-row > * {
    flex: 1 1 auto;
    min-width: 120px;
  }
  .tt-btn-group {
    display: flex;
    width: 100%;
  }
  .tt-btn-group .tt-btn {
    flex: 1;
    justify-content: center;
  }
  .tt-body {
    flex-direction: column;
    overflow: visible;
    height: auto;
    padding: 10px;
    gap: 12px;
  }
  .tt-left {
    width: 100%;
    max-height: 250px;
    padding-right: 0;
    border-bottom: 1px solid #E4E7EC;
    padding-bottom: 10px;
  }
  .tt-subject-list {
    flex-direction: row;
    overflow-x: auto;
    gap: 8px;
    padding-bottom: 8px;
  }
  .tt-subject-card {
    flex: 0 0 150px;
  }
  .tt-center {
    width: 100%;
    overflow-x: auto;
    border: 1px solid #E4E7EC;
    border-radius: 12px;
    background: #fff;
    padding: 8px;
  }
  .tt-right {
    width: 100%;
    padding-left: 0;
    overflow-y: visible;
  }
}
`