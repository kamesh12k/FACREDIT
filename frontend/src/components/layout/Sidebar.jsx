import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import {
  GridIcon, UsersIcon, CalIcon, BookIcon, DoorIcon, DocIcon, ChartIcon,
  PlusIcon, SettingsIcon, LogoutIcon, SwapIcon,
} from '../icons'

function NavItem({ to, icon, label, end }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
          isActive
            ? 'bg-primary-600 text-white'
            : 'text-gray-400 hover:text-white hover:bg-white/10'
        }`
      }
    >
      <span className="w-5 h-5 shrink-0">{icon}</span>
      {label}
    </NavLink>
  )
}

// Trimmed from 5 sections to 4, and "Academic Calendar" + "Scheduling" merged
// into one "Calendar & Timetable" group — fewer top-level groups for a
// moderate-comfort user to scan, same destinations underneath.
const ADMIN_NAV = [
  {
    section: null,
    items: [
      { to: '/admin/dashboard', label: 'Home', icon: <GridIcon />, end: true },
    ],
  },
  {
    section: 'Calendar & Timetable',
    items: [
      { to: '/admin/academic-calendar', label: 'Calendar & Day Order', icon: <CalIcon /> },
      { to: '/admin/timetable', label: 'Timetable', icon: <CalIcon /> },
      { to: '/admin/resource-availability', label: 'Room Availability', icon: <ChartIcon /> },
    ],
  },
  {
    section: 'Leave & Credits',
    items: [
      { to: '/admin/leaves', label: 'Leave Requests', icon: <DocIcon /> },
      { to: '/admin/today-substitutions', label: "Today's Substitutions", icon: <DocIcon /> },
      { to: '/admin/credits', label: 'Credits', icon: <ChartIcon /> },
    ],
  },
  {
    section: 'Setup',
    items: [
      { to: '/admin/teachers', label: 'Teachers', icon: <UsersIcon /> },
      { to: '/admin/subjects', label: 'Subjects', icon: <BookIcon /> },
      { to: '/admin/classes', label: 'Classes', icon: <UsersIcon /> },
      { to: '/admin/rooms', label: 'Rooms & Labs', icon: <DoorIcon /> },
    ],
  },
]

const TEACHER_NAV = [
  {
    section: null,
    items: [
      { to: '/teacher/dashboard', label: 'Home', icon: <GridIcon />, end: true },
      { to: '/teacher/timetable', label: 'My Timetable', icon: <CalIcon /> },
      { to: '/teacher/leave/apply', label: 'Apply for Leave', icon: <PlusIcon /> },
      { to: '/teacher/leaves', label: 'Leave History', icon: <DocIcon /> },
      { to: '/teacher/substitution', label: 'Manage Substitutes', icon: <SwapIcon /> },
      { to: '/teacher/today-coverage', label: "Today's Coverage", icon: <DocIcon /> },
      { to: '/teacher/credits', label: 'My Credits', icon: <ChartIcon /> },
    ],
  },
]

export default function Sidebar() {
  const { user, isAdmin, logout } = useAuth()
  const { app_name } = useTheme() || {}
  const navigate = useNavigate()
  const nav = isAdmin ? ADMIN_NAV : TEACHER_NAV

  const handleLogout = () => { logout(); navigate('/login') }

  return (
    <aside className="hidden lg:flex w-60 shrink-0 bg-primary-900 min-h-screen flex-col">
      <div className="px-4 py-5 border-b border-white/10">
        <p className="text-white font-semibold text-sm leading-tight">{app_name || 'Credits'}</p>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-4 overflow-y-auto">
        {nav.map((group, i) => (
          <div key={i}>
            {group.section && (
              <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-wider text-primary-100/40">{group.section}</p>
            )}
            <div className="space-y-1">
              {group.items.map((item) => <NavItem key={item.to} {...item} />)}
            </div>
          </div>
        ))}
      </nav>

      <div className="px-3 pb-4 border-t border-white/10 pt-3 space-y-2">
        {isAdmin && (
          <NavLink
            to="/admin/settings"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-white/10'
              }`
            }
          >
            <SettingsIcon className="w-5 h-5" />
            Settings
          </NavLink>
        )}
        {!isAdmin && (
          <NavLink
            to="/teacher/preferences"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-white/10'
              }`
            }
          >
            <SettingsIcon className="w-5 h-5" />
            Substitution Preferences
          </NavLink>
        )}
        <div className="px-3 py-2">
          <p className="text-white text-xs font-medium truncate">{user?.name}</p>
          <p className="text-primary-100/50 text-xs capitalize">{user?.role}</p>
        </div>
        <button onClick={handleLogout} className="flex items-center gap-2 w-full px-3 py-2 text-xs text-gray-400 hover:text-white transition-colors">
          <LogoutIcon className="w-4 h-4" /> Sign out
        </button>
      </div>
    </aside>
  )
}

export { ADMIN_NAV, TEACHER_NAV }
