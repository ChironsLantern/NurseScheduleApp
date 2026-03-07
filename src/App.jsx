import { useState } from 'react'
import Login from './Login'
import Schedule from './Schedule'

function App() {
  const [nurse, setNurse] = useState(null)

  if (!nurse) {
    return <Login onLogin={(nurseData) => setNurse(nurseData)} />
  }

  return <Schedule nurse={nurse} onLogout={() => setNurse(null)} />
}

export default App
