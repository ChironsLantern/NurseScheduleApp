import { useEffect, useState } from 'react'
import { supabase } from './supabase'

function App() {
  const [nurses, setNurses] = useState([])

  useEffect(() => {
    async function fetchNurses() {
      const { data, error } = await supabase
        .from('nurses')
        .select('*')
      if (error) console.error(error)
      else setNurses(data)
    }
    fetchNurses()
  }, [])

  return (
    <div style={{ padding: '2rem', fontFamily: 'Arial' }}>
      <h1 style={{ color: '#4A6741' }}>Rocky Mountain Treatment Center</h1>
      <h2>Nurses in database:</h2>
      {nurses.map(nurse => (
        <div key={nurse.id} style={{ padding: '0.5rem', margin: '0.5rem 0', background: '#EBF2E8', borderRadius: '8px' }}>
          <strong>{nurse.name}</strong> — {nurse.role}
        </div>
      ))}
    </div>
  )
}

export default App
