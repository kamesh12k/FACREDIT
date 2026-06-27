import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { adminApi, campusOperationsApi } from '../../api/services'
import { Spinner, ErrorAlert, EmptyState, Modal } from '../../components/ui'
import { SparklesIcon } from '../../components/icons'

const MODE_INFO = {
  manual: {
    label: 'Manual',
    description: 'You handle every leave approval and substitute assignment yourself. The system makes no recommendations and takes no automatic action.',
  },
  assisted: {
    label: 'Assisted',
    description: 'The system ranks substitute candidates by compatibility (subject match, workload, fairness) when you open the assign-substitute panel. You always click to approve — nothing happens automatically.',
  },
  autonomous: {
    label: 'Autonomous',
    description: 'The moment a leave is approved, the system immediately assigns the best eligible substitute with no click required. It will never assign a teacher who is on leave, already teaching, has opted out, or is over their weekly cap — but it does act without waiting for you. You can still override, undo, or lock any assignment afterward.',
  },
}

function CampusOperationsModePanel({ isSuperAdmin }) {
  const [mode, setMode] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [confirmMode, setConfirmMode] = useState(null)

  useEffect(() => {
    campusOperationsApi.getMode().then(r => setMode(r.data.mode)).finally(() => setLoading(false))
  }, [])

  const applyMode = async (newMode) => {
    setError('')
    setSaving(true)
    try {
      const { data } = await campusOperationsApi.setMode(newMode)
      setMode(data.mode)
      setConfirmMode(null)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to change mode.')
    } finally {
      setSaving(false)
    }
  }

  const handleSelect = (newMode) => {
    if (newMode === mode) return
    // Switching TO autonomous is the one change worth a confirmation step
    // — every other transition only removes automation, never adds it.
    if (newMode === 'autonomous') {
      setConfirmMode(newMode)
    } else {
      applyMode(newMode)
    }
  }

  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
          <SparklesIcon className="w-4 h-4 text-primary-500" /> Campus Operations Mode
        </h2>
        <p className="text-xs text-gray-400 mt-0.5">Controls how much the system does automatically when a leave is approved</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Spinner /></div>
      ) : (
        <div className="p-5 space-y-3">
          <ErrorAlert message={error} />
          {Object.entries(MODE_INFO).map(([value, info]) => (
            <button
              key={value}
              onClick={() => isSuperAdmin && handleSelect(value)}
              disabled={!isSuperAdmin || saving}
              className={`w-full text-left p-4 rounded-xl border-2 transition-colors ${
                mode === value ? 'border-primary-500 bg-primary-50/50' : 'border-gray-100 hover:border-gray-200'
              } ${!isSuperAdmin ? 'cursor-default' : ''} disabled:opacity-60`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-sm font-semibold ${mode === value ? 'text-primary-700' : 'text-gray-800'}`}>{info.label}</span>
                {mode === value && <span className="text-xs font-medium text-primary-600">Active</span>}
              </div>
              <p className="text-xs text-gray-500 mt-1">{info.description}</p>
            </button>
          ))}
          {!isSuperAdmin && (
            <p className="text-xs text-gray-400 pt-1">Only a Super Admin can change this setting.</p>
          )}
        </div>
      )}

      <Modal open={!!confirmMode} onClose={() => setConfirmMode(null)} title="Switch to Autonomous mode?">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            From now on, approving a leave will immediately assign a substitute with no
            approval click — the system will pick the best eligible teacher on its own.
            You can still override, undo, or lock any assignment afterward, and you can
            switch back to Manual or Assisted at any time.
          </p>
          <div className="flex gap-2">
            <button onClick={() => setConfirmMode(null)} className="btn-secondary flex-1">Cancel</button>
            <button onClick={() => applyMode('autonomous')} disabled={saving} className="btn-primary flex-1">
              {saving ? 'Switching…' : 'Switch to Autonomous'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function AdminsPanel({ isSuperAdmin }) {
  const [admins, setAdmins] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ name: '', username: '', password: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = () => adminApi.listSecondaryAdmins().then(r => setAdmins(r.data)).finally(() => setLoading(false))
  useEffect(() => { load() }, [])

  const activeSecondaryCount = admins.filter(a => a.admin_level === 'secondary_admin' && a.is_active).length

  const handleCreate = async (e) => {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      await adminApi.createSecondaryAdmin(form)
      setModalOpen(false)
      setForm({ name: '', username: '', password: '' })
      load()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create Secondary Admin.')
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (admin) => {
    if (admin.is_active) await adminApi.disableAdmin(admin.id)
    else await adminApi.enableAdmin(admin.id)
    load()
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div>
          <h2 className="text-sm font-semibold text-gray-800">Admin Accounts</h2>
          <p className="text-xs text-gray-400 mt-0.5">{activeSecondaryCount}/3 active Secondary Admins</p>
        </div>
        {isSuperAdmin && (
          <button onClick={() => { setError(''); setModalOpen(true) }} disabled={activeSecondaryCount >= 3} className="btn-primary text-sm disabled:opacity-40">
            + Add Secondary Admin
          </button>
        )}
      </div>
      {loading ? (
        <div className="flex justify-center py-10"><Spinner /></div>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              {['Name', 'Username', 'Level', 'Status', isSuperAdmin ? '' : null].filter(Boolean).map(h => (
                <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {admins.map(a => (
              <tr key={a.id} className="hover:bg-gray-50/50">
                <td className="px-5 py-3 font-medium text-gray-800">{a.name}</td>
                <td className="px-5 py-3 font-mono text-xs text-gray-500">{a.username}</td>
                <td className="px-5 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${a.admin_level === 'super_admin' ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-600'}`}>
                    {a.admin_level === 'super_admin' ? 'Super Admin' : 'Secondary Admin'}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <span className={`text-xs font-medium ${a.is_active ? 'text-green-600' : 'text-gray-400'}`}>
                    {a.is_active ? 'Active' : 'Disabled'}
                  </span>
                </td>
                {isSuperAdmin && (
                  <td className="px-5 py-3">
                    {a.admin_level === 'secondary_admin' && (
                      <button onClick={() => toggleActive(a)} className="text-xs text-primary-600 hover:underline">
                        {a.is_active ? 'Disable' : 'Enable'}
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Secondary Admin">
        <form onSubmit={handleCreate} className="space-y-4">
          <ErrorAlert message={error} />
          <p className="text-xs text-gray-500">
            They'll be required to set their own username and password on first login.
          </p>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Full name</label>
            <input type="text" required className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Temporary username</label>
            <input type="text" required minLength={3} className="input" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Temporary password</label>
            <input type="password" required minLength={8} className="input" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? 'Creating…' : 'Create'}</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

function AuditLogPanel() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { adminApi.auditLogs().then(r => setLogs(r.data)).finally(() => setLoading(false)) }, [])

  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-800">Audit Log</h2>
        <p className="text-xs text-gray-400 mt-0.5">Admin-management and calendar actions. Cleared by Factory Reset.</p>
      </div>
      {loading ? (
        <div className="flex justify-center py-10"><Spinner /></div>
      ) : logs.length === 0 ? <EmptyState message="No audit events yet." /> : (
        <div className="divide-y divide-gray-50 max-h-72 overflow-y-auto">
          {logs.map(l => (
            <div key={l.id} className="px-5 py-2.5 flex items-center justify-between text-xs">
              <span className="text-gray-700"><span className="font-medium">{l.actor_name || 'System'}</span> — {l.action}</span>
              <span className="text-gray-400">{new Date(l.created_at).toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function FactoryResetPanel() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmText, setConfirmText] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await adminApi.factoryReset({ password, confirmation_text: confirmText })
      setDone(data)
      setTimeout(() => {
        logout()
        navigate('/login')
      }, 4000)
    } catch (err) {
      setError(err.response?.data?.detail || 'Factory reset failed.')
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="card p-6 border-green-200 bg-green-50/40">
        <p className="text-sm font-semibold text-green-800">{done.message}</p>
        <p className="text-xs text-green-700 mt-1">Backup saved: {done.backup_file}</p>
        <p className="text-xs text-gray-500 mt-3">Signing you out…</p>
      </div>
    )
  }

  return (
    <div className="card p-6 border-red-200">
      <h2 className="text-sm font-semibold text-red-700">Factory Reset</h2>
      <p className="text-xs text-gray-500 mt-1 mb-4">
        Permanently deletes all faculty data, accounts, history, and the entire Academic Calendar
        (academic years, semesters, holidays, Day Order assignments), then recreates a single
        Super Admin (username/password <code className="font-mono">admin</code> / <code className="font-mono">admin</code>,
        forced to change on next login). A timestamped backup is taken automatically first, but
        restoring it is a manual database operation — this is not an undo button.
      </p>
      <form onSubmit={handleSubmit} className="space-y-3">
        <ErrorAlert message={error} />
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Your current password</label>
          <input type="password" required className="input" value={password} onChange={e => setPassword(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Type <span className="font-mono font-semibold">RESET EVERYTHING</span> to confirm</label>
          <input type="text" required className="input" value={confirmText} onChange={e => setConfirmText(e.target.value)} placeholder="RESET EVERYTHING" />
        </div>
        <button type="submit" disabled={loading || confirmText !== 'RESET EVERYTHING'} className="btn-danger w-full disabled:opacity-40">
          {loading ? 'Resetting…' : 'Factory Reset Everything'}
        </button>
      </form>
    </div>
  )
}

export default function AdminSettings() {
  const { isSuperAdmin } = useAuth()

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-0.5">Admin accounts, audit history, and system reset</p>
      </div>

      <CampusOperationsModePanel isSuperAdmin={isSuperAdmin} />
      <AdminsPanel isSuperAdmin={isSuperAdmin} />
      <AuditLogPanel />
      {isSuperAdmin && <FactoryResetPanel />}
    </div>
  )
}
