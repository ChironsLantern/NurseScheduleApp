import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import PTORequest from './PTORequest'
import TeamView from './TeamView'

const SHIFT_COLORS = {
  D: { bg: '#4A6741', color: 'white', label: 'Day' },
  N: { bg: '#1a2a4a', color: 'white', label: 'Night' },
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
  const [showPTO, setShowPTO] = useState(false)
  const [showTeam, setShowTeam] = useState(false)
  const [myRequests, setMyRequests] = useState([])
  const [showPinChange, setShowPinChange] = useState(false)
  const [pinChangeStep, setPinChangeStep] = useState(1)
  const [currentPinInput, setCurrentPinInput] = useState('')
  const [newPinInput, setNewPinInput] = useState('')
  const [confirmPinInput, setConfirmPinInput] = useState('')
  const [pinError, setPinError] = useState('')
  const [pinSuccess, setPinSuccess] = useState(false)

  useEffect(() => {
    fetchSchedule()
  }, [currentMonth, nurse])

  async function fetchSchedule() {
    setLoading(true)
    try {
      const [scheduleRes, requestRes] = await Promise.all([
        supabase
          .from('schedule')
          .select('*')
          .eq('nurse_id', nurse.id)
          .eq('year', currentYear)
          .eq('month', currentMonth + 1),
        supabase
          .from('pto_requests')
          .select('*')
          .eq('nurse_id', nurse.id)
          .order('date', { ascending: true })
      ])

      if (scheduleRes.data) {
        const map = {}
        scheduleRes.data.forEach(row => { map[row.day] = row.shift_type })
        setScheduleData(map)
      }

      if (requestRes.data) {
        setMyRequests(requestRes.data)
      }
    } catch (err) {
      console.error('Fetch error:', err)
    } finally {
      setLoading(false)
    }
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
          <div style={{ color: 'white', fontSize: '0.9rem' }}>{nurse.name}</div>
          <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.25rem', justifyContent: 'flex-end' }}>
            <button
              onClick={() => setShowPinChange(true)}
              style={{
                background: 'transparent', border: '1px solid #c5d9c0',
                color: '#c5d9c0', borderRadius: '4px',
                padding: '0.2rem 0.6rem', fontSize: '0.75rem',
                cursor: 'pointer'
              }}
            >Change PIN</button>
            <button
              onClick={onLogout}
              style={{
                background: 'transparent', border: '1px solid #c5d9c0',
                color: '#c5d9c0', borderRadius: '4px',
                padding: '0.2rem 0.6rem', fontSize: '0.75rem',
                cursor: 'pointer'
              }}
            >Log Out</button>
          </div>
        </div>
      </div>

      {/* Month navigation */}
      <div style={{
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between',
        padding: '1rem 1.5rem',
        background: 'white', borderBottom: '1px solid #ddd'
      }}>
        <button
          onClick={() => setCurrentMonth(m => Math.max(0, m - 1))}
          disabled={currentMonth === 0}
          style={{
            background: 'none', border: 'none', fontSize: '1.5rem',
            cursor: currentMonth === 0 ? 'not-allowed' : 'pointer',
            color: currentMonth === 0 ? '#ccc' : '#4A6741'
          }}
        >‹</button>
        <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: '#4A6741' }}>
          {MONTHS[currentMonth]} {currentYear}
        </div>
        <button
          onClick={() => setCurrentMonth(m => Math.min(11, m + 1))}
          disabled={currentMonth === 11}
          style={{
            background: 'none', border: 'none', fontSize: '1.5rem',
            cursor: currentMonth === 11 ? 'not-allowed' : 'pointer',
            color: currentMonth === 11 ? '#ccc' : '#4A6741'
          }}
        >›</button>
      </div>

      {/* Legend */}
      <div style={{
        display: 'flex', gap: '0.5rem',
        padding: '0.75rem 1.5rem',
        background: 'white', borderBottom: '1px solid #ddd',
        flexWrap: 'wrap'
      }}>
        {Object.entries(SHIFT_COLORS).map(([key, val]) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <div style={{
              width: '14px', height: '14px',
              background: val.bg, borderRadius: '3px',
              border: '1px solid #ddd'
            }} />
            <span style={{ fontSize: '0.75rem', color: '#666' }}>{val.label}</span>
          </div>
        ))}
      </div>

      {/* Toggle buttons */}
      <div style={{
        padding: '0.75rem 1rem',
        background: 'white', borderBottom: '1px solid #ddd',
        display: 'flex', gap: '0.5rem'
      }}>
        <button
          onClick={() => setShowTeam(false)}
          style={{
            flex: 1, padding: '0.5rem',
            background: !showTeam ? '#4A6741' : 'white',
            color: !showTeam ? 'white' : '#4A6741',
            border: '1px solid #4A6741',
            borderRadius: '6px', fontWeight: 'bold',
            cursor: 'pointer', fontSize: '0.85rem'
          }}
        >My Schedule</button>
        <button
          onClick={() => setShowTeam(true)}
          style={{
            flex: 1, padding: '0.5rem',
            background: showTeam ? '#4A6741' : 'white',
            color: showTeam ? 'white' : '#4A6741',
            border: '1px solid #4A6741',
            borderRadius: '6px', fontWeight: 'bold',
            cursor: 'pointer', fontSize: '0.85rem'
          }}
        >Team View</button>
        {!showTeam && (
          <button
            onClick={() => setShowPTO(true)}
            style={{
              flex: 1, padding: '0.5rem',
              background: '#EBF2E8', color: '#4A6741',
              border: '1px solid #4A6741',
              borderRadius: '6px', fontWeight: 'bold',
              cursor: 'pointer', fontSize: '0.85rem'
            }}
          >+ Request Off</button>
        )}
      </div>

      {/* My Schedule or Team View */}
      {showTeam ? (
        <TeamView currentMonth={currentMonth} currentYear={currentYear} />
      ) : (
        <div>
          {/* Calendar grid */}
          <div style={{ padding: '1rem' }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              gap: '2px', marginBottom: '2px'
            }}>
              {DAYS_OF_WEEK.map(d => (
                <div key={d} style={{
                  textAlign: 'center', fontSize: '0.75rem',
                  fontWeight: 'bold', color: '#666', padding: '0.25rem'
                }}>{d}</div>
              ))}
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', color: '#666', padding: '2rem' }}>
                Loading schedule...
              </div>
            ) : (
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
                      borderRadius: '6px', padding: '0.4rem 0.2rem',
                      textAlign: 'center', minHeight: '48px',
                      display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center',
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
            )}
          </div>

          {/* My Requests */}
          <div style={{ padding: '1rem', paddingTop: 0 }}>
            <h3 style={{ color: '#4A6741', marginBottom: '0.5rem', fontSize: '1rem' }}>
              My Requests
            </h3>
            {myRequests.length === 0 && (
              <div style={{ color: '#888', fontSize: '0.85rem' }}>
                No requests submitted yet.
              </div>
            )}
            {myRequests.map(req => {
              const colors = {
                pending: { bg: '#fff3cd', color: '#856404' },
                approved: { bg: '#d4edda', color: '#155724' },
                denied: { bg: '#f8d7da', color: '#721c24' },
              }
              const c = colors[req.status]
              return (
                <div key={req.id} style={{
                  background: 'white', borderRadius: '8px',
                  marginBottom: '0.5rem', padding: '0.75rem 1rem',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                  display: 'flex', justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <div style={{ fontWeight: 'bold', fontSize: '0.9rem', color: '#333' }}>
                      {new Date(req.date + 'T12:00:00').toLocaleDateString('en-US', {
                        weekday: 'short', month: 'short', day: 'numeric'
                      })}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#666' }}>{req.leave_type}</div>
                    {req.manager_reason && (
                      <div style={{ fontSize: '0.8rem', color: '#888', marginTop: '0.2rem' }}>
                        📋 {req.manager_reason}
                      </div>
                    )}
                  </div>
                  <span style={{
                    background: c.bg, color: c.color,
                    borderRadius: '20px', padding: '0.2rem 0.75rem',
                    fontSize: '0.8rem', fontWeight: 'bold',
                    textTransform: 'capitalize'
                  }}>{req.status}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* PTO Modal */}
      {showPTO && (
        <PTORequest
          nurse={nurse}
          onClose={() => {
            setShowPTO(false)
            fetchSchedule()
          }}
        />
      )}

      {/* Change PIN Modal */}
      {showPinChange && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500
        }}>
          <div style={{
            background: 'white', borderRadius: '12px', padding: '1.5rem',
            width: '90%', maxWidth: '300px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
          }}>
            {pinSuccess ? (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>✅</div>
                <h3 style={{ color: '#4A6741', marginBottom: '0.5rem' }}>PIN Updated!</h3>
                <p style={{ color: '#666', fontSize: '0.85rem', marginBottom: '1rem' }}>
                  Your new PIN is active next time you log in.
                </p>
                <button onClick={() => {
                  setShowPinChange(false)
                  setPinChangeStep(1)
                  setCurrentPinInput('')
                  setNewPinInput('')
                  setConfirmPinInput('')
                  setPinError('')
                  setPinSuccess(false)
                }} style={{
                  background: '#4A6741', color: 'white', border: 'none',
                  borderRadius: '8px', padding: '0.6rem 1.5rem',
                  fontWeight: 'bold', cursor: 'pointer'
                }}>Done</button>
              </div>
            ) : (
              <>
                <h3 style={{ color: '#4A6741', marginBottom: '0.25rem' }}>Change PIN</h3>
                <p style={{ color: '#666', fontSize: '0.85rem', marginBottom: '1rem' }}>
                  {pinChangeStep === 1 && 'Enter your current PIN to continue.'}
                  {pinChangeStep === 2 && 'Enter your new 4-digit PIN.'}
                  {pinChangeStep === 3 && 'Confirm your new PIN.'}
                </p>

                {pinError && (
                  <div style={{
                    background: '#f8d7da', color: '#721c24', borderRadius: '6px',
                    padding: '0.5rem 0.75rem', fontSize: '0.82rem', marginBottom: '0.75rem'
                  }}>{pinError}</div>
                )}

                <input
                  type="password"
                  placeholder={
                    pinChangeStep === 1 ? 'Current PIN' :
                    pinChangeStep === 2 ? 'New PIN' : 'Confirm new PIN'
                  }
                  maxLength={4}
                  value={
                    pinChangeStep === 1 ? currentPinInput :
                    pinChangeStep === 2 ? newPinInput : confirmPinInput
                  }
                  onChange={e => {
                    const val = e.target.value.replace(/\D/g,'').slice(0,4)
                    setPinError('')
                    if (pinChangeStep === 1) setCurrentPinInput(val)
                    else if (pinChangeStep === 2) setNewPinInput(val)
                    else setConfirmPinInput(val)
                  }}
                  style={{
                    width: '100%', padding: '0.75rem',
                    border: '1px solid #ddd', borderRadius: '8px',
                    fontSize: '1.5rem', letterSpacing: '0.5rem',
                    textAlign: 'center', boxSizing: 'border-box',
                    marginBottom: '0.75rem', fontFamily: 'Arial, sans-serif'
                  }}
                />

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={async () => {
                    setPinError('')
                    if (pinChangeStep === 1) {
                      if (currentPinInput !== nurse.pin) {
                        setPinError('Incorrect current PIN.'); return
                      }
                      setPinChangeStep(2)
                      setCurrentPinInput('')
                    } else if (pinChangeStep === 2) {
                      if (newPinInput.length !== 4) {
                        setPinError('PIN must be 4 digits.'); return
                      }
                      setPinChangeStep(3)
                    } else {
                      if (confirmPinInput !== newPinInput) {
                        setPinError('PINs do not match.'); return
                      }
                      const { error } = await supabase
                        .from('nurses')
                        .update({ pin: newPinInput })
                        .eq('id', nurse.id)
                      if (error) { setPinError('Error saving PIN.'); return }
                      setPinSuccess(true)
                    }
                  }} style={{
                    flex: 1, background: '#4A6741', color: 'white', border: 'none',
                    borderRadius: '8px', padding: '0.6rem', fontWeight: 'bold',
                    cursor: 'pointer'
                  }}>
                    {pinChangeStep === 3 ? 'Save' : 'Next →'}
                  </button>
                  <button onClick={() => {
                    setShowPinChange(false)
                    setPinChangeStep(1)
                    setCurrentPinInput('')
                    setNewPinInput('')
                    setConfirmPinInput('')
                    setPinError('')
                    setPinSuccess(false)
                  }} style={{
                    flex: 1, background: 'white', color: '#666',
                    border: '1px solid #ddd', borderRadius: '8px',
                    padding: '0.6rem', cursor: 'pointer'
                  }}>Cancel</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

    </div>
  )
}
