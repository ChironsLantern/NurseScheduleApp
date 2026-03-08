import { useState, useEffect } from 'react'
import { supabase } from './supabase'

const SHIFT_COLORS = {
  D: { bg: '#4A6741', color: 'white', cls: 'shift-D' },
  N: { bg: '#1a2a4a', color: 'white', cls: 'shift-N' },
  E: { bg: '#8B6914', color: 'white', cls: 'shift-E' },
  O: { bg: '#e8e8e8', color: '#999', cls: '' },
}

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
]

export default function TeamView({ currentMonth, currentYear, printMode = false }) {
  const [nurses, setNurses] = useState([])
  const [schedule, setSchedule] = useState({})
  const [requests, setRequests] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAll()
  }, [currentMonth])

  async function fetchAll() {
    setLoading(true)
    try {
      const [nurseRes, schedRes, reqRes] = await Promise.all([
        supabase.from('nurses').select('*').eq('role', 'nurse').order('name'),
        supabase.from('schedule').select('*')
          .eq('year', currentYear)
          .eq('month', currentMonth + 1),
        supabase.from('pto_requests').select('*')
          .gte('date', `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`)
          .lte('date', `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-31`)
      ])

      if (nurseRes.data && schedRes.data) {
        const sorted = [...nurseRes.data].sort((a, b) => {
          const getMainShift = (nurseId) => {
            const shifts = schedRes.data
              .filter(r => r.nurse_id === nurseId && r.shift_type !== 'O')
              .map(r => r.shift_type)
            if (!shifts.length) return 'Z'
            const counts = shifts.reduce((acc, s) => {
              acc[s] = (acc[s] || 0) + 1
              return acc
            }, {})
            return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
          }
          const order = { D: 1, E: 2, N: 3, Z: 4 }
          return (order[getMainShift(a.id)] || 4) - (order[getMainShift(b.id)] || 4)
        })
        setNurses(sorted)
      } else if (nurseRes.data) {
        setNurses(nurseRes.data)
      }

      if (schedRes.data) {
        const map = {}
        schedRes.data.forEach(row => {
          if (!map[row.nurse_id]) map[row.nurse_id] = {}
          map[row.nurse_id][row.day] = row.shift_type
        })
        setSchedule(map)
      }

      if (reqRes.data) {
        const map = {}
        reqRes.data.forEach(row => {
          const day = new Date(row.date + 'T12:00:00').getDate()
          const key = `${row.nurse_id}-${day}`
          map[key] = row.status
        })
        setRequests(map)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
      Loading team schedule...
    </div>
  )

  return (
    <div
      className="print-area"
      style={{ padding: printMode ? '0' : '1rem', overflowX: 'auto' }}
    >
      {/* Print header */}
      <div className="print-header">
        <h2 style={{ color: '#4A6741', marginBottom: '0.25rem', fontSize: '1rem' }}>
          Rocky Mountain Treatment Center
        </h2>
        <p style={{ color: '#666', fontSize: '0.8rem', margin: 0 }}>
          {MONTHS[currentMonth]} {currentYear} — Full Team Schedule
        </p>
      </div>

      {/* Screen-only legend */}
      {!printMode && (
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
          {[
            { label: 'Day', bg: '#4A6741', color: 'white' },
            { label: 'Night', bg: '#1a2a4a', color: 'white' },
            { label: 'Evening', bg: '#8B6914', color: 'white' },
            { label: 'Off', bg: '#e8e8e8', color: '#999' },
            { label: 'Requested Off', bg: '#ffc107', color: '#333' },
            { label: 'Approved Off', bg: '#dc3545', color: 'white' },
            { label: 'Partial shift', bg: '#4A6741', color: 'white', partial: true },
          ].map(item => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <div style={{
                width: '12px', height: '12px',
                background: item.bg, borderRadius: '2px',
                border: item.partial ? '2px dashed #c5d9c0' : 'none'
              }} />
              <span style={{ fontSize: '0.72rem', color: '#555' }}>{item.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{
          borderCollapse: 'collapse',
          fontSize: '0.75rem',
          minWidth: printMode ? '100%' : '600px',
          width: printMode ? '100%' : 'auto'
        }}>
          <thead>
            <tr>
              <th style={{
                padding: '0.4rem 0.6rem',
                background: '#4A6741', color: 'white',
                textAlign: 'left', position: printMode ? 'static' : 'sticky',
                left: 0, zIndex: 1, minWidth: '80px'
              }}>Nurse</th>
              {days.map(d => (
                <th key={d} style={{
                  padding: '0.4rem 0.3rem',
                  background: '#4A6741', color: 'white',
                  textAlign: 'center', minWidth: '22px'
                }}>{d}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {nurses.map((nurse, ni) => {
              const isPartial = nurse.shift_start && nurse.shift_end
              const rowBg = ni % 2 === 0 ? '#f9f9f9' : 'white'

              return (
                <tr key={nurse.id}>
                  <td
                    className="nurse-name-cell"
                    style={{
                      padding: '0.4rem 0.6rem',
                      background: rowBg,
                      position: printMode ? 'static' : 'sticky',
                      left: 0, zIndex: 1,
                      borderRight: '2px solid #ddd'
                    }}>
                    <div style={{ fontWeight: 'bold', color: '#333' }}>{nurse.name}</div>
                    {isPartial && (
                      <div style={{ fontSize: '0.65rem', color: '#4A6741' }}>
                        {nurse.shift_start}–{nurse.shift_end}
                      </div>
                    )}
                  </td>
                  {days.map(day => {
                    const shift = schedule[nurse.id]?.[day]
                    const reqKey = `${nurse.id}-${day}`
                    const reqStatus = requests[reqKey]

                    let bg = rowBg
                    let color = '#ccc'
                    let label = ''
                    let cls = ''
                    let borderStyle = '1px solid #eee'

                    if (reqStatus === 'pending') {
                      bg = '#ffc107'; color = '#333'; label = 'Req'; cls = 'shift-REQ'
                    } else if (reqStatus === 'approved') {
                      bg = '#dc3545'; color = 'white'; label = 'Off'; cls = 'shift-OFF'
                    } else if (shift && shift !== 'O') {
                      const s = SHIFT_COLORS[shift]
                      bg = s.bg; color = s.color; label = shift; cls = s.cls
                      if (isPartial) borderStyle = '2px dashed #c5d9c0'
                    }

                    return (
                      <td key={day}
                        className={cls}
                        style={{
                          padding: '0.3rem',
                          background: bg,
                          color,
                          textAlign: 'center',
                          fontWeight: 'bold',
                          fontSize: '0.7rem',
                          border: borderStyle,
                          position: 'relative'
                        }}>
                        {label}
                        {isPartial && shift && shift !== 'O' && reqStatus !== 'approved' && (
                          <div style={{
                            position: 'absolute',
                            bottom: '1px', right: '2px',
                            fontSize: '0.5rem', opacity: 0.8
                          }}>½</div>
                        )}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Print legend (print only) */}
      <div className="print-legend">
        {[
          { label: 'Day', bg: '#4A6741' },
          { label: 'Night', bg: '#1a2a4a' },
          { label: 'Evening', bg: '#8B6914' },
          { label: 'Requested Off', bg: '#ffc107' },
          { label: 'Approved Off', bg: '#dc3545' },
        ].map(item => (
          <div key={item.label} className="print-legend-item">
            <div className="print-legend-swatch" style={{ background: item.bg }} />
            <span>{item.label}</span>
          </div>
        ))}
        <div className="print-legend-item">
          <span style={{ fontSize: '8pt' }}>½ = partial shift</span>
        </div>
      </div>
    </div>
  )
}
