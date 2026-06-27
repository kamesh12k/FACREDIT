import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { authApi } from '../../api/services'
import { ErrorAlert, Spinner } from '../../components/ui'

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '', department: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await authApi.register(form)
      login(data.access_token, data.user)
      navigate('/teacher/dashboard')
    } catch (err) {
      setError(err.response?.data?.detail || 'Registration failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-xl font-bold text-gray-900">Create account</h1>
          <p className="text-sm text-gray-500 mt-1">Register as a teacher</p>
        </div>

        <div className="card p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <ErrorAlert message={error} />
            {[
              { label: 'Full name', key: 'name', type: 'text', placeholder: 'Dr. Jane Smith' },
              { label: 'Email', key: 'email', type: 'email', placeholder: 'you@college.edu' },
              { label: 'Department', key: 'department', type: 'text', placeholder: 'Computer Science' },
              { label: 'Password', key: 'password', type: 'password', placeholder: '••••••••' },
            ].map(({ label, key, type, placeholder }) => (
              <div key={key}>
                <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
                <input type={type} required={key !== 'department'} className="input" value={form[key]} onChange={set(key)} placeholder={placeholder} />
              </div>
            ))}
            <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
              {loading ? <Spinner size="sm" /> : null}
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-gray-500 mt-4">
          Already have an account?{' '}
          <Link to="/login" className="text-primary-600 font-medium hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
