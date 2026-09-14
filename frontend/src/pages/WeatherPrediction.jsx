import { useEffect, useState } from 'react'
import axios from 'axios'

const DEFAULT_LAT  = 13.4115
const DEFAULT_LON  = 121.1803
const DEFAULT_CITY = 'Calapan City, Oriental Mindoro'
const API_KEY      = '093258366a1433573166053d28fb591e'
const BASE_URL     = '/owm'

const owm = axios.create({ baseURL: BASE_URL })

async function fetchCurrent() {
  const r = await owm.get(`/weather?lat=${DEFAULT_LAT}&lon=${DEFAULT_LON}&units=metric&appid=${API_KEY}`)
  const d = r.data
  return {
    temp:        round(d.main.temp),
    feels_like:  round(d.main.feels_like),
    temp_min:    round(d.main.temp_min),
    temp_max:    round(d.main.temp_max),
    humidity:    d.main.humidity,
    pressure:    d.main.pressure,
    wind_speed:  d.wind.speed,
    wind_deg:    d.wind.deg,
    wind_gust:   d.wind.gust ?? 0,
    visibility:  round((d.visibility ?? 0) / 1000, 1),
    condition:   d.weather[0].main,
    description: d.weather[0].description,
    clouds:      d.clouds.all,
    sunrise:     d.sys.sunrise,
    sunset:      d.sys.sunset,
    city:        d.name,
  }
}

async function fetchForecast() {
  const r    = await owm.get(`/forecast?lat=${DEFAULT_LAT}&lon=${DEFAULT_LON}&units=metric&appid=${API_KEY}`)
  const daily = {}
  r.data.list.forEach(item => {
    const date = new Date(item.dt * 1000).toLocaleDateString('en-CA')
    if (!daily[date]) daily[date] = {
      label: new Date(item.dt * 1000).toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' }),
      temps: [], humidity: [], wind: [], rain: 0,
      condition: item.weather[0].main, description: item.weather[0].description,
    }
    daily[date].temps.push(item.main.temp)
    daily[date].humidity.push(item.main.humidity)
    daily[date].wind.push(item.wind.speed)
    daily[date].rain += item.rain?.['3h'] ?? 0
  })
  return Object.entries(daily).map(([date, d]) => ({
    date, label: d.label,
    temp_min:    round(Math.min(...d.temps)),
    temp_max:    round(Math.max(...d.temps)),
    humidity:    Math.round(avg(d.humidity)),
    wind_speed:  round(avg(d.wind), 1),
    rain:        round(d.rain, 1),
    condition:   d.condition,
    description: d.description,
  }))
}

async function fetchHourly() {
  const r     = await owm.get(`/forecast?lat=${DEFAULT_LAT}&lon=${DEFAULT_LON}&units=metric&appid=${API_KEY}`)
  const today = new Date().toLocaleDateString('en-CA')
  return r.data.list
    .filter(item => new Date(item.dt * 1000).toLocaleDateString('en-CA') === today)
    .map(item => ({
      time:        new Date(item.dt * 1000).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' }),
      temp:        round(item.main.temp),
      humidity:    item.main.humidity,
      wind_speed:  item.wind.speed,
      wind_deg:    item.wind.deg,
      condition:   item.weather[0].main,
      description: item.weather[0].description,
      rain:        item.rain?.['3h'] ?? 0,
      pop:         Math.round((item.pop ?? 0) * 100),
    }))
}

const round = (n, d = 1) => Math.round(n * 10 ** d) / 10 ** d
const avg   = arr => arr.reduce((a, b) => a + b, 0) / arr.length

// ── Helpers ───────────────────────────────────────────────────────────────
const WIND_DIR = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW']
const windDir  = deg => WIND_DIR[Math.round(deg / 22.5) % 16]

const weatherEmoji = (c = '') => {
  c = c.toLowerCase()
  if (c.includes('thunder')) return '⛈️'
  if (c.includes('rain') || c.includes('drizzle')) return '🌧️'
  if (c.includes('snow')) return '❄️'
  if (c.includes('fog') || c.includes('mist') || c.includes('haze')) return '🌫️'
  if (c.includes('cloud')) return '☁️'
  return '☀️'
}

// Sea safety level based on wind speed (Beaufort-inspired)
function seaSafety(windSpeed, condition = '') {
  if (condition.toLowerCase().includes('thunder')) return { level: 'DANGER',  color: '#ff4444', text: 'Thunderstorm — All vessels return to port immediately.' }
  if (windSpeed >= 17.2) return { level: 'DANGER',  color: '#ff4444', text: 'Gale force winds — Navigation prohibited.' }
  if (windSpeed >= 10.8) return { level: 'WARNING', color: '#ffa500', text: 'Strong winds — Small vessels exercise extreme caution.' }
  if (windSpeed >= 5.5)  return { level: 'CAUTION', color: '#ffdd00', text: 'Moderate breeze — Monitor conditions closely.' }
  return                        { level: 'SAFE',    color: '#00ff9d', text: 'Calm conditions — Safe for navigation.' }
}

const fmt12 = ts => new Date(ts * 1000).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })

// ── Stat box ──────────────────────────────────────────────────────────────
function Stat({ icon, label, value }) {
  return (
    <div style={s.stat}>
      <div style={s.statIcon}>{icon}</div>
      <div style={s.statVal}>{value}</div>
      <div style={s.statLabel}>{label}</div>
    </div>
  )
}

// ── Forecast card ─────────────────────────────────────────────────────────
function ForecastCard({ day }) {
  const safety = seaSafety(day.wind_speed, day.condition)
  return (
    <div style={s.fCard}>
      <div style={s.fDay}>{day.label}</div>
      <div style={{ fontSize: '1.8rem', margin: '4px 0' }}>{weatherEmoji(day.condition)}</div>
      <div style={s.fDesc}>{day.description}</div>
      <div style={s.fTemp}>
        <span style={{ color: '#ff8888' }}>{day.temp_max}°</span>
        <span style={{ color: '#8aa0b8', fontSize: '0.8rem' }}> / {day.temp_min}°</span>
      </div>
      <div style={s.fRow}><span>💧</span><span>{day.humidity}%</span></div>
      <div style={s.fRow}><span>💨</span><span>{day.wind_speed} m/s</span></div>
      {day.rain > 0 && <div style={s.fRow}><span>🌧️</span><span>{day.rain}mm</span></div>}
      <div style={{ ...s.fBadge, background: safety.color + '22', color: safety.color, borderColor: safety.color + '55' }}>
        {safety.level}
      </div>
    </div>
  )
}

// ── Hourly row ────────────────────────────────────────────────────────────
function HourlyRow({ h }) {
  return (
    <div style={s.hRow}>
      <span style={s.hTime}>{h.time}</span>
      <span style={{ fontSize: '1.1rem' }}>{weatherEmoji(h.condition)}</span>
      <span style={s.hVal}>{h.temp}°C</span>
      <span style={s.hVal}>💧 {h.humidity}%</span>
      <span style={s.hVal}>💨 {h.wind_speed} m/s {windDir(h.wind_deg)}</span>
      {h.rain > 0 && <span style={s.hVal}>🌧️ {h.rain}mm</span>}
      <span style={s.hVal}>☔ {h.pop}%</span>
      <span style={{ ...s.hBadge, ...badgeStyle(h.wind_speed, h.condition) }}>
        {seaSafety(h.wind_speed, h.condition).level}
      </span>
    </div>
  )
}

function badgeStyle(ws, cond) {
  const { color } = seaSafety(ws, cond)
  return { background: color + '22', color, borderColor: color + '55' }
}

// ─────────────────────────────────────────────────────────────────────────
export default function WeatherPrediction() {
  const [current,  setCurrent]  = useState(null)
  const [forecast, setForecast] = useState([])
  const [hourly,   setHourly]   = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)
  const [tab,      setTab]      = useState('forecast') // 'forecast' | 'hourly'
  const [lastFetch,setLastFetch]= useState(null)

  const load = async () => {
    setLoading(true); setError(null)
    try {
      const [cur, fore, hour] = await Promise.all([
        fetchCurrent(), fetchForecast(), fetchHourly()
      ])
      setCurrent(cur)
      setForecast(fore)
      setHourly(hour)
      setLastFetch(new Date().toLocaleTimeString())
    } catch (e) {
      setError('Cannot reach OpenWeatherMap. Check your internet connection or wait 15 minutes for the API key to activate.')
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  if (loading) return <div style={s.center}>⏳ Fetching weather data for {DEFAULT_CITY}…</div>

  if (error) return (
    <div style={s.errorBox}>
      <div style={{ fontSize: '1.3rem', marginBottom: 8 }}>⚠️ Weather Unavailable</div>
      <div style={{ marginBottom: 14, fontSize: '0.88rem' }}>{error}</div>
      <button onClick={load} style={s.btnPrimary}>↻ Retry</button>
    </div>
  )

  const safety = current ? seaSafety(current.wind_speed, current.condition) : null

  return (
    <div style={s.root}>

      {/* Header */}
      <div style={s.header}>
        <div>
          <h1 style={{ color: '#00d4ff', marginBottom: 2 }}>🌤️ Weather Prediction</h1>
          <div style={{ color: '#8aa0b8', fontSize: '0.82rem' }}>
            📍 {current?.city ?? DEFAULT_CITY} &nbsp;·&nbsp; Last updated: {lastFetch}
          </div>
        </div>
        <button onClick={load} style={s.btnSecondary}>↻ Refresh</button>
      </div>

      {/* Sea Safety Advisory Banner */}
      {safety && (
        <div style={{ ...s.advisory, background: safety.color + '18', borderColor: safety.color + '55', color: safety.color }}>
          <span style={{ fontSize: '1.2rem', marginRight: 10 }}>
            {safety.level === 'SAFE' ? '✅' : safety.level === 'CAUTION' ? '⚠️' : '🚨'}
          </span>
          <strong>{safety.level}</strong> — {safety.text}
        </div>
      )}

      {/* Current weather */}
      {current && (
        <div style={s.currentBox}>
          <div style={s.currentLeft}>
            <div style={{ fontSize: '4rem' }}>{weatherEmoji(current.condition)}</div>
            <div>
              <div style={s.bigTemp}>{current.temp}°C</div>
              <div style={{ color: '#8aa0b8', textTransform: 'capitalize', fontSize: '0.9rem' }}>{current.description}</div>
              <div style={{ color: '#8aa0b8', fontSize: '0.8rem', marginTop: 4 }}>
                Feels like {current.feels_like}°C &nbsp;·&nbsp; {current.temp_min}° / {current.temp_max}°
              </div>
            </div>
          </div>
          <div style={s.statsGrid}>
            <Stat icon="💧" label="Humidity"    value={`${current.humidity}%`} />
            <Stat icon="💨" label="Wind"        value={`${current.wind_speed} m/s ${windDir(current.wind_deg)}`} />
            <Stat icon="💨" label="Gust"        value={`${current.wind_gust} m/s`} />
            <Stat icon="👁️" label="Visibility"  value={`${current.visibility} km`} />
            <Stat icon="📊" label="Pressure"    value={`${current.pressure} hPa`} />
            <Stat icon="☁️" label="Cloud Cover" value={`${current.clouds}%`} />
            <Stat icon="🌅" label="Sunrise"     value={fmt12(current.sunrise)} />
            <Stat icon="🌇" label="Sunset"      value={fmt12(current.sunset)} />
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={s.tabs}>
        <button style={{ ...s.tab, ...(tab === 'forecast' ? s.tabActive : {}) }} onClick={() => setTab('forecast')}>
          📅 5-Day Forecast
        </button>
        <button style={{ ...s.tab, ...(tab === 'hourly' ? s.tabActive : {}) }} onClick={() => setTab('hourly')}>
          🕐 Today Hourly
        </button>
      </div>

      {/* 5-day forecast */}
      {tab === 'forecast' && (
        <div style={s.forecastRow}>
          {forecast.map((day, i) => <ForecastCard key={i} day={day} />)}
        </div>
      )}

      {/* Hourly today */}
      {tab === 'hourly' && (
        <div style={s.hourlyBox}>
          {hourly.length === 0 && (
            <div style={{ color: '#8aa0b8', padding: 16 }}>No hourly data available for today.</div>
          )}
          <div style={s.hHeader}>
            <span>Time</span><span></span><span>Temp</span>
            <span>Humidity</span><span>Wind</span><span>Rain</span><span>Rain %</span><span>Advisory</span>
          </div>
          {hourly.map((h, i) => <HourlyRow key={i} h={h} />)}
        </div>
      )}

    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────
const s = {
  root:       { display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto', height: '100%' },
  header:     { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexShrink: 0 },
  center:     { color: '#8aa0b8', padding: 40, textAlign: 'center' },
  errorBox:   { background: '#1a0a0a', border: '1px solid #ff444466', borderRadius: 12, padding: 24, color: '#ff8888', maxWidth: 560 },
  code:       { background: '#0a0f1e', color: '#00d4ff', padding: '1px 6px', borderRadius: 4, fontSize: '0.78rem' },
  advisory:   { display: 'flex', alignItems: 'center', padding: '12px 18px', borderRadius: 10, border: '1px solid', fontWeight: 600, fontSize: '0.9rem', flexShrink: 0 },
  currentBox: { background: '#0d1b2a', border: '1px solid #1e3a5f', borderRadius: 12, padding: 20, display: 'flex', gap: 24, flexWrap: 'wrap', flexShrink: 0 },
  currentLeft:{ display: 'flex', alignItems: 'center', gap: 16 },
  bigTemp:    { fontSize: '2.8rem', fontWeight: 700, color: '#00d4ff', lineHeight: 1 },
  statsGrid:  { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 10, flex: 1, minWidth: 280 },
  stat:       { background: '#0a0f1e', border: '1px solid #1e3a5f', borderRadius: 8, padding: '10px 12px', textAlign: 'center' },
  statIcon:   { fontSize: '1.2rem', marginBottom: 4 },
  statVal:    { color: '#e0e6f0', fontWeight: 600, fontSize: '0.9rem' },
  statLabel:  { color: '#8aa0b8', fontSize: '0.72rem', marginTop: 2 },
  tabs:       { display: 'flex', gap: 8, flexShrink: 0 },
  tab:        { background: '#0d1b2a', border: '1px solid #1e3a5f', color: '#8aa0b8', padding: '7px 18px', borderRadius: 8, cursor: 'pointer', fontSize: '0.85rem' },
  tabActive:  { background: '#1e3a5f', color: '#00d4ff', borderColor: '#00d4ff' },
  forecastRow:{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 6, flexShrink: 0 },
  fCard:      { background: '#0d1b2a', border: '1px solid #1e3a5f', borderRadius: 12, padding: '14px 16px', minWidth: 140, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 },
  fDay:       { color: '#00d4ff', fontWeight: 600, fontSize: '0.85rem' },
  fDesc:      { color: '#8aa0b8', fontSize: '0.72rem', textAlign: 'center', textTransform: 'capitalize' },
  fTemp:      { fontSize: '1rem', fontWeight: 700, marginTop: 2 },
  fRow:       { display: 'flex', gap: 4, fontSize: '0.78rem', color: '#8aa0b8' },
  fBadge:     { marginTop: 6, fontSize: '0.7rem', fontWeight: 700, padding: '2px 10px', borderRadius: 10, border: '1px solid' },
  hourlyBox:  { background: '#0d1b2a', border: '1px solid #1e3a5f', borderRadius: 12, overflow: 'hidden' },
  hHeader:    { display: 'grid', gridTemplateColumns: '80px 30px 70px 90px 130px 70px 70px 1fr', gap: 8, padding: '8px 14px', background: '#0a0f1e', color: '#8aa0b8', fontSize: '0.75rem', fontWeight: 600 },
  hRow:       { display: 'grid', gridTemplateColumns: '80px 30px 70px 90px 130px 70px 70px 1fr', gap: 8, padding: '9px 14px', borderTop: '1px solid #1e3a5f22', alignItems: 'center', fontSize: '0.82rem', color: '#e0e6f0' },
  hTime:      { color: '#00d4ff', fontWeight: 600 },
  hVal:       { color: '#c0cfe0' },
  hBadge:     { fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: 8, border: '1px solid', textAlign: 'center' },
  btnPrimary: { background: '#00d4ff', color: '#0a0f1e', border: 'none', padding: '7px 16px', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem' },
  btnSecondary:{ background: '#0d1b2a', color: '#e0e6f0', border: '1px solid #1e3a5f', padding: '7px 16px', borderRadius: 8, cursor: 'pointer', fontSize: '0.85rem' },
}
