import { useEffect, useState } from 'react'
import { leavesApi } from '../../api/services'
import { Spinner, StatusBadge, EmptyState } from '../../components/ui'

export default function LeaveHistory() {
  const [leaves, setLeaves] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    leavesApi.myLeaves().then(r => setLeaves(r.data)).finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-900">Leave History</h1>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : leaves.length === 0 ? <EmptyState message="No leave requests yet." /> : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Date', 'Day Order', 'Period', 'Reason', 'Status', 'Submitted'].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {leaves.map(leave => (
                <tr key={leave.id} className="hover:bg-gray-50/50">
                  <td className="px-5 py-3 text-gray-800">{leave.date}</td>
                  <td className="px-5 py-3 text-gray-500">DO {leave.day_order}</td>
                  <td className="px-5 py-3 text-gray-500">P{leave.period_number}</td>
                  <td className="px-5 py-3 text-gray-600 max-w-xs truncate">{leave.reason}</td>
                  <td className="px-5 py-3"><StatusBadge status={leave.status} /></td>
                  <td className="px-5 py-3 text-gray-400 text-xs">{new Date(leave.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
