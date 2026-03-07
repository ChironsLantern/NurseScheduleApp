import { useState } from 'react'
import { supabase } from './supabase'

const NURSE_NAMES = [
  'Annie', 'Lori', 'Jenni', 'Amber', 'Brent',
  'Sam', 'Tina', 'Kat', 'Cody', 'Jamie', 'Kelly'
]

export default function Login({ onLogin }) {
  const [name, setName] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin() {
    if (!name || !pin) {
      setError('Please select your name and enter your PIN.')
      return
    }
    setLoading(true)
    setError('')

    const { data, error } = await supabase
      .from('nurses')
      .select('*')
      .eq('name', name)
      .eq('pin', pin)
      .single()

    setLoading(false)

    if (error || !data) {
      setError('Incorrect PIN. Please try again.')
      return
    }

    onLogin(data)
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f0f4ee',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Arial, sans-serif'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '12px',
        padding: '2.5rem',
        width: '100%',
        maxWidth: '380px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
      }}>
        {/* Header */}
        <div style={{
          background: '#4A6741',
          margin: '-2.5rem -2.5rem 2rem -2.5rem',
          padding: '1.5rem',
          borderRadius: '12px 12px 0 0',
          textAlign: 'center'
        }}>
          <h1 style={{
            color: 'white',
            margin: 0,
            fontSize: '1.3rem',
            fontWeight: 'bold'
          }}>Rocky Mountain</h1>
          <p style={{
            color: '#c5d9c0',
            margin: '0.25rem 0 0 0',
            fontSize: '0.85rem',
            letterSpacing: '0.1em'
          }}>TREATMENT CENTER</p>
        </div>

        <h2 style={{
          textAlign: 'center',
          color: '#4A6741',
          marginTop: 0,
          fontSize: '1.1rem'
        }}>Staff Login</h2>

        {/* Name dropdown */}
        <div style={{ marginBottom: '1rem' }}>
          <label style={{
            display: 'block',
            marginBottom: '0.4rem',
            fontWeight: 'bold',
            color: '#333',
            fontSize: '0.9rem'
          }}>Your Name</label>
          <select
            value={name}
            onChange={e => setName(e.target.value)}
            style={{
              width: '100%',
              padding: '0.75rem',
              borderRadius: '8px',
              border: '1px solid #ccc',
              fontSize: '1rem',
              background: 'white',
              boxSizing: 'border-box'
            }}
          >
            <option value=''>-- Select your name --</option>
            {NURSE_NAMES.map(n => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>

        {/* PIN input */}
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{
            display: 'block',
            marginBottom: '0.4rem',
            fontWeight: 'bold',
            color: '#333',
            fontSize: '0.9rem'
          }}>PIN</label>
          <input
            type='password'
            maxLength={4}
            value={pin}
            onChange={e => setPin(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            placeholder='••••'
            style={{
              width: '100%',
              padding: '0.75rem',
              borderRadius: '8px',
              border: '1px solid #ccc',
              fontSize: '1.5rem',
              textAlign: 'center',
              letterSpacing: '0.5em',
              boxSizing: 'border-box'
            }}
          />
        </div>

        {/* Error */}
        {error && (
          <p style={{
            color: '#cc0000',
            textAlign: 'center',
            marginBottom: '1rem',
            fontSize: '0.9rem'
          }}>{error}</p>
        )}

        {/* Login button */}
        <button
          onClick={handleLogin}
          disabled={loading}
          style={{
            width: '100%',
            padding: '0.85rem',
            background: loading ? '#aaa' : '#4A6741',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '1rem',
            fontWeight: 'bold',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'Checking...' : 'Log In'}
        </button>
      </div>
    </div>
  )
}
