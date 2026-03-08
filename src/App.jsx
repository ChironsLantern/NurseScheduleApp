import { useState } from 'react'
import Login from './Login'
import Schedule from './Schedule'
import ManagerDashboard from './ManagerDashboard'

function App() {
  const [nurse, setNurse] = useState(null)

  if (!nurse) {
    return <Login onLogin={(nurseData) => setNurse(nurseData)} />
  }

  if (nurse.role === 'manager') {
    return <ManagerDashboard nurse={nurse} onLogout={() => setNurse(null)} />
  }

  return <Schedule nurse={nurse} onLogout={() => setNurse(null)} />
}

export default App
