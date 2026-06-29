import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../../context/AuthContext'
import { substitutionsApi, leavesApi, classesApi } from '../../api/services'
import { Spinner, Modal, EmptyState, AssignmentTypeBadge, ErrorAlert } from '../../components/ui'
import {
  SwapIcon, UndoIcon, LockIcon, SearchIcon, SparklesIcon, AlertTriangleIcon
} from '../../components/icons'

function RecommendationRow({ rec, onAssign, disabled }) {
  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-gray-800 truncate">{rec.teacher.name}</p>
          <span className="text-xs font-semibold text-gray-500 shrink-0">{rec.score}% match</span>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <div className="w-20 h-1.5 rounded-full bg-gray-100 overflow-hidden shrink-0">
            <div className={`h-full ${rec.score >= 75 ? 'bg-green-500' : rec.score >= 45 ? 'bg-yellow-500' : 'bg-gray-400'}`} style={{ width: `${Math.min(rec.score, 100)}%` }} />
          </div>
          <p className="text-xs text-gray-400 truncate">{rec.reasons.join(' · ') || 'No strong signals'}</p>
        </div>
      </div>
      <button
        onClick={() => onAssign(rec.teacher.id)}
        disabled={disabled}
        className="text-xs px-3 py-1.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 shrink-0 font-medium"
      >
        Assign
      </button>
    </div>
  )
}

export default function TodaySubstitutions() {
  const { user, isAdmin } = useAuth()

  // State
  const [loading, setLoading] = useState(true)
  const [subData, setSubData] = useState({ date: '', day_order: '', day_type: '', summary: {}, substitutions: [] })
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0])
  const [classes, setClasses] = useState([])
  const [error, setError] = useState('')

  // Filters
  const [searchTeacher, setSearchTeacher] = useState('')
  const [selectedClass, setSelectedClass] = useState('')
  const [selectedPeriod, setSelectedPeriod] = useState('')
  const [selectedSource, setSelectedSource] = useState('')
  const [showMyOnly, setShowMyOnly] = useState(false)

  // Admin Modals
  const [assignModal, setAssignModal] = useState(null)
  const [overrideModal, setOverrideModal] = useState(null)
  const [actionLoading, setActionLoading] = useState(null)

  // Fetch substitutions
  const loadDashboard = async (dateStr) => {
    setError('')
    try {
      const res = await substitutionsApi.getToday(dateStr)
      setSubData(res.data)
      if (res.data.date) {
        setSelectedDate(res.data.date)
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to fetch substitutions.')
    } finally {
      setLoading(false)
    }
  }

  // Load initial settings and classes
  const loadMasterData = async () => {
    try {
      const res = await classesApi.list()
      setClasses(res.data)
    } catch (err) {
      console.error('Failed to load classes list:', err)
    }
  }

  useEffect(() => {
    loadMasterData()
    loadDashboard(selectedDate)
  }, [])

  const handleDateChange = (e) => {
    setLoading(true)
    const newDate = e.target.value
    setSelectedDate(newDate)
    loadDashboard(newDate)
  }

  // Admin Substitution Action Handlers
  const handleAssignRecommended = async (teacherId) => {
    setActionLoading('assign')
    try {
      await leavesApi.assignRecommended(assignModal.leaveId, teacherId)
      setAssignModal(null)
      loadDashboard(selectedDate)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to assign recommended substitute.')
    } finally {
      setActionLoading(null)
    }
  }

  const handleAssignManual = async (teacherId) => {
    setActionLoading('assign')
    try {
      await leavesApi.assignSubstitute(assignModal.leaveId, teacherId)
      setAssignModal(null)
      loadDashboard(selectedDate)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to assign substitute.')
    } finally {
      setActionLoading(null)
    }
  }

  const handleOverride = async (teacherId) => {
    setActionLoading('override')
    try {
      await leavesApi.overrideSubstitute(overrideModal.leaveId, teacherId)
      setOverrideModal(null)
      loadDashboard(selectedDate)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to change substitute.')
    } finally {
      setActionLoading(null)
    }
  }

  const handleUndo = async (leaveId) => {
    setActionLoading(leaveId + '_undo')
    try {
      await leavesApi.undoAssignment(leaveId)
      loadDashboard(selectedDate)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to remove substitute.')
    } finally {
      setActionLoading(null)
    }
  }

  const openAssignModal = async (sub) => {
    setActionLoading(sub.leave_id + '_open_assign')
    try {
      // Simulate leave request structure for the modal
      const leaveObj = {
        id: sub.leave_id,
        date: selectedDate,
        day_order: subData.day_order?.replace('DO', '') || '1',
        period_number: sub.period_number,
        teacher: sub.original_teacher
      }
      const [{ data: recommendations }, { data: freeTeachers }] = await Promise.all([
        leavesApi.recommendations(sub.leave_id),
        leavesApi.freeTeachers(sub.leave_id),
      ])
      const recommendedIds = new Set(recommendations.map(r => r.teacher.id))
      const others = freeTeachers.filter(t => !recommendedIds.has(t.id))
      setAssignModal({ leaveId: sub.leave_id, leave: leaveObj, recommendations, others })
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load candidates.')
    } finally {
      setActionLoading(null)
    }
  }

  const openOverrideModal = async (sub) => {
    setActionLoading(sub.leave_id + '_open_override')
    try {
      const leaveObj = {
        id: sub.leave_id,
        date: selectedDate,
        day_order: subData.day_order?.replace('DO', '') || '1',
        period_number: sub.period_number,
        alter_assignment: {
          substitute: sub.substitute_teacher,
          substitute_teacher_id: sub.substitute_teacher?.id
        }
      }
      const { data: recommendations } = await leavesApi.recommendations(sub.leave_id)
      setOverrideModal({ leaveId: sub.leave_id, leave: leaveObj, recommendations })
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load override candidates.')
    } finally {
      setActionLoading(null)
    }
  }

  // Filtered List
  const filteredSubstitutions = useMemo(() => {
    if (!subData.substitutions) return []
    return subData.substitutions.filter(sub => {
      // 1. Search Teacher
      if (searchTeacher.trim()) {
        const query = searchTeacher.toLowerCase()
        const matchOrig = sub.original_teacher.name.toLowerCase().includes(query)
        const matchSub = sub.substitute_teacher ? sub.substitute_teacher.name.toLowerCase().includes(query) : false
        if (!matchOrig && !matchSub) return false
      }

      // 2. Class Section
      if (selectedClass && sub.class_name !== selectedClass) return false

      // 3. Period
      if (selectedPeriod && String(sub.period_number) !== selectedPeriod) return false

      // 4. Source
      if (selectedSource) {
        if (selectedSource === 'Unassigned') {
          if (sub.substitute_teacher !== null) return false
        } else {
          // Map to match internal enum label strings or display labels
          const sourceMap = {
            auto_assigned: 'Autonomous',
            faculty_recommended: 'Assisted',
            admin_assigned: 'Manual',
            teacher_assigned: 'Teacher Assigned',
            overridden: 'Manual',
            auto_swapped: 'Autonomous',
            emergency: 'Emergency'
          }
          const actualSource = sourceMap[sub.assignment_type] || 'Unassigned'
          if (actualSource !== selectedSource) return false
        }
      }

      // 5. My Coverage (For Teachers)
      if (!isAdmin && showMyOnly && user) {
        const isMine = sub.original_teacher.id === user.id || (sub.substitute_teacher && sub.substitute_teacher.id === user.id)
        if (!isMine) return false
      }

      return true
    })
  }, [subData.substitutions, searchTeacher, selectedClass, selectedPeriod, selectedSource, showMyOnly, isAdmin, user])

  // Export CSV
  const handleExportCSV = () => {
    const headers = ['Period', 'Class Section', 'Original Teacher', 'Substitute Teacher', 'Source', 'Reason']
    const rows = filteredSubstitutions.map(sub => [
      `Period ${sub.period_number}`,
      sub.class_name,
      sub.original_teacher.name,
      sub.substitute_teacher ? sub.substitute_teacher.name : 'Unassigned',
      sub.substitute_teacher ? (sub.assignment_type === 'auto_assigned' ? 'Autonomous' : sub.assignment_type === 'faculty_recommended' ? 'Assisted' : sub.assignment_type === 'teacher_assigned' ? 'Teacher Assigned' : 'Manual') : 'Unassigned',
      sub.reason
    ])

    const csvContent = "\uFEFF" + [headers.join(','), ...rows.map(e => e.map(val => `"${val.replace(/"/g, '""')}"`).join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.setAttribute("href", url)
    link.setAttribute("download", `substitutions_report_${selectedDate}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Print Page
  const handlePrint = () => {
    window.print()
  }

  if (loading) {
    return <div className="flex justify-center py-20"><Spinner size="lg" /></div>
  }

  const { summary } = subData

  return (
    <div className="space-y-6">
      {/* Custom print styling */}
      <style>{`
        @media print {
          body {
            background: white !important;
            color: black !important;
          }
          aside, nav, header, button, .filter-bar, .no-print {
            display: none !important;
          }
          .print-header {
            display: block !important;
            margin-bottom: 20px;
          }
          .card {
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          table {
            width: 100% !important;
            border-collapse: collapse !important;
          }
          th, td {
            border: 1px solid #CBD5E1 !important;
            padding: 8px !important;
            color: black !important;
            font-size: 11px !important;
          }
          .print-only-badge {
            font-size: 9px !important;
            border: 1px solid #64748B !important;
            border-radius: 4px !important;
            padding: 2px 4px !important;
          }
        }
      `}</style>

      {/* Print only header */}
      <div className="hidden print-header">
        <h1 className="text-xl font-bold text-black">Coverage & Substitutions Report</h1>
        <p className="text-xs text-gray-600 mt-1">
          Date: <span className="font-semibold">{selectedDate}</span> &nbsp;·&nbsp; Day Order: <span className="font-semibold">{subData.day_order || 'N/A'}</span>
        </p>
      </div>

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 no-print">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{isAdmin ? "Today's Substitutions" : "Today's Coverage"}</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Operational dashboard of all coverage arrangements for {selectedDate}
          </p>
        </div>

        {/* Date Display Badge & Actions */}
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-100 rounded-lg text-xs font-semibold text-gray-700">
            <span>Date: {selectedDate}</span>
            <span className="text-gray-300">|</span>
            <span className="text-primary-600">{subData.day_order || 'No Day Order'}</span>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handlePrint}
              className="px-3 py-2 border border-gray-200 text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 rounded-lg transition-colors"
            >
              Print
            </button>
            <button
              onClick={handlePrint}
              className="px-3 py-2 border border-gray-200 text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 rounded-lg transition-colors"
            >
              Export PDF
            </button>
            <button
              onClick={handleExportCSV}
              className="px-3 py-2 bg-primary-600 text-white text-xs font-semibold hover:bg-primary-700 rounded-lg transition-colors"
            >
              Export Excel (CSV)
            </button>
          </div>
        </div>
      </div>

      <ErrorAlert message={error} />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 no-print">
        <div className="card p-5 space-y-1 bg-white">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Total Leaves Today</p>
          <p className="text-2xl font-bold text-gray-800">{summary.total_leaves}</p>
          <p className="text-[10px] text-gray-400">Approved leave requests</p>
        </div>

        <div className="card p-5 space-y-1 bg-white">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Covered Periods</p>
          <p className="text-2xl font-bold text-green-600">{summary.total_substitutions}</p>
          <p className="text-[10px] text-gray-400">Substitutes successfully assigned</p>
        </div>

        <div className="card p-5 space-y-1 bg-white">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Unassigned Periods</p>
          <p className={`text-2xl font-bold ${summary.unassigned_periods > 0 ? 'text-amber-500' : 'text-gray-800'}`}>
            {summary.unassigned_periods}
          </p>
          <p className="text-[10px] text-gray-400">Slots still requiring coverage</p>
        </div>

        <div className="card p-5 space-y-1 bg-white">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Coverage Rate</p>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-bold text-primary-600">{summary.coverage_percentage}%</p>
          </div>
          <div className="w-full bg-gray-100 h-1 rounded-full mt-2 overflow-hidden">
            <div className="bg-primary-600 h-full transition-all duration-300" style={{ width: `${summary.coverage_percentage}%` }} />
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="card p-4 space-y-3 bg-white no-print filter-bar">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          {/* Date Picker */}
          <div>
            <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Date</label>
            <input
              type="date"
              className="tt-input w-full py-1.5 text-xs"
              value={selectedDate}
              onChange={handleDateChange}
            />
          </div>

          {/* Teacher Search */}
          <div>
            <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Teacher</label>
            <div className="relative flex items-center">
              <SearchIcon className="absolute left-2.5 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              <input
                className="tt-input w-full py-1.5 pl-8 text-xs"
                placeholder="Search name…"
                value={searchTeacher}
                onChange={e => setSearchTeacher(e.target.value)}
              />
            </div>
          </div>

          {/* Class Section Filter */}
          <div>
            <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Class Section</label>
            <select
              className="tt-select w-full py-1.5 text-xs"
              value={selectedClass}
              onChange={e => setSelectedClass(e.target.value)}
            >
              <option value="">All Classes</option>
              {classes.map(c => (
                <option key={c.id} value={`${c.name} - ${c.section}`}>{c.name} - {c.section}</option>
              ))}
            </select>
          </div>

          {/* Period Filter */}
          <div>
            <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Period</label>
            <select
              className="tt-select w-full py-1.5 text-xs"
              value={selectedPeriod}
              onChange={e => setSelectedPeriod(e.target.value)}
            >
              <option value="">All Periods</option>
              {[1, 2, 3, 4, 5].map(p => (
                <option key={p} value={String(p)}>Period {p}</option>
              ))}
            </select>
          </div>

          {/* Source Filter */}
          <div>
            <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Source</label>
            <select
              className="tt-select w-full py-1.5 text-xs"
              value={selectedSource}
              onChange={e => setSelectedSource(e.target.value)}
            >
              <option value="">All Sources</option>
              <option value="Autonomous">Autonomous</option>
              <option value="Assisted">Assisted</option>
              <option value="Manual">Manual</option>
              <option value="Teacher Assigned">Teacher Assigned</option>
              <option value="Unassigned">Unassigned</option>
            </select>
          </div>
        </div>

        {/* My Coverage Switcher (Teachers only) */}
        {!isAdmin && (
          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="my-coverage-check"
              checked={showMyOnly}
              onChange={e => setShowMyOnly(e.target.checked)}
              className="rounded text-primary-600 focus:ring-primary-500 w-3.5 h-3.5 border-gray-300"
            />
            <label htmlFor="my-coverage-check" className="text-xs font-medium text-gray-600 cursor-pointer">
              Show only my coverage duties / leaves
            </label>
          </div>
        )}
      </div>

      {/* Main Table Card */}
      <div className="card overflow-hidden bg-white">
        {filteredSubstitutions.length === 0 ? (
          <EmptyState message="No substitution records found for the selected filters." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Period', 'Class Section', 'Original Teacher', 'Substitute Teacher', 'Source', ''].map((h, i) => (
                  <th
                    key={h}
                    className={`px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider ${
                      i === 5 ? 'no-print' : ''
                    }`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredSubstitutions.map(sub => {
                const isUnassigned = !sub.substitute_teacher
                return (
                  <tr key={sub.leave_id} className="hover:bg-gray-50/50">
                    <td className="px-5 py-3 text-gray-800 font-medium font-mono">P{sub.period_number}</td>
                    <td className="px-5 py-3 text-gray-800 font-semibold">{sub.class_name}</td>
                    <td className="px-5 py-3 text-gray-600">
                      <div>
                        <p className="text-sm font-medium text-gray-800">{sub.original_teacher.name}</p>
                        <p className="text-[10px] text-gray-400">{sub.original_teacher.department || 'No department'}</p>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      {isUnassigned ? (
                        <div className="flex items-center gap-1.5 text-amber-500 font-medium text-xs">
                          <AlertTriangleIcon className="w-3.5 h-3.5 shrink-0" />
                          Needs Coverage
                        </div>
                      ) : (
                        <p className="text-sm font-medium text-gray-800">{sub.substitute_teacher.name}</p>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {/* Interactive badges for screen, print-only fallback classes for paper */}
                      <span className="no-print">
                        {isUnassigned ? (
                          <span className="inline-flex items-center rounded-full font-medium bg-gray-100 text-gray-400 px-1.5 py-0.5 text-[10px]">Unassigned</span>
                        ) : (
                          <AssignmentTypeBadge type={sub.assignment_type} small />
                        )}
                      </span>
                      <span className="hidden print-only-badge">
                        {isUnassigned ? 'Unassigned' : sub.assignment_type?.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right no-print">
                      {isAdmin && (
                        <div className="flex items-center justify-end gap-2">
                          {isUnassigned ? (
                            <button
                              onClick={() => openAssignModal(sub)}
                              disabled={actionLoading !== null}
                              className="px-2 py-1 text-[10px] bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded transition-colors"
                            >
                              Assign
                            </button>
                          ) : (
                            <>
                              <button
                                onClick={() => openOverrideModal(sub)}
                                disabled={actionLoading !== null}
                                className="px-2 py-1 text-[10px] border border-gray-200 hover:border-primary-300 text-gray-600 rounded transition-colors font-medium"
                              >
                                Change
                              </button>
                              <button
                                onClick={() => handleUndo(sub.leave_id)}
                                disabled={actionLoading === sub.leave_id + '_undo'}
                                className="px-2 py-1 text-[10px] border border-red-200 hover:bg-red-50 text-red-600 rounded transition-colors font-medium"
                              >
                                {actionLoading === sub.leave_id + '_undo' ? '…' : 'Remove'}
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {/* Assign Modal (Admin only) */}
      <Modal open={!!assignModal} onClose={() => setAssignModal(null)} title="Assign Substitute">
        {assignModal && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-3 text-sm">
              <p className="font-semibold text-gray-700">Original: {assignModal.leave.teacher?.name}</p>
              <p className="text-gray-500 text-xs mt-0.5">
                Day Order {assignModal.leave.day_order} · Period {assignModal.leave.period_number} · Reason: "{assignModal.leave.reason}"
              </p>
            </div>

            {assignModal.recommendations.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                  <SparklesIcon className="w-3.5 h-3.5 text-indigo-600" /> Recommended Candidates
                </p>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {assignModal.recommendations.map(rec => (
                    <RecommendationRow
                      key={rec.teacher.id}
                      rec={rec}
                      onAssign={handleAssignRecommended}
                      disabled={actionLoading !== null}
                    />
                  ))}
                </div>
              </div>
            )}

            {assignModal.others.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-gray-100">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Other Available Teachers</p>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {assignModal.others.map(t => (
                    <div key={t.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="text-sm font-medium text-gray-800">{t.name}</p>
                        <p className="text-xs text-gray-400">{t.department || 'No Department'}</p>
                      </div>
                      <button
                        onClick={() => handleAssignManual(t.id)}
                        disabled={actionLoading !== null}
                        className="text-xs px-3 py-1.5 bg-white border border-gray-200 text-gray-700 rounded-lg hover:border-primary-300 transition-colors disabled:opacity-50"
                      >
                        Assign
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {assignModal.recommendations.length === 0 && assignModal.others.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-6">No eligible teachers found for this period.</p>
            )}
          </div>
        )}
      </Modal>

      {/* Override Modal (Admin only) */}
      <Modal open={!!overrideModal} onClose={() => setOverrideModal(null)} title="Change Substitute Cover">
        {overrideModal && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-3 text-sm">
              <p className="font-semibold text-gray-700">Currently Covered By: {overrideModal.leave.alter_assignment?.substitute?.name}</p>
              <p className="text-gray-500 text-xs mt-0.5">Day Order {overrideModal.leave.day_order} · Period {overrideModal.leave.period_number}</p>
            </div>

            {overrideModal.recommendations.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-6">No other eligible teachers found for this period.</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {overrideModal.recommendations
                  .filter(r => r.teacher.id !== overrideModal.leave.alter_assignment?.substitute_teacher_id)
                  .map(rec => (
                    <RecommendationRow
                      key={rec.teacher.id}
                      rec={rec}
                      onAssign={handleOverride}
                      disabled={actionLoading !== null}
                    />
                  ))}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
