import { useEffect, useState } from 'react'
import { leavesApi } from '../../api/services'
import { Spinner, StatusBadge, Modal, EmptyState, AssignmentTypeBadge } from '../../components/ui'
import { SwapIcon, LockIcon, UnlockIcon, UndoIcon, SparklesIcon, AlertTriangleIcon } from '../../components/icons'

function ScoreBar({ score }) {
  const color = score >= 75 ? 'bg-green-500' : score >= 45 ? 'bg-yellow-500' : 'bg-gray-400'
  return (
    <div className="w-20 h-1.5 rounded-full bg-gray-100 overflow-hidden shrink-0">
      <div className={`h-full ${color}`} style={{ width: `${Math.min(score, 100)}%` }} />
    </div>
  )
}

function RecommendationRow({ rec, onAssign, disabled }) {
  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-gray-800 truncate">{rec.teacher.name}</p>
          <span className="text-xs font-semibold text-gray-500 shrink-0">{rec.score}% match</span>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <ScoreBar score={rec.score} />
          <p className="text-xs text-gray-400 truncate">{rec.reasons.join(' · ') || 'No strong signals'}</p>
        </div>
      </div>
      <button
        onClick={() => onAssign(rec.teacher.id)}
        disabled={disabled}
        className="text-xs px-3 py-1.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 shrink-0"
      >
        {disabled ? '…' : 'Assign'}
      </button>
    </div>
  )
}

export default function AdminLeaves() {
  const [leaves, setLeaves] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(new Set())
  const [assignModal, setAssignModal] = useState(null)
  const [overrideModal, setOverrideModal] = useState(null)
  const [actionLoading, setActionLoading] = useState(null)

  const load = () => leavesApi.all().then(r => setLeaves(r.data)).finally(() => setLoading(false))
  useEffect(() => { load() }, [])

  const pendingIds = leaves.filter(l => l.status === 'pending').map(l => l.id)

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    setSelected(prev => prev.size === pendingIds.length ? new Set() : new Set(pendingIds))
  }

  const handleApprove = async (leave) => {
    setActionLoading(leave.id + '_approve')
    try {
      const { data } = await leavesApi.approve(leave.id)
      // Autonomous mode may have already assigned a substitute as a side
      // effect of approval — only open the panel if one is still needed.
      if (!data.leave.alter_assignment) {
        await openAssignModal(data.leave)
      }
      load()
    } finally {
      setActionLoading(null)
    }
  }

  const handleReject = async (id) => {
    setActionLoading(id + '_reject')
    try { await leavesApi.reject(id); load() }
    finally { setActionLoading(null) }
  }

  const handleBulkApprove = async () => {
    setActionLoading('bulk')
    try {
      await leavesApi.bulkApprove([...selected])
      setSelected(new Set())
      load()
    } finally { setActionLoading(null) }
  }

  const handleBulkReject = async () => {
    setActionLoading('bulk')
    try {
      await leavesApi.bulkReject([...selected])
      setSelected(new Set())
      load()
    } finally { setActionLoading(null) }
  }

  const handleAssignRecommended = async (teacherId) => {
    setActionLoading('assign')
    try {
      await leavesApi.assignRecommended(assignModal.leave.id, teacherId)
      setAssignModal(null)
      load()
    } finally { setActionLoading(null) }
  }

  const handleAssignManual = async (teacherId) => {
    setActionLoading('assign')
    try {
      await leavesApi.assignSubstitute(assignModal.leave.id, teacherId)
      setAssignModal(null)
      load()
    } finally { setActionLoading(null) }
  }

  const openAssignModal = async (leave) => {
    const [{ data: recommendations }, { data: freeTeachers }] = await Promise.all([
      leavesApi.recommendations(leave.id),
      leavesApi.freeTeachers(leave.id),
    ])
    const recommendedIds = new Set(recommendations.map(r => r.teacher.id))
    const others = freeTeachers.filter(t => !recommendedIds.has(t.id))
    setAssignModal({ leave, recommendations, others })
  }

  const handleOverride = async (teacherId) => {
    setActionLoading('override')
    try {
      await leavesApi.overrideSubstitute(overrideModal.leave.id, teacherId)
      setOverrideModal(null)
      load()
    } finally { setActionLoading(null) }
  }

  const openOverrideModal = async (leave) => {
    const { data: recommendations } = await leavesApi.recommendations(leave.id)
    setOverrideModal({ leave, recommendations })
  }

  const handleUndo = async (leaveId) => {
    setActionLoading(leaveId + '_undo')
    try { await leavesApi.undoAssignment(leaveId); load() }
    finally { setActionLoading(null) }
  }

  const handleToggleLock = async (leave) => {
    const locked = !leave.alter_assignment.is_locked
    setActionLoading(leave.id + '_lock')
    try { await leavesApi.setLock(leave.id, locked); load() }
    finally { setActionLoading(null) }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Leave Requests</h1>
        {selected.size > 0 && (
          <div className="flex gap-2">
            <button onClick={handleBulkApprove} disabled={actionLoading === 'bulk'} className="text-xs px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
              Approve {selected.size} selected
            </button>
            <button onClick={handleBulkReject} disabled={actionLoading === 'bulk'} className="text-xs px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50">
              Reject {selected.size} selected
            </button>
          </div>
        )}
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : leaves.length === 0 ? <EmptyState message="No leave requests yet." /> : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-4 py-3 w-8">
                  {pendingIds.length > 0 && (
                    <input type="checkbox" checked={selected.size === pendingIds.length} onChange={toggleSelectAll} />
                  )}
                </th>
                {['Teacher', 'Date', 'Day Order', 'Period', 'Reason', 'Status', 'Substitute', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {leaves.map(leave => (
                <tr key={leave.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3">
                    {leave.status === 'pending' && (
                      <input type="checkbox" checked={selected.has(leave.id)} onChange={() => toggleSelect(leave.id)} />
                    )}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-800">{leave.teacher?.name}</td>
                  <td className="px-4 py-3 text-gray-500">{leave.date}</td>
                  <td className="px-4 py-3 text-gray-500">DO {leave.day_order}</td>
                  <td className="px-4 py-3 text-gray-500">P{leave.period_number}</td>
                  <td className="px-4 py-3 text-gray-500 max-w-xs truncate">
                    <div className="flex items-center gap-1.5">
                      {leave.is_emergency && <AlertTriangleIcon className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                      {leave.reason}
                    </div>
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={leave.status} /></td>
                  <td className="px-4 py-3">
                    {leave.alter_assignment ? (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-gray-700">{leave.alter_assignment.substitute?.name}</p>
                        <div className="flex items-center gap-1">
                          <AssignmentTypeBadge type={leave.alter_assignment.assignment_type} small />
                          {leave.alter_assignment.is_locked && <LockIcon className="w-3 h-3 text-gray-400" />}
                        </div>
                      </div>
                    ) : leave.status === 'approved' ? (
                      <span className="text-xs text-amber-600 font-medium">Needs substitute</span>
                    ) : (
                      <span className="text-xs text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 flex-wrap">
                      {leave.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleApprove(leave)}
                            disabled={!!actionLoading}
                            className="text-xs px-2.5 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                          >
                            {actionLoading === leave.id + '_approve' ? '…' : 'Approve'}
                          </button>
                          <button
                            onClick={() => handleReject(leave.id)}
                            disabled={!!actionLoading}
                            className="text-xs px-2.5 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                          >
                            {actionLoading === leave.id + '_reject' ? '…' : 'Reject'}
                          </button>
                        </>
                      )}
                      {leave.status === 'approved' && !leave.alter_assignment && (
                        <button
                          onClick={() => openAssignModal(leave)}
                          className="text-xs px-2.5 py-1 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                        >
                          Assign Sub
                        </button>
                      )}
                      {leave.status === 'approved' && leave.alter_assignment && (
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => openOverrideModal(leave)}
                            disabled={leave.alter_assignment.is_locked}
                            title={leave.alter_assignment.is_locked ? 'Unlock to swap' : 'Swap substitute'}
                            className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:text-primary-600 hover:border-primary-300 disabled:opacity-30"
                          >
                            <SwapIcon className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleUndo(leave.id)}
                            disabled={leave.alter_assignment.is_locked || actionLoading === leave.id + '_undo'}
                            title={leave.alter_assignment.is_locked ? 'Unlock to undo' : 'Undo assignment'}
                            className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:text-red-600 hover:border-red-300 disabled:opacity-30"
                          >
                            <UndoIcon className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleToggleLock(leave)}
                            disabled={actionLoading === leave.id + '_lock'}
                            title={leave.alter_assignment.is_locked ? 'Unlock' : 'Lock (protect from auto-changes)'}
                            className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:text-primary-600 hover:border-primary-300"
                          >
                            {leave.alter_assignment.is_locked ? <LockIcon className="w-3.5 h-3.5" /> : <UnlockIcon className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Assign substitute — ranked recommendations first, manual list below */}
      <Modal open={!!assignModal} onClose={() => setAssignModal(null)} title="Assign Substitute">
        {assignModal && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-3 text-sm">
              <p className="font-medium text-gray-700">{assignModal.leave.teacher?.name}</p>
              <p className="text-gray-500 text-xs mt-0.5">{assignModal.leave.date} · Day Order {assignModal.leave.day_order} · Period {assignModal.leave.period_number}</p>
            </div>

            {assignModal.recommendations.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <SparklesIcon className="w-3.5 h-3.5 text-primary-500" /> Recommended
                </p>
                <div className="space-y-2">
                  {assignModal.recommendations.map(rec => (
                    <RecommendationRow key={rec.teacher.id} rec={rec} onAssign={handleAssignRecommended} disabled={actionLoading === 'assign'} />
                  ))}
                </div>
              </div>
            )}

            {assignModal.others.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Other available teachers ({assignModal.others.length})
                </p>
                <div className="space-y-2">
                  {assignModal.others.map(t => (
                    <div key={t.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="text-sm font-medium text-gray-800">{t.name}</p>
                        <p className="text-xs text-gray-400">{t.department || 'No dept'}</p>
                      </div>
                      <button
                        onClick={() => handleAssignManual(t.id)}
                        disabled={actionLoading === 'assign'}
                        className="text-xs px-3 py-1.5 bg-white border border-gray-200 text-gray-700 rounded-lg hover:border-primary-300 transition-colors disabled:opacity-50"
                      >
                        {actionLoading === 'assign' ? '…' : 'Assign'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {assignModal.recommendations.length === 0 && assignModal.others.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">No eligible teachers for this period.</p>
            )}
          </div>
        )}
      </Modal>

      {/* Override — swap an existing assignment */}
      <Modal open={!!overrideModal} onClose={() => setOverrideModal(null)} title="Swap Substitute">
        {overrideModal && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-3 text-sm">
              <p className="font-medium text-gray-700">Currently: {overrideModal.leave.alter_assignment?.substitute?.name}</p>
              <p className="text-gray-500 text-xs mt-0.5">{overrideModal.leave.date} · Day Order {overrideModal.leave.day_order} · Period {overrideModal.leave.period_number}</p>
            </div>
            {overrideModal.recommendations.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No other eligible teachers for this period.</p>
            ) : (
              <div className="space-y-2">
                {overrideModal.recommendations
                  .filter(r => r.teacher.id !== overrideModal.leave.alter_assignment?.substitute_teacher_id)
                  .map(rec => (
                    <RecommendationRow key={rec.teacher.id} rec={rec} onAssign={handleOverride} disabled={actionLoading === 'override'} />
                  ))}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
