import { useState } from 'react'
import Login from './Login'

function App() {
  const [nurse, setNurse] = useState(null)

  function handleLogin(nurseData) {
    setNurse(nurseData)
  }

  if (!nurse) {
    return <Login onLogin={handleLogin} />
  }

  return (
    <div style={{ padding: '2rem', fontFamily: 'Arial' }}>
      <h1 style={{ color: '#4A6741' }}>Rocky Mountain Treatment Center</h1>
      <p>Welcome, <strong>{nurse.name}</strong> — {nurse.role}</p>
      <button onClick={() => setNurse(null)}>Log Out</button>
    </div>
  )
}

export default App
