import { useEffect, useState } from 'react'
import { creditsApi } from '../../api/services'
import { Spinner, CreditChip, EmptyState, Modal, ErrorAlert } from '../../components/ui'

export default function AdminCredits() {
  const [report, setReport] = useState([])
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ teacher_id: '', change: '', reason: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const loadData = () => {
    Promise.all([creditsApi.report(), creditsApi.allTransactions()])
      .then(([r, t]) => {
        setReport(r.data)
        setTransactions(t.data)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleAdjust = async (e) => {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      await creditsApi.adjust({
        teacher_id: Number(form.teacher_id),
        change: Number(form.change),
        reason: form.reason,
      })
      setModalOpen(false)
      setForm({ teacher_id: '', change: '', reason: '' })
      loadData()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to adjust credits.')
    } finally {
      setSaving(false)
    }
  }

  const teacherName = (id) => {
    const found = report.find(r => r.teacher_id === id)
    return found ? found.name : `#${id}`
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Credits & Reports</h1>
        <button
          onClick={() => setModalOpen(true)}
          className="btn-primary text-sm"
        >
          + Adjust Credits
        </button>
      </div>

      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-800">Credit Balances</h2>
        </div>
        {report.length === 0 ? <EmptyState message="No credit data yet." /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Teacher', 'Department', 'Balance'].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {report.slice().sort((a, b) => b.balance - a.balance).map(r => (
                <tr key={r.teacher_id} className="hover:bg-gray-50/50">
                  <td className="px-5 py-3 font-medium text-gray-800">{r.name}</td>
                  <td className="px-5 py-3 text-gray-500">{r.department || '—'}</td>
                  <td className="px-5 py-3"><CreditChip value={r.balance} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-800">All Transactions</h2>
        </div>
        {transactions.length === 0 ? <EmptyState message="No transactions yet." /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Teacher', 'Change', 'Reason', 'Date'].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {transactions.map(tx => (
                <tr key={tx.id} className="hover:bg-gray-50/50">
                  <td className="px-5 py-3 font-medium text-gray-800">{teacherName(tx.teacher_id)}</td>
                  <td className="px-5 py-3"><CreditChip value={tx.change} /></td>
                  <td className="px-5 py-3 text-gray-600 max-w-xs truncate">{tx.reason}</td>
                  <td className="px-5 py-3 text-gray-400 text-xs">{new Date(tx.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Manual Credit Adjustment">
        <form onSubmit={handleAdjust} className="space-y-4">
          <ErrorAlert message={error} />
          
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Select Teacher</label>
            <select
              required
              className="input w-full"
              value={form.teacher_id}
              onChange={e => setForm({ ...form, teacher_id: e.target.value })}
            >
              <option value="">Choose teacher…</option>
              {report.map(t => (
                <option key={t.teacher_id} value={t.teacher_id}>
                  {t.name} ({t.department || 'Faculty'}) — Balance: {t.balance}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Adjustment Value</label>
            <input
              type="number"
              required
              placeholder="e.g. 1 to add, -1 to deduct"
              className="input w-full"
              value={form.change}
              onChange={e => setForm({ ...form, change: e.target.value })}
            />
            <p className="text-[10px] text-gray-400 mt-1">Enter a positive integer to credit, or negative to deduct.</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Reason for Adjustment</label>
            <textarea
              required
              placeholder="e.g., Manual correction for exam duty cover"
              className="input w-full h-20 py-2 resize-none"
              value={form.reason}
              onChange={e => setForm({ ...form, reason: e.target.value })}
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="btn-secondary flex-1"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn-primary flex-1"
            >
              {saving ? 'Saving…' : 'Apply Adjustment'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
