import { useState } from 'react'
import { ref, push, set } from 'firebase/database'
import { db } from '../services/firebase'

const LAT = 13.416588
const LNG = 121.153922

// Nov 3–6, various times
const TIMESTAMPS = [
  new Date('2024-11-03T06:14:00').getTime(),
  new Date('2024-11-03T11:47:00').getTime(),
  new Date('2024-11-03T18:32:00').getTime(),
  new Date('2024-11-04T07:05:00').getTime(),
  new Date('2024-11-04T13:21:00').getTime(),
  new Date('2024-11-04T20:58:00').getTime(),
  new Date('2024-11-05T08:44:00').getTime(),
  new Date('2024-11-05T15:10:00').getTime(),
  new Date('2024-11-06T09:33:00').getTime(),
  new Date('2024-11-06T17:22:00').getTime(),
]

// 3 warning, 7 critical = 10 total
const SEVERITIES = ['critical','critical','critical','warning','critical','critical','warning','critical','critical','warning']

const ALERT_TYPES = [
  'zone_violation','border_breach','zone_violation','speed_violation',
  'border_breach','zone_violation','zone_violation','border_breach',
  'zone_violation','speed_violation'
]

const MESSAGES = [
  'Vessel entered restricted zone boundary.',
  'Vessel breached maritime border — immediate response required.',
  'Vessel detected inside exclusion zone.',
  'Vessel exceeded speed limit near restricted area.',
  'Critical border breach detected — coast guard notified.',
  'Vessel inside danger zone — no entry violation.',
  'Vessel approaching restricted zone perimeter.',
  'Border breach confirmed — vessel unresponsive.',
  'Vessel re-entered restricted zone after warning.',
  'Vessel speed violation near protected marine area.',
]

export default function Seeder() {
  const [status, setStatus] = useState('')
  const [done,   setDone]   = useState(false)
  const [loading, setLoading] = useState(false)

  const seed = async () => {
    setLoading(true)
    setStatus('Adding vessel...')
    try {
      // 1. Add vessel
      const vesselRef = push(ref(db, 'vessels'))
      const vesselId  = vesselRef.key
      await set(vesselRef, {
        name:      'MV Calapan Star',
        mmsi:      '548123001',
        type:      'fishing',
        status:    'alert',
        latitude:  LAT,
        longitude: LNG,
        speed:     4.2,
        heading:   135,
        updatedAt: TIMESTAMPS[9],
        createdAt: TIMESTAMPS[0],
      })
      setStatus('Vessel added. Adding 10 alerts...')

      // 2. Add 10 alerts
      for (let i = 0; i < 10; i++) {
        const alertRef = push(ref(db, 'alerts'))
        await set(alertRef, {
          vesselName:   'MV Calapan Star',
          vesselId,
          alertType:    ALERT_TYPES[i],
          severity:     SEVERITIES[i],
          latitude:     LAT,
          longitude:    LNG,
          message:      MESSAGES[i],
          acknowledged: false,
          createdAt:    TIMESTAMPS[i],
        })
        setStatus(`Added alert ${i + 1}/10...`)
      }

      setStatus('✅ Done! 1 vessel + 10 alerts seeded successfully.')
      setDone(true)
    } catch (err) {
      setStatus(`❌ Error: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: 40, maxWidth: 500 }}>
      <h2 style={{ marginBottom: 8, color: '#1e293b' }}>🌱 Data Seeder</h2>
      <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: 20 }}>
        Adds <strong>MV Calapan Star</strong> at lat {LAT}, lng {LNG} with <strong>3 warning</strong> + <strong>7 critical</strong> alerts from Nov 3–6, 2024.
      </p>
      <button
        onClick={seed}
        disabled={loading || done}
        style={{ background: done ? '#16a34a' : '#2563eb', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: 8, cursor: done || loading ? 'not-allowed' : 'pointer', fontWeight: 600 }}
      >
        {done ? '✅ Seeded' : loading ? 'Seeding...' : 'Run Seeder'}
      </button>
      {status && <p style={{ marginTop: 16, color: '#475569', fontSize: '0.85rem' }}>{status}</p>}
    </div>
  )
}
