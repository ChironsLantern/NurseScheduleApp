import { useState, useEffect } from 'react'
import { supabase } from './supabase'

const SHIFT_COLORS = {
  D: { bg: '#4A6741', color: 'white', label: 'Day' },
  N: { bg: '#1a2a4a', color: 'white', label: 'Night' },
  E: { bg: '#8B6914', color: 'white', label: 'Evening' },
  O: { bg: '#e8e8e8', color: '#666', label: 'Off' },
}

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
]

const DAYS_OF_WEEK = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

export default function Schedule({ nurse, onLogout }) {
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth())
  const [currentYear] = useState(2026)
  const [scheduleData, setScheduleData] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchSchedule()
  }, [currentMonth])

  async function fetchSchedule() {
    setLoading(true)
    const { data, error } = await supabase
      .from('schedule')
      .select('*')
      .eq('nurse_id', nurse.id)
      .eq('year', currentYear)
      .eq('month', currentMonth + 1)

    if (!error && data) {
      const map = {}
      data.forEach(row => { map[row.day] = row.shift_type })
      setScheduleData(map)
    }
    setLoading(false)
  }

  function getDaysInMonth(month, year) {
    return new Date(year, month + 1, 0).getDate()
  }

  function getFirstDayOfMonth(month, year) {
    return new Date(year, month, 1).getDay()
  }

  const daysInMonth = getDaysInMonth(currentMonth, currentYear)
  const firstDay = getFirstDayOfMonth(currentMonth, currentYear)

  const cells = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f0f4ee',
      fontFamily: 'Arial, sans-serif'
    }}>
      {/* Header */}
      <div style={{
        background: '#4A6741',
        padding: '1rem 1.5rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <div style={{ color: 'white', fontWeight: 'bold', fontSize: '1rem' }}>
            Rocky Mountain
          </div>
          <div style={{ color: '#c5d9c0', fontSize: '0.75rem', letterSpacing: '0.1em' }}>
            TREATMENT CENTER
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ color: 'white', fontSize: '0.9rem' }}>
            {nurse.name}
          </div>
          <button
            onClick={onLogout}
            style={{
              background: 'transparent',
              border: '1px solid #c5d9c0',
              color: '#c5d9c0',
              borderRadius: '4px',
              padding: '0.2rem 0.6rem',
              fontSize: '0.75rem',
              cursor: 'pointer',
              marginTop: '0.25rem'
            }}
          >
            Log Out
          </button>
        </div>
      </div>

      {/* Month navigation */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '1rem 1.5rem',
        background: 'white',
        borderBottom: '1px solid #ddd'
      }}>
        <button
          onClick={() => setCurrentMonth(m => Math.max(0, m - 1))}
          disabled={currentMonth === 0}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '1.5rem',
            cursor: currentMonth === 0 ? 'not-allowed' : 'pointer',
            color: currentMonth === 0 ? '#ccc' : '#4A6741'
          }}
        >‹</button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: '#4A6741' }}>
            {MONTHS[currentMonth]} {currentYear}
          </div>
        </div>
        <button
          onClick={() => setCurrentMonth(m => Math.min(11, m + 1))}
          disabled={currentMonth === 11}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '1.5rem',
            cursor: currentMonth === 11 ? 'not-allowed' : 'pointer',
            color: currentMonth === 11 ? '#ccc' : '#4A6741'
          }}
        >›</button>
      </div>

      {/* Legend */}
      <div style={{
        display: 'flex',
        gap: '0.5rem',
        padding: '0.75rem 1.5rem',
        background: 'white',
        borderBottom: '1px solid #ddd',
        flexWrap: 'wrap'
      }}>
        {Object.entries(SHIFT_COLORS).map(([key, val]) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <div style={{
              width: '14px', height: '14px',
              background: val.bg,
              borderRadius: '3px',
              border: '1px solid #ddd'
            }} />
            <span style={{ fontSize: '0.75rem', color: '#666' }}>{val.label}</span>
          </div>
        ))}
      </div>

      {/* Calendar */}
      <div style={{ padding: '1rem' }}>
        {/* Day headers */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: '2px',
          marginBottom: '2px'
        }}>
          {DAYS_OF_WEEK.map(d => (
            <div key={d} style={{
              textAlign: 'center',
              fontSize: '0.75rem',
              fontWeight: 'bold',
              color: '#666',
              padding: '0.25rem'
            }}>{d}</div>
          ))}
        </div>

        {/* Calendar grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: '2px'
        }}>
          {cells.map((day, idx) => {
            if (!day) return <div key={`empty-${idx}`} />
            const shift = scheduleData[day]
            const shiftStyle = shift ? SHIFT_COLORS[shift] : null
            const isToday =
              new Date().getDate() === day &&
              new Date().getMonth() === currentMonth &&
              new Date().getFullYear() === currentYear

            return (
              <div key={day} style={{
                background: shiftStyle ? shiftStyle.bg : 'white',
                color: shiftStyle ? shiftStyle.color : '#333',
                borderRadius: '6px',
                padding: '0.4rem 0.2rem',
                textAlign: 'center',
                minHeight: '48px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                border: isToday ? '2px solid #4A6741' : '1px solid #ddd',
                boxSizing: 'border-box'
              }}>
                <div style={{
                  fontSize: '0.8rem',
                  fontWeight: isToday ? 'bold' : 'normal'
                }}>{day}</div>
                {shift && (
                  <div style={{ fontSize: '0.65rem', marginTop: '2px' }}>
                    {shift}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', color: '#666', padding: '1rem' }}>
          Loading schedule...
        </div>
      )}
    </div>
  )
}
