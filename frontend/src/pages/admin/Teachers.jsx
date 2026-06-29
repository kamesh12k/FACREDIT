import { useEffect, useState } from 'react'
import { teachersApi, departmentsApi } from '../../api/services'
import { Spinner, ErrorAlert, Modal } from '../../components/ui'

export default function Teachers() {
  const [teachers, setTeachers] = useState([])
  const [departments, setDepartments] = useState([])
  const [loading, setLoading] = useState(true)
  
  // Add Teacher Modal State
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '', department: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Edit Teacher Modal State
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [selectedTeacher, setSelectedTeacher] = useState(null)
  const [editForm, setEditForm] = useState({ name: '', email: '', password: '', department: '', is_active: true })
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')

  // Delete Teacher State
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [teacherToDelete, setTeacherToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const load = () => {
    Promise.all([teachersApi.list(), departmentsApi.list()])
      .then(([t, d]) => {
        setTeachers(t.data)
        setDepartments(d.data)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

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

  const handleOpenEditModal = (teacher) => {
    setSelectedTeacher(teacher)
    setEditForm({
      name: teacher.name,
      email: teacher.email,
      password: '',
      department: teacher.department || '',
      is_active: teacher.is_active,
    })
    setEditError('')
    setEditModalOpen(true)
  }

  const handleUpdate = async (e) => {
    e.preventDefault()
    setEditError('')
    setEditSaving(true)
    try {
      await teachersApi.update(selectedTeacher.id, {
        name: editForm.name,
        email: editForm.email,
        department: editForm.department || null,
        is_active: editForm.is_active,
        password: editForm.password || null,
      })
      setEditModalOpen(false)
      load()
    } catch (err) {
      setEditError(err.response?.data?.detail || 'Failed to update teacher.')
    } finally {
      setEditSaving(false)
    }
  }

  const handleOpenDelete = (teacher) => {
    setTeacherToDelete(teacher)
    setDeleteError('')
    setDeleteConfirmOpen(true)
  }

  const handleDeleteConfirm = async () => {
    setDeleteError('')
    setDeleting(true)
    try {
      await teachersApi.remove(teacherToDelete.id)
      setDeleteConfirmOpen(false)
      load()
    } catch (err) {
      setDeleteError(err.response?.data?.detail || 'Failed to delete teacher.')
    } finally {
      setDeleting(false)
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
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Name', 'Email', 'Department', 'Status', ''].map(h => (
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
                    <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${t.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {t.is_active ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex justify-end gap-3">
                      <button
                        onClick={() => handleOpenEditModal(t)}
                        className="text-xs text-primary-600 hover:text-primary-800 font-semibold hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleOpenDelete(t)}
                        className="text-xs text-red-500 hover:text-red-700 font-semibold hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {teachers.length === 0 && (
                <tr><td colSpan={5} className="px-5 py-10 text-center text-sm text-gray-400">No teachers yet. Add one above.</td></tr>
              )}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {/* Add Teacher Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Teacher">
        <form onSubmit={handleCreate} className="space-y-4">
          <ErrorAlert message={error} />
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Full name</label>
            <input type="text" required className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
            <input type="email" required className="input" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Department</label>
            <select required className="input" value={form.department} onChange={e => setForm({ ...form, department: e.target.value })}>
              <option value="">Select department…</option>
              {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Password</label>
            <input type="password" required className="input" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? 'Saving…' : 'Create'}</button>
          </div>
        </form>
      </Modal>

      {/* Edit Teacher Modal */}
      <Modal open={editModalOpen} onClose={() => setEditModalOpen(false)} title="Edit Teacher">
        <form onSubmit={handleUpdate} className="space-y-4">
          <ErrorAlert message={editError} />
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Full name</label>
            <input type="text" required className="input" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
            <input type="email" required className="input" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Department</label>
            <select required className="input" value={editForm.department} onChange={e => setEditForm({ ...editForm, department: e.target.value })}>
              <option value="">Select department…</option>
              {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">New Password (optional)</label>
            <input type="password" placeholder="Leave blank to keep current" className="input" value={editForm.password} onChange={e => setEditForm({ ...editForm, password: e.target.value })} />
          </div>
          
          <div className="flex items-center justify-between py-2">
            <div>
              <span className="text-xs font-medium text-gray-700">Account Active Status</span>
              <p className="text-[10px] text-gray-400">Disabled accounts cannot log in or cover classes.</p>
            </div>
            <button
              type="button"
              onClick={() => setEditForm({ ...editForm, is_active: !editForm.is_active })}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                editForm.is_active ? 'bg-primary-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  editForm.is_active ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={() => setEditModalOpen(false)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={editSaving} className="btn-primary flex-1">{editSaving ? 'Saving…' : 'Save Changes'}</button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)} title="Delete Teacher">
        <div className="space-y-4">
          <ErrorAlert message={deleteError} />
          <p className="text-sm text-gray-600">
            Are you sure you want to delete the teacher <strong className="text-gray-800">{teacherToDelete?.name}</strong>? This action cannot be undone and will fail if the teacher has any associated timetable slots, leave requests, or substitute assignments.
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setDeleteConfirmOpen(false)} className="btn-secondary flex-1">Cancel</button>
            <button type="button" onClick={handleDeleteConfirm} disabled={deleting} className="btn-danger flex-1">{deleting ? 'Deleting…' : 'Delete'}</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
