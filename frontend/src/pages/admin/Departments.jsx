import { useEffect, useState } from 'react'
import { departmentsApi } from '../../api/services'
import { Spinner, ErrorAlert, Modal, EmptyState } from '../../components/ui'

export default function AdminDepartments() {
  const [departments, setDepartments] = useState([])
  const [loading, setLoading] = useState(true)

  // Add Department State
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ name: '', code: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Edit Department State
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [selectedDept, setSelectedDept] = useState(null)
  const [editForm, setEditForm] = useState({ name: '', code: '' })
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')

  // Delete Confirm State
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deptToDelete, setDeptToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const load = () => departmentsApi.list().then(r => setDepartments(r.data)).finally(() => setLoading(false))

  useEffect(() => {
    load()
  }, [])

  const handleCreate = async (e) => {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      await departmentsApi.create({ name: form.name, code: form.code || null })
      setModalOpen(false)
      setForm({ name: '', code: '' })
      load()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create department.')
    } finally {
      setSaving(false)
    }
  }

  const handleOpenEditModal = (dept) => {
    setSelectedDept(dept)
    setEditForm({
      name: dept.name,
      code: dept.code || '',
    })
    setEditError('')
    setEditModalOpen(true)
  }

  const handleUpdate = async (e) => {
    e.preventDefault()
    setEditError('')
    setEditSaving(true)
    try {
      await departmentsApi.update(selectedDept.id, {
        name: editForm.name,
        code: editForm.code || null,
      })
      setEditModalOpen(false)
      load()
    } catch (err) {
      setEditError(err.response?.data?.detail || 'Failed to update department.')
    } finally {
      setEditSaving(false)
    }
  }

  const handleOpenDelete = (dept) => {
    setDeptToDelete(dept)
    setDeleteError('')
    setDeleteConfirmOpen(true)
  }

  const handleDeleteConfirm = async () => {
    setDeleteError('')
    setDeleting(true)
    try {
      await departmentsApi.remove(deptToDelete.id)
      setDeleteConfirmOpen(false)
      load()
    } catch (err) {
      setDeleteError(err.response?.data?.detail || 'Failed to delete department.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Departments</h1>
        <button onClick={() => setModalOpen(true)} className="btn-primary text-sm">+ Add Department</button>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : departments.length === 0 ? <EmptyState message="No departments yet." /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Name', 'Code', 'Created At', ''].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {departments.map(d => (
                <tr key={d.id} className="hover:bg-gray-50/50">
                  <td className="px-5 py-3 font-medium text-gray-800">{d.name}</td>
                  <td className="px-5 py-3 font-mono text-xs text-gray-500">{d.code || '—'}</td>
                  <td className="px-5 py-3 text-gray-500">{new Date(d.created_at).toLocaleDateString()}</td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex justify-end gap-3">
                      <button onClick={() => handleOpenEditModal(d)} className="text-xs text-primary-600 hover:text-primary-800 font-semibold hover:underline">Edit</button>
                      <button onClick={() => handleOpenDelete(d)} className="text-xs text-red-500 hover:text-red-700 font-semibold hover:underline">Remove</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {/* Add Department Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Department">
        <form onSubmit={handleCreate} className="space-y-4">
          <ErrorAlert message={error} />
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Department Name</label>
            <input type="text" required className="input" placeholder="Computer Science" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Code</label>
            <input type="text" className="input" placeholder="CS" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? 'Saving…' : 'Create'}</button>
          </div>
        </form>
      </Modal>

      {/* Edit Department Modal */}
      <Modal open={editModalOpen} onClose={() => setEditModalOpen(false)} title="Edit Department">
        <form onSubmit={handleUpdate} className="space-y-4">
          <ErrorAlert message={editError} />
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Department Name</label>
            <input type="text" required className="input" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Code</label>
            <input type="text" className="input" value={editForm.code} onChange={e => setEditForm({ ...editForm, code: e.target.value })} />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={() => setEditModalOpen(false)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={editSaving} className="btn-primary flex-1">{editSaving ? 'Saving…' : 'Save Changes'}</button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)} title="Delete Department">
        <div className="space-y-4">
          <ErrorAlert message={deleteError} />
          <p className="text-sm text-gray-600">
            Are you sure you want to delete the department <strong className="text-gray-800">{deptToDelete?.name}</strong>? This action cannot be undone.
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
