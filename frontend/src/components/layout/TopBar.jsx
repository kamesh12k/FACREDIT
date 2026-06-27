import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { academicCalendarApi } from '../../api/services'
import { DayTypeBadge } from '../ui'
import { SearchIcon } from '../icons'
import NotificationBell from './NotificationBell'
import QuickSearch from './QuickSearch'

function pad(n) { return String(n).padStart(2, '0') }
function todayIso() {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export default function TopBar() {
  const { isAdmin } = useAuth()
  const { app_name } = useTheme() || {}
  const [today, setToday] = useState(null)
  const [searchOpen, setSearchOpen] = useState(false)

  useEffect(() => {
    academicCalendarApi.resolve(todayIso()).then(r => setToday(r.data)).catch(() => {})
  }, [])

  return (
    <>
      <header className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-gray-100">
        <div className="flex items-center justify-between px-4 lg:px-6 py-3 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="lg:hidden font-semibold text-gray-900 text-sm truncate">{app_name || 'Credits'}</span>
            {today && (
              <span className="hidden sm:flex items-center gap-1.5 text-xs text-gray-400">
                <span className="hidden md:inline">Today</span>
                {today.day_type === 'working' && today.day_order ? (
                  <span className="inline-flex items-center rounded-full font-medium bg-green-100 text-green-700 px-2.5 py-0.5 text-xs">
                    Day Order {today.day_order}
                  </span>
                ) : (
                  <DayTypeBadge dayType={today.day_type} />
                )}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isAdmin && (
              <button
                onClick={() => setSearchOpen(true)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-400 hover:text-gray-600 hover:border-gray-300 text-sm"
              >
                <SearchIcon className="w-4 h-4" />
                <span className="hidden sm:inline">Search…</span>
              </button>
            )}
            <NotificationBell />
          </div>
        </div>
      </header>

      {isAdmin && <QuickSearch open={searchOpen} onClose={() => setSearchOpen(false)} />}
    </>
  )
}
