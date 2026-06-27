import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { timetableApi, subjectsApi, classesApi, roomsApi } from '../../api/services'
import { Spinner, EmptyState } from '../../components/ui'

export default function MyTimetable() {
  const { user } = useAuth()
  const [slots, setSlots] = useState([])
  const [subjects, setSubjects] = useState({})
  const [classes, setClasses] = useState({})
  const [rooms, setRooms] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      timetableApi.getByTeacher(user.id),
      subjectsApi.list(true),
      classesApi.list(),
      roomsApi.list(),
    ]).then(([slotsRes, subjRes, classRes, roomRes]) => {
      setSlots(slotsRes.data)
      setSubjects(Object.fromEntries(subjRes.data.map(s => [s.id, s])))
      setClasses(Object.fromEntries(classRes.data.map(c => [c.id, c])))
      setRooms(Object.fromEntries(roomRes.data.map(r => [r.id, r])))
    }).finally(() => setLoading(false))
  }, [user.id])

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>

  const byDayOrder = [1, 2, 3, 4, 5, 6].reduce((acc, d) => {
    acc[d] = slots.filter(s => s.day_order === d).sort((a, b) => a.period_number - b.period_number)
    return acc
  }, {})

  const activeDayOrders = [1, 2, 3, 4, 5, 6].filter(d => byDayOrder[d].length > 0)

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-900">My Timetable</h1>

      {slots.length === 0 ? (
        <div className="card"><EmptyState message="No timetable assigned yet. Contact admin." /></div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {activeDayOrders.map(d => (
            <div key={d} className="card overflow-hidden">
              <div className="px-4 py-3 bg-primary-50 border-b border-primary-100">
                <p className="text-sm font-semibold text-primary-700">Day Order {d}</p>
              </div>
              <div className="divide-y divide-gray-50">
                {byDayOrder[d].map(slot => {
                  const subject = subjects[slot.subject_id]
                  const cls = classes[slot.class_id]
                  const room = rooms[slot.room_id]
                  return (
                    <div key={slot.id} className="px-4 py-3 flex items-center gap-3">
                      <span className="text-xs font-mono font-semibold text-gray-400 w-6">P{slot.period_number}</span>
                      <div>
                        <p className="text-sm font-medium text-gray-800">{subject ? `${subject.name} (${subject.code})` : `Subject #${slot.subject_id}`}</p>
                        <p className="text-xs text-gray-400">
                          {cls ? `${cls.name} - ${cls.section}` : ''}{room ? ` · ${room.room_number}` : ''}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
