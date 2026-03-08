import { useState } from 'react'
import { supabase } from './supabase'

export default function PTORequest({ nurse, onClose }) {
  const [requestType, setRequestType] = useState('single')
  const [singleDate, setSingleDate] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [leaveType, setLeaveType] = useState('PTO')
  const [note, setNote] = useState('')
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(false)

  const today = new Date()

  function getDatesInRange(start, end) {
    const dates = []
    const current = new Date(start + 'T12:00:00')
    const last = new Date(end + 'T12:00:00')
    while (current <= last) {
      dates.push(current.toISOString().split('T')[0])
      current.setDate(current.getDate() + 1)
    }
    return dates
  }

  function checkDeadline(dateStr) {
    const requestMonth = new Date(dateStr + 'T12:00:00').getMonth()
    return today.getDate() > 15 && today.getMonth() === requestMonth
  }

  const deadlinePassed = requestType === 'single'
    ? (singleDate ? checkDeadline(singleDate) : false)
    : (startDate ? checkDeadline(startDate) : false)

  const dateCount = requestType === 'range' && startDate && endDate
    ? getDatesInRange(startDate, endDate).length
    : null

  async function handleSubmit() {
    if (requestType === 'single' && !singleDate) {
      setStatus({ type: 'error', msg: 'Please select a date.' })
      return
    }
    if (requestType === 'range' && (!startDate || !endDate)) {
      setStatus({ type: 'error', msg: 'Please select a start and end date.' })
      return
    }
    if (requestType === 'range' && startDate > endDate) {
      setStatus({ type: 'error', msg: 'End date must be after start date.' })
      return
    }

    setLoading(true)
    setStatus(null)

    const dates = requestType === 'single'
      ? [singleDate]
      : getDatesInRange(startDate, endDate)

    const rows = dates.map(date => ({
      nurse_id: nurse.id,
      date,
      leave_type: leaveType,
      note: note || null,
      status: 'pending'
    }))

    const { error } = await supabase
      .from('pto_requests')
      .insert(rows)

    setLoading(false)

    if (error) {
      setStatus({ type: 'error', msg: 'Something went wrong. Please try again.' })
    } else {
      const msg = dates.length === 1
        ? 'Request submitted!'
        : `${dates.length} days submitted!`
      setStatus({ type: 'success', msg })
      setTimeout(() => onClose(), 1500)
    }
  }

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: '1rem'
    }}>
      <div style={{
        background: 'white', borderRadius: '12px',
        width: '100%', maxWidth: '400px',
        overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
      }}>
        {/* Header */}
        <div style={{
          background: '#4A6741', padding: '1.25rem 1.5rem',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <h2 style={{ color: 'white', margin: 0, fontSize: '1.1rem' }}>
            Request Time Off
          </h2>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: 'white',
            fontSize: '1.5rem', cursor: 'pointer', lineHeight: 1
          }}>×</button>
        </div>

        <div style={{ padding: '1.5rem' }}>

          {/* Single vs Range toggle */}
          <div style={{
            display: 'flex', marginBottom: '1.25rem',
            border: '1px solid #ddd', borderRadius: '8px', overflow: 'hidden'
          }}>
            {['single', 'range'].map(type => (
              <button
                key={type}
                onClick={() => setRequestType(type)}
                style={{
                  flex: 1, padding: '0.6rem',
                  background: requestType === type ? '#4A6741' : 'white',
                  color: requestType === type ? 'white' : '#333',
                  border: 'none', cursor: 'pointer',
                  fontWeight: requestType === type ? 'bold' : 'normal',
                  fontSize: '0.9rem'
                }}
              >
                {type === 'single' ? 'Single Day' : 'Date Range'}
              </button>
            ))}
          </div>

          {/* Deadline warning */}
          {deadlinePassed && (
            <div style={{
              background: '#fff3cd', border: '1px solid #ffc107',
              borderRadius: '8px', padding: '0.75rem', marginBottom: '1rem',
              fontSize: '0.85rem', color: '#856404'
            }}>
              ⚠️ The request deadline for this month has passed. Your request will be reviewed at manager discretion.
            </div>
          )}

          {/* Single date */}
          {requestType === 'single' && (
            <div style={{ marginBottom: '1rem' }}>
              <label style={{
                display: 'block', marginBottom: '0.4rem',
                fontWeight: 'bold', color: '#333', fontSize: '0.9rem'
              }}>Date Requested</label>
              <input
                type='date'
                value={singleDate}
                onChange={e => setSingleDate(e.target.value)}
                style={{
                  width: '100%', padding: '0.75rem',
                  borderRadius: '8px', border: '1px solid #ccc',
                  fontSize: '1rem', boxSizing: 'border-box'
                }}
              />
            </div>
          )}

          {/* Date range */}
          {requestType === 'range' && (
            <>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{
                  display: 'block', marginBottom: '0.4rem',
                  fontWeight: 'bold', color: '#333', fontSize: '0.9rem'
                }}>Start Date</label>
                <input
                  type='date'
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  style={{
                    width: '100%', padding: '0.75rem',
                    borderRadius: '8px', border: '1px solid #ccc',
                    fontSize: '1rem', boxSizing: 'border-box'
                  }}
                />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{
                  display: 'block', marginBottom: '0.4rem',
                  fontWeight: 'bold', color: '#333', fontSize: '0.9rem'
                }}>End Date</label>
                <input
                  type='date'
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  style={{
                    width: '100%', padding: '0.75rem',
                    borderRadius: '8px', border: '1px solid #ccc',
                    fontSize: '1rem', boxSizing: 'border-box'
                  }}
                />
              </div>
              {dateCount && (
                <div style={{
                  background: '#EBF2E8', borderRadius: '8px',
                  padding: '0.5rem 0.75rem', marginBottom: '1rem',
                  fontSize: '0.85rem', color: '#4A6741', fontWeight: 'bold'
                }}>
                  📅 {dateCount} day{dateCount !== 1 ? 's' : ''} selected
                </div>
              )}
            </>
          )}

          {/* Leave type */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{
              display: 'block', marginBottom: '0.4rem',
              fontWeight: 'bold', color: '#333', fontSize: '0.9rem'
            }}>Leave Type</label>
            <select
              value={leaveType}
              onChange={e => setLeaveType(e.target.value)}
              style={{
                width: '100%', padding: '0.75rem',
                borderRadius: '8px', border: '1px solid #ccc',
                fontSize: '1rem', background: 'white', boxSizing: 'border-box'
              }}
            >
              <option value='PTO'>PTO</option>
              <option value='FMLA'>FMLA</option>
              <option value='Other'>Other</option>
            </select>
          </div>

          {/* Note */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{
              display: 'block', marginBottom: '0.4rem',
              fontWeight: 'bold', color: '#333', fontSize: '0.9rem'
            }}>Note to Manager <span style={{ fontWeight: 'normal', color: '#888' }}>(optional)</span></label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder='Any context for your request...'
              rows={3}
              style={{
                width: '100%', padding: '0.75rem',
                borderRadius: '8px', border: '1px solid #ccc',
                fontSize: '0.95rem', boxSizing: 'border-box',
                resize: 'vertical', fontFamily: 'Arial'
              }}
            />
          </div>

          {/* Status */}
          {status && (
            <div style={{
              padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem',
              background: status.type === 'success' ? '#d4edda' : '#f8d7da',
              color: status.type === 'success' ? '#155724' : '#721c24',
              fontSize: '0.9rem', textAlign: 'center'
            }}>
              {status.msg}
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{
              width: '100%', padding: '0.85rem',
              background: loading ? '#aaa' : '#4A6741',
              color: 'white', border: 'none', borderRadius: '8px',
              fontSize: '1rem', fontWeight: 'bold',
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? 'Submitting...' : 'Submit Request'}
          </button>
        </div>
      </div>
    </div>
  )
}
