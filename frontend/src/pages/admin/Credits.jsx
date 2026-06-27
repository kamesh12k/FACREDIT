import { useEffect, useState } from 'react'
import { creditsApi } from '../../api/services'
import { Spinner, CreditChip, EmptyState } from '../../components/ui'

export default function AdminCredits() {
  const [report, setReport] = useState([])
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([creditsApi.report(), creditsApi.allTransactions()])
      .then(([r, t]) => { setReport(r.data); setTransactions(t.data) })
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-900">Credits & Reports</h1>

      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-800">Credit Balances</h2>
        </div>
        {report.length === 0 ? <EmptyState message="No credit data yet." /> : (
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
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-800">All Transactions</h2>
        </div>
        {transactions.length === 0 ? <EmptyState message="No transactions yet." /> : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Teacher ID', 'Change', 'Reason', 'Date'].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {transactions.map(tx => (
                <tr key={tx.id} className="hover:bg-gray-50/50">
                  <td className="px-5 py-3 font-mono text-gray-500">#{tx.teacher_id}</td>
                  <td className="px-5 py-3"><CreditChip value={tx.change} /></td>
                  <td className="px-5 py-3 text-gray-600 max-w-xs truncate">{tx.reason}</td>
                  <td className="px-5 py-3 text-gray-400 text-xs">{new Date(tx.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
