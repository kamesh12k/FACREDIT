import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function ProtectedRoute() {
  const { token } = useAuth()
  return token ? <Outlet /> : <Navigate to="/login" replace />
}

export function AdminRoute() {
  const { token, isAdmin } = useAuth()
  if (!token) return <Navigate to="/login" replace />
  if (!isAdmin) return <Navigate to="/teacher/dashboard" replace />
  return <Outlet />
}

export function TeacherRoute() {
  const { token, isAdmin } = useAuth()
  if (!token) return <Navigate to="/login" replace />
  if (isAdmin) return <Navigate to="/admin/dashboard" replace />
  return <Outlet />
}

export function GuestRoute() {
  const { token, isAdmin, mustChangeCredentials } = useAuth()
  if (!token) return <Outlet />
  if (mustChangeCredentials) return <Navigate to="/first-login-setup" replace />
  return <Navigate to={isAdmin ? '/admin/dashboard' : '/teacher/dashboard'} replace />
}

/** Sits between AdminRoute/TeacherRoute and AppShell. Bounces anyone still
 * on default/reset credentials to the forced setup screen before they can
 * reach any dashboard route. */
export function RequireCredentialsSet() {
  const { mustChangeCredentials } = useAuth()
  if (mustChangeCredentials) return <Navigate to="/first-login-setup" replace />
  return <Outlet />
}

/** The setup screen itself: needs a token, but is the one place explicitly
 * exempt from the credentials gate (and irrelevant once credentials are
 * already set, so it bounces forward instead of back). */
export function FirstLoginSetupRoute() {
  const { token, isAdmin, mustChangeCredentials } = useAuth()
  if (!token) return <Navigate to="/login" replace />
  if (!mustChangeCredentials) return <Navigate to={isAdmin ? '/admin/dashboard' : '/teacher/dashboard'} replace />
  return <Outlet />
}
