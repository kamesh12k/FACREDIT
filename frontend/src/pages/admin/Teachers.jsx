import { useEffect, useState } from 'react'
import { teachersApi } from '../../api/services'
import { Spinner, ErrorAlert, Modal } from '../../components/ui'

export default function Teachers() {
  const [teachers, setTeachers] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '', department: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = () => teachersApi.list().then(r => setTeachers(r.data)).finally(() => setLoading(false))
  useEffect(() => { load() }, [])

  const handleCreate = async (e) => {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      await teachersApi.create({ ...form, role: 'teacher' })
      setModalOpen(false)
      setForm({ name: '', email: '', password: '', department: '' })
      load()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create teacher.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Teachers</h1>
        <button onClick={() => setModalOpen(true)} className="btn-primary text-sm">+ Add Teacher</button>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Name', 'Email', 'Department', 'Status'].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {teachers.map(t => (
                <tr key={t.id} className="hover:bg-gray-50/50">
                  <td className="px-5 py-3 font-medium text-gray-800">{t.name}</td>
                  <td className="px-5 py-3 text-gray-500">{t.email}</td>
                  <td className="px-5 py-3 text-gray-500">{t.department || '—'}</td>
                  <td className="px-5 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${t.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {t.is_active ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                </tr>
              ))}
              {teachers.length === 0 && (
                <tr><td colSpan={4} className="px-5 py-10 text-center text-sm text-gray-400">No teachers yet. Add one above.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Teacher">
        <form onSubmit={handleCreate} className="space-y-4">
          <ErrorAlert message={error} />
          {[
            { label: 'Full name', key: 'name', type: 'text' },
            { label: 'Email', key: 'email', type: 'email' },
            { label: 'Department', key: 'department', type: 'text' },
            { label: 'Password', key: 'password', type: 'password' },
          ].map(({ label, key, type }) => (
            <div key={key}>
              <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
              <input type={type} required={key !== 'department'} className="input" value={form[key]}
                onChange={e => setForm({ ...form, [key]: e.target.value })} />
            </div>
          ))}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? 'Saving…' : 'Create'}</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
