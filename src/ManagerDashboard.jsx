import { useState, useEffect } from 'react'
import { supabase } from './supabase'

const SHIFT_COLORS = {
  D: { bg: '#4A6741', color: 'white', label: 'Day' },
  N: { bg: '#1a2a4a', color: 'white', label: 'Night' },
  O: { bg: '#e8e8e8', color: '#999', label: 'Off' },
}

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
]

export default function ManagerDashboard({ nurse, onLogout }) {
  const [activeTab, setActiveTab] = useState('schedule')
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth())
  const [currentYear] = useState(2026)
  const [nurses, setNurses] = useState([])
  const [schedule, setSchedule] = useState({})
  const [requests, setRequests] = useState({})
  const [requestFilter, setRequestFilter] = useState('pending')
  const [editCell, setEditCell] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)

  // Nurse management
  const [newNurseName, setNewNurseName] = useState('')
  const [newNursePin, setNewNursePin] = useState('')
  const [newNurseStart, setNewNurseStart] = useState('')
  const [newNurseEnd, setNewNurseEnd] = useState('')
  const [resetPinNurse, setResetPinNurse] = useState(null)
  const [resetPinValue, setResetPinValue] = useState('')

  useEffect(() => { fetchAll() }, [currentMonth])

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  async function fetchAll() {
    setLoading(true)
    try {
      const [nurseRes, schedRes, reqRes] = await Promise.all([
        supabase.from('nurses').select('*').eq('role', 'nurse').order('name'),
        supabase.from('schedule').select('*')
          .eq('year', currentYear).eq('month', currentMonth + 1),
        supabase.from('pto_requests').select('*')
          .order('created_at', { ascending: false })
      ])

      if (nurseRes.data && schedRes.data) {
        const sorted = [...nurseRes.data].sort((a, b) => {
          const getMainShift = (nurseId) => {
            const shifts = schedRes.data
              .filter(r => r.nurse_id === nurseId && r.shift_type !== 'O')
              .map(r => r.shift_type)
            if (!shifts.length) return 'Z'
            const counts = shifts.reduce((acc, s) => {
              acc[s] = (acc[s] || 0) + 1; return acc
            }, {})
            return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
          }
          const order = { D: 1, E: 2, N: 3, Z: 4 }
          return (order[getMainShift(a.id)] || 4) - (order[getMainShift(b.id)] || 4)
        })
        setNurses(sorted)
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
        reqRes.data.forEach(row => { map[row.id] = row })
        setRequests(map)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // ── Schedule editing ──────────────────────────────────────────
  function handleCellClick(nurseId, day) {
    const existingReq = Object.values(requests).find(r => {
      const d = new Date(r.date + 'T12:00:00')
      return r.nurse_id === nurseId &&
        d.getMonth() === currentMonth &&
        d.getDate() === day &&
        r.status === 'pending'
    })
    setEditCell({ nurseId, day, existingReq: existingReq || null })
  }

  async function saveShift(newShift) {
    if (!editCell) return
    setSaving(true)
    const { nurseId, day } = editCell
    try {
      const { data: existing } = await supabase
        .from('schedule')
        .select('id')
        .eq('nurse_id', nurseId)
        .eq('year', currentYear)
        .eq('month', currentMonth + 1)
        .eq('day', day)
        .single()

      if (existing) {
        await supabase.from('schedule').update({ shift_type: newShift }).eq('id', existing.id)
      } else {
        await supabase.from('schedule').insert({
          nurse_id: nurseId, year: currentYear,
          month: currentMonth + 1, day, shift_type: newShift
        })
      }

      setSchedule(prev => ({
        ...prev,
        [nurseId]: { ...(prev[nurseId] || {}), [day]: newShift }
      }))
      setEditCell(null)
      showToast('Shift updated')
    } catch (err) {
      showToast('Error saving shift', 'error')
    } finally {
      setSaving(false)
    }
  }

  // ── PTO approval ──────────────────────────────────────────────
  async function handleRequest(id, status, reason) {
    try {
      await supabase.from('pto_requests')
        .update({ status, manager_reason: reason || null })
        .eq('id', id)
      setRequests(prev => ({
        ...prev,
        [id]: { ...prev[id], status, manager_reason: reason || null }
      }))
      showToast(`Request ${status}`)
    } catch (err) {
      showToast('Error updating request', 'error')
    }
  }

  // ── Nurse management ──────────────────────────────────────────
  async function addNurse() {
    if (!newNurseName.trim() || newNursePin.length !== 4) {
      showToast('Name and 4-digit PIN required', 'error'); return
    }
    try {
      const { data, error } = await supabase.from('nurses').insert({
        name: newNurseName.trim(),
        pin: newNursePin,
        role: 'nurse',
        shift_start: newNurseStart || null,
        shift_end: newNurseEnd || null
      }).select().single()
      if (error) throw error
      setNurses(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
      setNewNurseName(''); setNewNursePin('')
      setNewNurseStart(''); setNewNurseEnd('')
      showToast(`${data.name} added`)
    } catch (err) {
      showToast('Error adding nurse', 'error')
    }
  }

  async function removeNurse(id, name) {
    if (!window.confirm(`Remove ${name} from the roster? This cannot be undone.`)) return
    try {
      await supabase.from('nurses').delete().eq('id', id)
      setNurses(prev => prev.filter(n => n.id !== id))
      showToast(`${name} removed`)
    } catch (err) {
      showToast('Error removing nurse', 'error')
    }
  }

  async function resetPin() {
    if (!resetPinNurse || resetPinValue.length !== 4) {
      showToast('Enter a 4-digit PIN', 'error'); return
    }
    try {
      await supabase.from('nurses').update({ pin: resetPinValue }).eq('id', resetPinNurse.id)
      setResetPinNurse(null); setResetPinValue('')
      showToast(`PIN reset for ${resetPinNurse.name}`)
    } catch (err) {
      showToast('Error resetting PIN', 'error')
    }
  }

  // ── Export ────────────────────────────────────────────────────
  function exportCSV() {
    const rows = Object.values(requests).filter(r => {
      const d = new Date(r.date + 'T12:00:00')
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear
    })
    if (!rows.length) { showToast('No requests this month', 'error'); return }

    const nurseMap = {}
    nurses.forEach(n => { nurseMap[n.id] = n.name })

    const header = 'Nurse,Date,Leave Type,Status,Manager Note\n'
    const csv = rows.map(r =>
      `${nurseMap[r.nurse_id] || 'Unknown'},${r.date},${r.leave_type},${r.status},"${r.manager_reason || ''}"`
    ).join('\n')

    const blob = new Blob([header + csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `RMTC_Requests_${MONTHS[currentMonth]}_${currentYear}.csv`
    a.click()
    URL.revokeObjectURL(url)
    showToast('Exported!')
  }

  // ── Helpers ───────────────────────────────────────────────────
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)

  const requestList = Object.values(requests).filter(r =>
    requestFilter === 'all' ? true : r.status === requestFilter
  )

  const nurseMap = {}
  nurses.forEach(n => { nurseMap[n.id] = n.name })

  const pendingCount = Object.values(requests).filter(r => r.status === 'pending').length

  const tabStyle = (tab) => ({
    padding: '0.6rem 1.2rem',
    background: activeTab === tab ? '#4A6741' : 'white',
    color: activeTab === tab ? 'white' : '#4A6741',
    border: '1px solid #4A6741',
    borderRadius: '6px', fontWeight: 'bold',
    cursor: 'pointer', fontSize: '0.85rem',
    position: 'relative'
  })

  return (
    <div style={{ minHeight: '100vh', background: '#f0f4ee', fontFamily: 'Arial, sans-serif' }}>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: '1rem', right: '1rem', zIndex: 1000,
          background: toast.type === 'error' ? '#dc3545' : '#4A6741',
          color: 'white', padding: '0.75rem 1.25rem',
          borderRadius: '8px', fontWeight: 'bold', fontSize: '0.9rem',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
        }}>{toast.msg}</div>
      )}

      {/* Header */}
      <div style={{
        background: '#4A6741', padding: '1rem 1.5rem',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
      }}>
        <div>
          <div style={{ color: 'white', fontWeight: 'bold', fontSize: '1rem' }}>Rocky Mountain</div>
          <div style={{ color: '#c5d9c0', fontSize: '0.75rem', letterSpacing: '0.1em' }}>TREATMENT CENTER — MANAGER</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ color: 'white', fontSize: '0.9rem' }}>{nurse.name}</div>
          <button onClick={onLogout} style={{
            background: 'transparent', border: '1px solid #c5d9c0',
            color: '#c5d9c0', borderRadius: '4px',
            padding: '0.2rem 0.6rem', fontSize: '0.75rem',
            cursor: 'pointer', marginTop: '0.25rem'
          }}>Log Out</button>
        </div>
      </div>

      {/* Stats bar */}
      <div style={{
        display: 'flex', gap: '1rem', padding: '0.75rem 1.5rem',
        background: 'white', borderBottom: '1px solid #ddd', flexWrap: 'wrap'
      }}>
        {[
          { label: 'Nurses', value: nurses.length },
          { label: 'Pending Requests', value: pendingCount },
          { label: 'Approved This Month', value: Object.values(requests).filter(r => {
            const d = new Date(r.date + 'T12:00:00')
            return r.status === 'approved' && d.getMonth() === currentMonth
          }).length },
        ].map(s => (
          <div key={s.label} style={{
            background: '#f0f4ee', borderRadius: '8px',
            padding: '0.5rem 1rem', textAlign: 'center'
          }}>
            <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#4A6741' }}>{s.value}</div>
            <div style={{ fontSize: '0.72rem', color: '#666' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: '0.5rem', padding: '0.75rem 1rem',
        background: 'white', borderBottom: '1px solid #ddd', flexWrap: 'wrap'
      }}>
        <button style={tabStyle('schedule')} onClick={() => setActiveTab('schedule')}>Schedule</button>
        <button style={tabStyle('requests')} onClick={() => setActiveTab('requests')}>
          Requests {pendingCount > 0 && (
            <span style={{
              background: '#dc3545', color: 'white', borderRadius: '50%',
              fontSize: '0.65rem', padding: '1px 5px', marginLeft: '4px'
            }}>{pendingCount}</span>
          )}
        </button>
        <button style={tabStyle('nurses')} onClick={() => setActiveTab('nurses')}>Nurses</button>
        <button style={tabStyle('export')} onClick={() => setActiveTab('export')}>Export</button>
      </div>

      {/* Month nav */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0.75rem 1.5rem', background: 'white', borderBottom: '1px solid #ddd'
      }}>
        <button onClick={() => setCurrentMonth(m => Math.max(0, m - 1))}
          disabled={currentMonth === 0}
          style={{ background: 'none', border: 'none', fontSize: '1.5rem',
            cursor: currentMonth === 0 ? 'not-allowed' : 'pointer',
            color: currentMonth === 0 ? '#ccc' : '#4A6741' }}>‹</button>
        <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: '#4A6741' }}>
          {MONTHS[currentMonth]} {currentYear}
        </div>
        <button onClick={() => setCurrentMonth(m => Math.min(11, m + 1))}
          disabled={currentMonth === 11}
          style={{ background: 'none', border: 'none', fontSize: '1.5rem',
            cursor: currentMonth === 11 ? 'not-allowed' : 'pointer',
            color: currentMonth === 11 ? '#ccc' : '#4A6741' }}>›</button>
      </div>

      {/* ── SCHEDULE TAB ── */}
      {activeTab === 'schedule' && (
        <div style={{ padding: '1rem', overflowX: 'auto' }}>
          <p style={{ fontSize: '0.8rem', color: '#666', marginBottom: '0.75rem' }}>
            Tap any cell to edit a shift. Changes save instantly.
          </p>

          {/* Legend */}
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
            {Object.entries(SHIFT_COLORS).map(([key, val]) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <div style={{ width: '12px', height: '12px', background: val.bg, borderRadius: '2px' }} />
                <span style={{ fontSize: '0.72rem', color: '#555' }}>{val.label}</span>
              </div>
            ))}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <div style={{ width: '12px', height: '12px', background: '#ffc107', borderRadius: '2px' }} />
              <span style={{ fontSize: '0.72rem', color: '#555' }}>Requested Off</span>
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>Loading...</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', fontSize: '0.75rem', minWidth: '600px' }}>
                <thead>
                  <tr>
                    <th style={{
                      padding: '0.4rem 0.6rem', background: '#4A6741', color: 'white',
                      textAlign: 'left', position: 'sticky', left: 0, zIndex: 1, minWidth: '100px'
                    }}>Nurse</th>
                    {days.map(d => (
                      <th key={d} style={{
                        padding: '0.4rem 0.3rem', background: '#4A6741', color: 'white',
                        textAlign: 'center', minWidth: '28px'
                      }}>{d}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {nurses.map((n, ni) => {
                    const isPartial = n.shift_start && n.shift_end
                    const rowBg = ni % 2 === 0 ? '#f9f9f9' : 'white'
                    return (
                      <tr key={n.id}>
                        <td style={{
                          padding: '0.4rem 0.6rem', background: rowBg,
                          position: 'sticky', left: 0, zIndex: 1, borderRight: '2px solid #ddd'
                        }}>
                          <div style={{ fontWeight: 'bold', color: '#333' }}>{n.name}</div>
                          {isPartial && (
                            <div style={{ fontSize: '0.65rem', color: '#4A6741' }}>
                              {n.shift_start}–{n.shift_end}
                            </div>
                          )}
                        </td>
                        {days.map(day => {
                          const shift = schedule[n.id]?.[day]
                          const hasPending = Object.values(requests).some(r => {
                            const d = new Date(r.date + 'T12:00:00')
                            return r.nurse_id === n.id && d.getDate() === day &&
                              d.getMonth() === currentMonth && r.status === 'pending'
                          })

                          let bg = rowBg, color = '#ccc', label = ''
                          if (hasPending) { bg = '#ffc107'; color = '#333'; label = 'Req' }
                          else if (shift && shift !== 'O') {
                            bg = SHIFT_COLORS[shift].bg
                            color = SHIFT_COLORS[shift].color
                            label = shift
                          }

                          return (
                            <td key={day}
                              onClick={() => handleCellClick(n.id, day)}
                              style={{
                                padding: '0.3rem', background: bg, color,
                                textAlign: 'center', fontWeight: 'bold',
                                fontSize: '0.7rem', border: '1px solid #eee',
                                cursor: 'pointer', userSelect: 'none'
                              }}
                              title="Click to edit"
                            >{label}</td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── REQUESTS TAB ── */}
      {activeTab === 'requests' && (
        <div style={{ padding: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            {['pending','approved','denied','all'].map(f => (
              <button key={f} onClick={() => setRequestFilter(f)} style={{
                padding: '0.4rem 0.9rem',
                background: requestFilter === f ? '#4A6741' : 'white',
                color: requestFilter === f ? 'white' : '#4A6741',
                border: '1px solid #4A6741', borderRadius: '20px',
                cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold',
                textTransform: 'capitalize'
              }}>{f}</button>
            ))}
          </div>

          {requestList.length === 0 && (
            <div style={{ color: '#888', fontSize: '0.85rem' }}>No {requestFilter} requests.</div>
          )}

          {requestList.map(req => (
            <RequestCard
              key={req.id}
              req={req}
              nurseName={nurseMap[req.nurse_id] || 'Unknown'}
              onAction={handleRequest}
            />
          ))}
        </div>
      )}

      {/* ── NURSES TAB ── */}
      {activeTab === 'nurses' && (
        <div style={{ padding: '1rem' }}>

          {/* Add nurse */}
          <div style={{
            background: 'white', borderRadius: '10px', padding: '1rem',
            marginBottom: '1rem', boxShadow: '0 1px 4px rgba(0,0,0,0.08)'
          }}>
            <h3 style={{ color: '#4A6741', marginBottom: '0.75rem', fontSize: '1rem' }}>
              Add New Nurse
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <input
                placeholder="Full name"
                value={newNurseName}
                onChange={e => setNewNurseName(e.target.value)}
                style={inputStyle}
              />
              <input
                placeholder="4-digit PIN"
                value={newNursePin}
                onChange={e => setNewNursePin(e.target.value.replace(/\D/g,'').slice(0,4))}
                style={inputStyle}
                maxLength={4}
              />
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  placeholder="Shift start (e.g. 7:30) — optional"
                  value={newNurseStart}
                  onChange={e => setNewNurseStart(e.target.value)}
                  style={{ ...inputStyle, flex: 1 }}
                />
                <input
                  placeholder="Shift end (e.g. 5:30) — optional"
                  value={newNurseEnd}
                  onChange={e => setNewNurseEnd(e.target.value)}
                  style={{ ...inputStyle, flex: 1 }}
                />
              </div>
              <button onClick={addNurse} style={{
                background: '#4A6741', color: 'white', border: 'none',
                borderRadius: '8px', padding: '0.6rem', fontWeight: 'bold',
                cursor: 'pointer', fontSize: '0.9rem'
              }}>+ Add Nurse</button>
            </div>
          </div>

          {/* Roster */}
          <h3 style={{ color: '#4A6741', marginBottom: '0.5rem', fontSize: '1rem' }}>
            Current Roster
          </h3>
          {nurses.map(n => (
            <div key={n.id} style={{
              background: 'white', borderRadius: '8px', padding: '0.75rem 1rem',
              marginBottom: '0.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <div>
                <div style={{ fontWeight: 'bold', color: '#333' }}>{n.name}</div>
                {n.shift_start && (
                  <div style={{ fontSize: '0.75rem', color: '#4A6741' }}>
                    {n.shift_start}–{n.shift_end}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={() => { setResetPinNurse(n); setResetPinValue('') }}
                  style={{
                    background: '#EBF2E8', color: '#4A6741',
                    border: '1px solid #4A6741', borderRadius: '6px',
                    padding: '0.3rem 0.7rem', fontSize: '0.78rem',
                    cursor: 'pointer', fontWeight: 'bold'
                  }}>Reset PIN</button>
                <button
                  onClick={() => removeNurse(n.id, n.name)}
                  style={{
                    background: '#fff0f0', color: '#dc3545',
                    border: '1px solid #dc3545', borderRadius: '6px',
                    padding: '0.3rem 0.7rem', fontSize: '0.78rem',
                    cursor: 'pointer', fontWeight: 'bold'
                  }}>Remove</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── EXPORT TAB ── */}
      {activeTab === 'export' && (
        <div style={{ padding: '1rem' }}>

          {/* CSV Export */}
          <div style={{
            background: 'white', borderRadius: '10px', padding: '1.5rem',
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)', textAlign: 'center',
            marginBottom: '1rem'
          }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📋</div>
            <h3 style={{ color: '#4A6741', marginBottom: '0.5rem' }}>
              Export {MONTHS[currentMonth]} Requests
            </h3>
            <p style={{ color: '#666', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
              Downloads a CSV file with all requests for the selected month
              including nurse name, date, leave type, status, and manager notes.
            </p>
            <button onClick={exportCSV} style={{
              background: '#4A6741', color: 'white', border: 'none',
              borderRadius: '8px', padding: '0.75rem 2rem',
              fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer'
            }}>
              Download CSV
            </button>
          </div>

          {/* Print Schedule */}
          <div style={{
            background: 'white', borderRadius: '10px', padding: '1.5rem',
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)', textAlign: 'center'
          }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🖨️</div>
            <h3 style={{ color: '#4A6741', marginBottom: '0.5rem' }}>
              Print {MONTHS[currentMonth]} Team Schedule
            </h3>
            <p style={{ color: '#666', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
              Prints a clean landscape view of the full team grid —
              ready to post in the break room or keep on file.
            </p>
            <button onClick={() => window.print()} style={{
              background: '#4A6741', color: 'white', border: 'none',
              borderRadius: '8px', padding: '0.75rem 2rem',
              fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer'
            }}>
              Print Schedule
            </button>
          </div>

        </div>
      )}


      {/* ── EDIT CELL MODAL ── */}
      {editCell && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500
        }}>
          <div style={{
            background: 'white', borderRadius: '12px', padding: '1.5rem',
            width: '90%', maxWidth: '320px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
          }}>
            <h3 style={{ color: '#4A6741', marginBottom: '0.25rem' }}>
              Edit Shift
            </h3>
            <p style={{ color: '#666', fontSize: '0.85rem', marginBottom: '1rem' }}>
              {nurseMap[editCell.nurseId]} — Day {editCell.day}
            </p>

            {editCell.existingReq && (
              <div style={{
                background: '#fff3cd', border: '1px solid #ffc107',
                borderRadius: '8px', padding: '0.75rem',
                marginBottom: '1rem', fontSize: '0.85rem', color: '#856404'
              }}>
                ⚠️ This nurse has a pending time-off request for this day.
                Saving a shift change will not cancel the request — handle it in the Requests tab.
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '1rem' }}>
              {Object.entries(SHIFT_COLORS).map(([key, val]) => (
                <button key={key}
                  onClick={() => saveShift(key)}
                  disabled={saving}
                  style={{
                    background: val.bg, color: val.color,
                    border: 'none', borderRadius: '8px',
                    padding: '0.75rem', fontWeight: 'bold',
                    fontSize: '1rem', cursor: 'pointer'
                  }}>{val.label}</button>
              ))}
            </div>

            <button onClick={() => setEditCell(null)} style={{
              width: '100%', background: 'white', color: '#666',
              border: '1px solid #ddd', borderRadius: '8px',
              padding: '0.6rem', cursor: 'pointer', fontSize: '0.9rem'
            }}>Cancel</button>
          </div>
        </div>
      )}

      {/* ── RESET PIN MODAL ── */}
      {resetPinNurse && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500
        }}>
          <div style={{
            background: 'white', borderRadius: '12px', padding: '1.5rem',
            width: '90%', maxWidth: '300px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
          }}>
            <h3 style={{ color: '#4A6741', marginBottom: '0.25rem' }}>Reset PIN</h3>
            <p style={{ color: '#666', fontSize: '0.85rem', marginBottom: '1rem' }}>
              {resetPinNurse.name}
            </p>
            <input
              placeholder="New 4-digit PIN"
              value={resetPinValue}
              onChange={e => setResetPinValue(e.target.value.replace(/\D/g,'').slice(0,4))}
              maxLength={4}
              style={{ ...inputStyle, marginBottom: '0.75rem', textAlign: 'center',
                fontSize: '1.5rem', letterSpacing: '0.5rem' }}
            />
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={resetPin} style={{
                flex: 1, background: '#4A6741', color: 'white', border: 'none',
                borderRadius: '8px', padding: '0.6rem', fontWeight: 'bold',
                cursor: 'pointer'
              }}>Save</button>
              <button onClick={() => { setResetPinNurse(null); setResetPinValue('') }} style={{
                flex: 1, background: 'white', color: '#666', border: '1px solid #ddd',
                borderRadius: '8px', padding: '0.6rem', cursor: 'pointer'
              }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Request Card Component ────────────────────────────────────
function RequestCard({ req, nurseName, onAction }) {
  const [reason, setReason] = useState('')
  const [expanded, setExpanded] = useState(false)

  const statusColors = {
    pending: { bg: '#fff3cd', color: '#856404' },
    approved: { bg: '#d4edda', color: '#155724' },
    denied: { bg: '#f8d7da', color: '#721c24' },
  }
  const c = statusColors[req.status]

  return (
    <div style={{
      background: 'white', borderRadius: '10px', marginBottom: '0.75rem',
      padding: '1rem', boxShadow: '0 1px 4px rgba(0,0,0,0.08)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontWeight: 'bold', color: '#333', fontSize: '0.95rem' }}>{nurseName}</div>
          <div style={{ color: '#555', fontSize: '0.85rem' }}>
            {new Date(req.date + 'T12:00:00').toLocaleDateString('en-US', {
              weekday: 'short', month: 'short', day: 'numeric'
            })}
          </div>
          <div style={{ color: '#888', fontSize: '0.8rem' }}>{req.leave_type}</div>
          {req.note && (
            <div style={{ fontSize: '0.8rem', color: '#555', marginTop: '0.25rem',
              background: '#f8f8f8', padding: '0.3rem 0.5rem', borderRadius: '4px' }}>
              💬 {req.note}
            </div>
          )}
        </div>
        <span style={{
          background: c.bg, color: c.color, borderRadius: '20px',
          padding: '0.2rem 0.75rem', fontSize: '0.8rem',
          fontWeight: 'bold', textTransform: 'capitalize', whiteSpace: 'nowrap'
        }}>{req.status}</span>
      </div>

      {req.status === 'pending' && (
        <div style={{ marginTop: '0.75rem' }}>
          <textarea
            placeholder="Reason (optional)"
            value={reason}
            onChange={e => setReason(e.target.value)}
            rows={2}
            style={{
              width: '100%', borderRadius: '6px', border: '1px solid #ddd',
              padding: '0.5rem', fontSize: '0.85rem', resize: 'vertical',
              boxSizing: 'border-box', marginBottom: '0.5rem',
              fontFamily: 'Arial, sans-serif'
            }}
          />
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={() => onAction(req.id, 'approved', reason)} style={{
              flex: 1, background: '#4A6741', color: 'white', border: 'none',
              borderRadius: '8px', padding: '0.5rem', fontWeight: 'bold',
              cursor: 'pointer', fontSize: '0.85rem'
            }}>✓ Approve</button>
            <button onClick={() => onAction(req.id, 'denied', reason)} style={{
              flex: 1, background: '#dc3545', color: 'white', border: 'none',
              borderRadius: '8px', padding: '0.5rem', fontWeight: 'bold',
              cursor: 'pointer', fontSize: '0.85rem'
            }}>✗ Deny</button>
          </div>
        </div>
      )}

      {req.manager_reason && (
        <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#666',
          background: '#f8f8f8', padding: '0.3rem 0.5rem', borderRadius: '4px' }}>
          📋 {req.manager_reason}
        </div>
      )}
    </div>
  )
}

const inputStyle = {
  width: '100%', padding: '0.6rem 0.75rem',
  border: '1px solid #ddd', borderRadius: '8px',
  fontSize: '0.9rem', boxSizing: 'border-box',
  fontFamily: 'Arial, sans-serif', outline: 'none'
}
