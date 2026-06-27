import { useEffect, useState } from 'react'
import { classesApi, departmentsApi } from '../../api/services'
import { Spinner, ErrorAlert, Modal, EmptyState } from '../../components/ui'

export default function AdminClasses() {
  const [classes, setClasses] = useState([])
  const [departments, setDepartments] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ name: '', section: '', department_id: '', semester: 1 })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = () => classesApi.list().then(r => setClasses(r.data)).finally(() => setLoading(false))
  useEffect(() => {
    load()
    departmentsApi.list().then(r => setDepartments(r.data))
  }, [])

  const handleCreate = async (e) => {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      await classesApi.create({ ...form, department_id: Number(form.department_id), semester: Number(form.semester) })
      setModalOpen(false)
      setForm({ name: '', section: '', department_id: '', semester: 1 })
      load()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create class.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    try {
      await classesApi.remove(id)
      load()
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to delete class.')
    }
  }

  const deptName = (id) => departments.find(d => d.id === id)?.name || '—'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Classes</h1>
        <button onClick={() => setModalOpen(true)} className="btn-primary text-sm">+ Add Class</button>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : classes.length === 0 ? <EmptyState message="No classes yet." /> : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Name', 'Section', 'Department', 'Semester', ''].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {classes.map(c => (
                <tr key={c.id} className="hover:bg-gray-50/50">
                  <td className="px-5 py-3 font-medium text-gray-800">{c.name}</td>
                  <td className="px-5 py-3 text-gray-500">{c.section}</td>
                  <td className="px-5 py-3 text-gray-500">{deptName(c.department_id)}</td>
                  <td className="px-5 py-3 text-gray-500">Sem {c.semester}</td>
                  <td className="px-5 py-3">
                    <button onClick={() => handleDelete(c.id)} className="text-xs text-red-500 hover:text-red-700">Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Class">
        <form onSubmit={handleCreate} className="space-y-4">
          <ErrorAlert message={error} />
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Class name</label>
            <input type="text" required className="input" placeholder="I B.Sc CS" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Section</label>
            <input type="text" required className="input" placeholder="A" value={form.section} onChange={e => setForm({ ...form, section: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Department</label>
            <select required className="input" value={form.department_id} onChange={e => setForm({ ...form, department_id: e.target.value })}>
              <option value="">Select…</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Semester</label>
            <select className="input" value={form.semester} onChange={e => setForm({ ...form, semester: e.target.value })}>
              {[1, 2, 3, 4, 5, 6, 7, 8].map(s => <option key={s} value={s}>Semester {s}</option>)}
            </select>
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? 'Saving…' : 'Create'}</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
