import { useEffect, useState, type CSSProperties, type FormEvent } from 'react'
import { Activity, ArrowUpRight, BatteryCharging, ChevronDown, ChevronRight, CircleHelp, CloudSun, Gauge, House, LogOut, Moon, Power, SlidersHorizontal, Sun, Thermometer, UserRound, Waves, Zap } from 'lucide-react'
import config from './data/hwst-config.json'
import demo from './data/demo-data.json'

type Sensor = { name: string; temperature: number | null; online: boolean }
type Unit = 'C' | 'F' | 'K' | 'R'
type View = 'cards' | 'chart' | 'gauge'
type Section = 'temperature' | 'electrical' | 'solar' | 'control'
const sensorNames = ['INLET COLD WATER', 'HE IN 2', 'HEAT EXCHANGER', 'EVAP IN', 'EVAP OUT', 'HE OUT', 'HE IN', 'COMPRESSOR']
const baseTemperatures = demo.sensors.map((sensor) => sensor.temperature)
const modes = [
  { id: 'off', label: 'Mode 1', name: 'Off', detail: 'Mode konvensional', color: 'sage' },
  { id: 'heater', label: 'Mode 2', name: 'Heater refrigeran', detail: 'Pemanas refrigeran', color: 'amber' },
  { id: 'solar', label: 'Mode 3', name: 'Solar collector', detail: 'Kolektor surya', color: 'blue' },
]
const team = [
  { role: 'DOSEN PENELITI', name: 'Yudhy Kurniawan', detail: 'A.Md., S.T., M.T. · NIP. 197710112021211003', initials: 'YK', kind: 'anonymous' },
  { role: 'KETUA TIM', name: 'Tenny', detail: 'D3 Teknik Pendingin dan Tata Udara', initials: 'T', kind: 'anonymous' },
  { role: 'ANGGOTA', name: 'Raditya Rahmat Dhani', detail: 'D4 Teknologi Rekayasa Instrumentasi dan Kontrol', initials: 'RRD', kind: 'raditya' },
  { role: 'ANGGOTA', name: 'Bagas', detail: 'D3 Teknik Pendingin dan Tata Udara', initials: 'B', kind: 'anonymous' },
]

function toUnit(value: number, unit: Unit) {
  if (unit === 'F') return value * 9 / 5 + 32
  if (unit === 'K') return value + 273.15
  if (unit === 'R') return (value + 273.15) * 9 / 5
  return value
}

function shown(value: number | null, unit: Unit) {
  return value === null ? '--' : toUnit(value, unit).toFixed(1)
}

function demoSensors(): Sensor[] {
  const time = Date.now() / 1000
  return sensorNames.map((name, index) => ({ name, temperature: Number((baseTemperatures[index] + Math.sin(time / 9 + index * 0.85) * 0.18).toFixed(2)), online: true }))
}

function sensorsFromFirebase(raw: Record<string, { name?: string; temperature?: number | null; online?: boolean }> | null): Sensor[] {
  return sensorNames.map((name, index) => {
    const item = raw?.[`sensor${index + 1}`]
    return { name: item?.name || name, temperature: typeof item?.temperature === 'number' ? item.temperature : null, online: item?.online === true && typeof item.temperature === 'number' }
  })
}

function TempChart({ sensors, unit }: { sensors: Sensor[]; unit: Unit }) {
  const points = sensors.map((sensor, index) => {
    const x = 70 + index * 102
    const value = sensor.temperature === null ? null : toUnit(sensor.temperature, unit)
    const celsius = sensor.temperature ?? 0
    return { x, y: 206 - Math.max(0, Math.min(100, celsius)) * 1.55, value }
  })
  return <svg className="temperature-chart" viewBox="0 0 840 260" role="img" aria-label={`Grafik suhu delapan titik dalam ${unit}`}>
    {[0, 1, 2, 3].map((row) => <g key={row}><line x1="55" x2="820" y1={48 + row * 53} y2={48 + row * 53} className="chart-grid" /><text x="5" y={52 + row * 53} className="chart-axis">{75 - row * 25}°C</text></g>)}
    <polyline points={points.map((point) => `${point.x},${point.y}`).join(' ')} className="chart-line" />
    {points.map((point, index) => <g key={index}><circle cx={point.x} cy={point.y} r="6" className="chart-point" /><text x={point.x} y="236" textAnchor="middle" className="chart-label">S{index + 1}</text><text x={point.x} y={point.y - 15} textAnchor="middle" className="chart-value">{point.value === null ? '--' : `${point.value.toFixed(1)}°`}</text></g>)}
  </svg>
}

function TempGauge({ sensor, index, unit }: { sensor: Sensor; index: number; unit: Unit }) {
  const ratio = Math.max(0, Math.min(100, sensor.temperature ?? 0))
  const style = { '--gauge-value': `${ratio}%` } as CSSProperties
  return <div className="gauge-item"><div className="gauge-ring" style={style}><span>{shown(sensor.temperature, unit)}<small>°{unit}</small></span></div><span className="gauge-range">0–100°C</span><span className="gauge-name">S{index + 1} · {sensor.name}</span></div>
}

function Metric({ icon: Icon, label, value, unit, tone, source = 'PZEM-004T' }: { icon: typeof Zap; label: string; value: string; unit: string; tone: string; source?: string }) {
  return <article className={`metric-card ${tone}`}><div className="metric-head"><span><Icon size={17} /></span>{label}</div><strong>{value}<small>{unit}</small></strong><p>Data demonstrasi · {source}</p></article>
}

export default function Dashboard() {
  const [authenticated, setAuthenticated] = useState(false)
  const [loading, setLoading] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [dark, setDark] = useState(false)
  const [section, setSection] = useState<Section>('temperature')
  const [view, setView] = useState<View>('cards')
  const [unit, setUnit] = useState<Unit>('C')
  const [mode, setMode] = useState('off')
  const [telemetry, setTelemetry] = useState({ sensors: demoSensors(), ip: '192.168.1.100', live: false, updatedAt: new Date(), systemOnline: true })

  useEffect(() => {
    if (!authenticated) return
    let active = true
    const refresh = async () => {
      const url = config.firebaseReadUrl.trim().replace(/\/$/, '')
      if (url) {
        try {
          const [temperatureResponse, systemResponse] = await Promise.all([fetch(`${url}/temperature.json`, { cache: 'no-store' }), fetch(`${url}/system.json`, { cache: 'no-store' })])
          if (!temperatureResponse.ok || !systemResponse.ok) throw new Error('Firebase unavailable')
          const [temperatureData, systemData] = await Promise.all([temperatureResponse.json(), systemResponse.json()])
          const sensors = sensorsFromFirebase(temperatureData)
          if (active && sensors.some((sensor) => sensor.online)) {
            setTelemetry({ sensors, ip: systemData?.ip || 'Tidak tersedia', live: true, updatedAt: new Date(), systemOnline: systemData?.online === true })
            return
          }
        } catch {
          // Gunakan sampel lokal bila endpoint Firebase tidak dapat dibaca.
        }
      }
      if (active) setTelemetry((current) => ({ ...current, sensors: demoSensors(), live: false, updatedAt: new Date() }))
    }
    void refresh()
    const interval = window.setInterval(() => void refresh(), config.refreshIntervalMs)
    return () => { active = false; window.clearInterval(interval) }
  }, [authenticated])

  function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (username.trim().toUpperCase() !== config.login.username || password !== config.login.password) {
      setError('Username atau password tidak sesuai.')
      return
    }
    setError('')
    setLoading(true)
    window.setTimeout(() => { window.scrollTo({ top: 0, behavior: 'instant' }); setAuthenticated(true); setLoading(false) }, 1800)
  }

  function logout() {
    setAuthenticated(false)
    setUsername('')
    setPassword('')
  }

  const activeSensors = telemetry.sensors.filter((sensor) => sensor.online && sensor.temperature !== null).length
  const average = activeSensors ? telemetry.sensors.reduce((sum, sensor) => sum + (sensor.temperature ?? 0), 0) / activeSensors : null
  const currentMode = modes.find((item) => item.id === mode) ?? modes[0]

  if (loading) return <main className="loading-screen"><div className="loading-atmosphere" /><div className="loader-mark"><span /><span /><span /></div><p className="overline">HWST · LABORATORIUM TERMAL</p><h1>Menyiapkan ruang kendali</h1><p className="loading-detail">Menyinkronkan panel monitoring...</p><div className="loading-track"><span /></div><small>MONITORING KONTROL HWST</small></main>

  if (!authenticated) return <main className="login-screen"><div className="login-atmosphere" /><section className="login-copy"><div className="identity-mark"><img src={`${import.meta.env.BASE_URL}images/polindra-logo.png`} alt="Logo Politeknik Negeri Indramayu" /><span>HWST / 08</span></div><p className="overline">SISTEM MONITORING · RISET TERAPAN</p><h1>Monitoring<br /><em>Kontrol HWST</em></h1><p className="login-intro">Ruang kendali untuk mengamati performa termal, konsumsi energi, dan kontribusi kolektor surya.</p><div className="research-credit"><span /><div><small>KOORDINATOR PENELITIAN</small><strong>Yudhy Kurniawan, A.Md., S.T., M.T.</strong><span>NIP. 197710112021211003</span></div></div></section><section className="login-panel"><div className="login-panel-top"><img src={`${import.meta.env.BASE_URL}images/polindra-logo.png`} alt="" /><span>AKSES PENELITI</span></div><h2>Masuk ke dashboard</h2><p className="login-panel-description">Gunakan akun tim penelitian untuk melanjutkan.</p><form onSubmit={login}><label htmlFor="username">Username</label><input id="username" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Masukkan username" required /><label htmlFor="password">Password</label><input id="password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Masukkan password" required />{error && <p className="login-error" role="alert">{error}</p>}<button className="login-button" type="submit">Masuk ke sistem <ArrowUpRight size={16} /></button></form><div className="login-footnote"><CircleHelp size={15} /><span>Demo antarmuka. Login sisi browser tidak melindungi data pada hosting publik.</span></div></section><footer className="login-footer"><span>POLITEKNIK NEGERI INDRAMAYU</span><span>TEKNIK PENDINGIN · INSTRUMENTASI & KONTROL</span></footer></main>

  return <main className={`dashboard ${dark ? 'theme-dark' : ''}`}>
    <header className="topbar"><button className="brand-lockup" onClick={() => { setSection('temperature'); document.getElementById('monitoring')?.scrollIntoView({ behavior: 'smooth' }) }}><span className="brand-icon"><img src={`${import.meta.env.BASE_URL}images/polindra-logo.png`} alt="Logo Politeknik Negeri Indramayu" /></span><span><small>RISET SISTEM TERMAL</small><strong>MONITORING KONTROL <em>HWST</em></strong></span></button><div className="topbar-meta"><span className={`connection ${telemetry.live ? 'connected' : ''}`}><i />{telemetry.live ? 'Firebase tersambung' : 'Mode demonstrasi'}</span><button className="icon-button" onClick={() => setDark((value) => !value)} aria-label={dark ? 'Aktifkan tema terang' : 'Aktifkan tema gelap'}>{dark ? <Sun size={17} /> : <Moon size={17} />}</button><button className="icon-button" onClick={logout} aria-label="Keluar"><LogOut size={17} /></button></div></header>
    <section className="team-intro" aria-labelledby="project-title"><div className="team-intro-content"><div className="team-intro-title"><div className="institution-mark"><img src={`${import.meta.env.BASE_URL}images/polindra-logo.png`} alt="" /><span>POLITEKNIK NEGERI INDRAMAYU<small>RISET TERAPAN · HWST</small></span></div><p className="overline">SISTEM MONITORING & KONTROL</p><h1 id="project-title">Monitoring<br /><em>Kontrol HWST</em></h1><p>Tim penelitian · Heat Water Source System</p><span className="intro-live"><i /> PLATFORM MONITORING & KONTROL</span></div><div className="team-people">{team.map((person, index) => <article className="person-card" key={person.name} style={{ animationDelay: `${index * 90}ms` }}><div className={`person-portrait ${person.kind === 'raditya' ? 'raditya-portrait' : 'anonymous-portrait'}`}><span className="portrait-fallback">{person.initials}</span>{person.kind === 'raditya' && <img src={`${import.meta.env.BASE_URL}images/raditya-rahmat-dhani.jpg`} alt="Raditya Rahmat Dhani" onError={(event) => { event.currentTarget.hidden = true }} />}{person.kind === 'anonymous' && <span className="faceless-silhouette" aria-hidden="true"><UserRound size={58} strokeWidth={1} /></span>}<span className="person-number">0{index + 1}</span></div><div className="person-copy"><span>{person.role}</span><strong>{person.name}</strong><small>{person.detail}</small></div></article>)}</div><div className="scroll-cue"><span>SCROLL UNTUK MEMBUKA MONITORING</span><ChevronRight size={16} /></div></div><svg className="wave-divider" viewBox="0 0 1440 150" preserveAspectRatio="none" aria-hidden="true"><path className="wave-back" d="M0,74 C170,138 286,4 476,58 C670,112 779,143 957,81 C1140,18 1240,26 1440,88 L1440,150 L0,150 Z" /><path className="wave-front" d="M0,94 C180,35 322,130 510,98 C704,65 794,36 1003,92 C1170,137 1320,118 1440,72 L1440,150 L0,150 Z" /></svg></section>
    <div className="dashboard-layout" id="monitoring"><aside className="sidebar"><div className="sidebar-label">MENU UTAMA</div><button className={`nav-item monitoring-root ${section !== 'control' ? 'selected' : ''}`} onClick={() => setSection('temperature')}><Activity size={17} /><span>Monitoring</span><small>LIVE</small></button><div className="sidebar-submenu"><div className="sidebar-label">TELEMETRI</div><nav aria-label="Menu monitoring"><button className={section === 'temperature' ? 'nav-item selected' : 'nav-item'} onClick={() => setSection('temperature')}><Thermometer size={16} /><span>Suhu 8 titik</span><small>08</small></button><button className={section === 'electrical' ? 'nav-item selected' : 'nav-item'} onClick={() => setSection('electrical')}><Zap size={16} /><span>Energi listrik</span><small>AC</small></button><button className={section === 'solar' ? 'nav-item selected' : 'nav-item'} onClick={() => setSection('solar')}><CloudSun size={16} /><span>Panel surya</span><small>PV</small></button></nav></div><div className="sidebar-rule" /><div className="sidebar-label">KENDALI SISTEM</div><button className={`nav-item control-nav ${section === 'control' ? 'selected' : ''}`} onClick={() => setSection('control')}><SlidersHorizontal size={17} /><span>Mode kontrol</span><small><i className="demo-tag">DEMO</i></small></button><div className="sidebar-bottom"><span className="device-icon"><Activity size={18} /></span><span><small>PERANGKAT ESP32</small><strong>{telemetry.systemOnline ? 'Siap memantau' : 'Status tidak diketahui'}</strong><small>{telemetry.ip}</small></span><i className={`device-dot ${telemetry.live ? 'online' : ''}`} /></div></aside>
      <section className="main-content"><div className="page-heading"><div><p className="overline">{section === 'control' ? 'KENDALI SISTEM / 02' : 'PUSAT MONITORING / 01'}</p><h1>{section === 'temperature' ? 'Performa termal' : section === 'electrical' ? 'Konsumsi listrik' : section === 'solar' ? 'Produksi panel surya' : 'Mode kontrol HWST'}</h1><p className="page-subtitle">{section === 'temperature' ? 'Pemantauan suhu sistem heat water source secara langsung.' : section === 'electrical' ? 'Parameter listrik AC dari meter PZEM-004T.' : section === 'solar' ? 'Ringkasan kontribusi energi dari sistem fotovoltaik.' : 'Pilih mode operasi sistem heat water source.'}</p></div><div className="updated-label"><i /><span><small>PEMBARUAN TERAKHIR</small><strong>{telemetry.updatedAt.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</strong></span></div></div>
        {section === 'temperature' && <><div className="overview-strip"><div className="overview-item"><span className="overview-icon teal"><Thermometer size={17} /></span><span><small>TITIK AKTIF</small><strong>{activeSensors}<i> / 8 sensor</i></strong></span></div><div className="overview-item"><span className="overview-icon coral"><Activity size={17} /></span><span><small>SUHU RATA-RATA</small><strong>{shown(average, unit)}<i> °{unit}</i></strong></span></div><div className="overview-item"><span className="overview-icon blue"><BatteryCharging size={17} /></span><span><small>MODE KONTROL</small><strong>{currentMode.name}<i> · {currentMode.label}</i></strong></span></div><div className="overview-item"><span className="overview-icon ochre"><House size={17} /></span><span><small>SUMBER DATA</small><strong>{telemetry.live ? 'ESP32 · Firebase' : 'Data contoh'}<i>{telemetry.live ? '' : ' · demo'}</i></strong></span></div></div><section className="temperature-section"><div className="section-heading"><div><p className="overline">SENSOR DS18B20</p><h2>Distribusi suhu</h2></div><div className="view-controls"><label className="unit-select"><span>UNIT</span><select value={unit} onChange={(event) => setUnit(event.target.value as Unit)} aria-label="Satuan suhu"><option value="C">°C</option><option value="F">°F</option><option value="K">K</option><option value="R">°R</option></select><ChevronDown size={13} /></label><div className="view-switch"><button className={view === 'cards' ? 'active' : ''} onClick={() => setView('cards')} aria-label="Tampilan kartu"><House size={15} /></button><button className={view === 'chart' ? 'active' : ''} onClick={() => setView('chart')} aria-label="Tampilan grafik"><Activity size={15} /></button><button className={view === 'gauge' ? 'active' : ''} onClick={() => setView('gauge')} aria-label="Tampilan speedometer"><Gauge size={15} /></button></div></div></div>
          {view === 'cards' && <div className="sensor-grid">{telemetry.sensors.map((sensor, index) => <article className={`sensor-row ${sensor.online ? '' : 'sensor-offline'}`} key={`${index}-${sensor.name}`}><span className={`sensor-index index-${index + 1}`}>0{index + 1}</span><span className="sensor-details"><strong>{sensor.name}</strong><small><i className={sensor.online ? 'sensor-status online' : 'sensor-status'} />{sensor.online ? 'ONLINE' : 'OFFLINE'}</small></span><span className="sensor-reading">{shown(sensor.temperature, unit)}<small>°{unit}</small></span><span className="sensor-spark" aria-hidden="true"><i /><i /><i /><i /><i /><i /></span></article>)}</div>}
          {view === 'chart' && <div className="chart-panel"><div className="chart-legend"><span><i /> Suhu tiap titik · °{unit}</span><span>Skala sumbu dalam °C</span></div><TempChart sensors={telemetry.sensors} unit={unit} /></div>}
          {view === 'gauge' && <div className="gauge-panel">{telemetry.sensors.map((sensor, index) => <TempGauge key={sensor.name} sensor={sensor} index={index} unit={unit} />)}</div>}
        </section><section className="lower-band"><div className="mode-explainer"><span><Zap size={18} /></span><div><small>MODE AKTIF · {currentMode.label.toUpperCase()}</small><strong>{currentMode.name}</strong><p>{currentMode.detail}. Pratinjau antarmuka; belum mengirim perintah ke ESP32.</p></div></div><div className="range-note"><span>RENTANG SENSOR</span><strong>-55° <i>hingga</i> 125°C</strong><small>DS18B20 · akurasi tipikal ±0,5°C</small></div></section></>}
        {section === 'electrical' && <div className="telemetry-view"><div className="telemetry-banner"><div><span className="overline">PEMANTAUAN AC</span><h2>Parameter PZEM-004T</h2><p>Data contoh; firmware terlampir belum mengirim data PZEM ke Firebase.</p></div><span className="demo-tag large">DATA DEMO</span></div><div className="metric-grid">{demo.electrical.map((metric) => <Metric key={metric.label} icon={metric.label === 'Tegangan AC' ? Zap : metric.label === 'Arus' ? Activity : BatteryCharging} {...metric} />)}</div><div className="telemetry-note"><CircleHelp size={16} /><p>Firmware perlu mengunggah voltage, current, activePower, frequency, powerFactor, dan activeEnergy untuk menampilkan data aktual.</p></div></div>}
        {section === 'solar' && <div className="telemetry-view"><div className="solar-hero"><div><span className="overline">ENERGI TERBARUKAN / PV</span><h2>Kontribusi surya</h2><p>Visualisasi contoh pemantauan panel surya untuk integrasi berikutnya.</p><span className="demo-tag large">DATA DEMO</span></div><div className="sun-graphic"><CloudSun size={68} strokeWidth={1.2} /><span>IRADIASI SIMULASI</span><strong>{demo.solar.irradiance} <small>W/m²</small></strong></div></div><div className="metric-grid">{demo.solar.metrics.map((metric) => <Metric key={metric.label} icon={metric.label.includes('Daya') ? Zap : metric.label.includes('Energi') ? BatteryCharging : CloudSun} {...metric} source="panel surya" />)}</div><div className="telemetry-note"><CircleHelp size={16} /><p>Firmware belum mengirim telemetri panel surya. Tambahkan sensor tegangan, arus, dan radiasi beserta jalur Firebase untuk data aktual.</p></div></div>}
        {section === 'control' && <section className="control-view"><div className="hmi-statusbar"><div><span className="status-led" /><span>STATUS SISTEM</span><strong>SIAP · SIMULASI LOKAL</strong></div><div><span>MODE TERPILIH</span><strong>{currentMode.label.toUpperCase()}</strong></div><div><span>SUMBER PERINTAH</span><strong>WEB HMI</strong></div></div><div className="control-title"><div><span className="overline">PILIH MODE OPERASI</span><h2>Heat Water Source System</h2><p>Pilih strategi pemanasan untuk melihat pratinjau status operasi.</p></div><div className={`mode-lamp ${currentMode.color}`}><span /><strong>{currentMode.name.toUpperCase()}</strong></div></div><div className="control-mode-grid">{modes.map((item, index) => <button key={item.id} className={`control-mode-card ${item.color} ${mode === item.id ? 'active' : ''}`} onClick={() => setMode(item.id)} aria-pressed={mode === item.id}><span className="mode-card-top"><span>{item.label.toUpperCase()}</span><span className="mode-card-light"><i />{mode === item.id ? 'DIPILIH' : 'STANDBY'}</span></span><span className="mode-card-icon">{item.id === 'off' ? <Power size={24} /> : item.id === 'heater' ? <Thermometer size={24} /> : <CloudSun size={24} />}</span><strong>{item.name}</strong><small>{item.detail}</small><span className="mode-card-action">{mode === item.id ? 'MODE TERPILIH' : 'PILIH MODE'}<ChevronRight size={15} /></span></button>)}</div><div className="control-warning"><CircleHelp size={18} /><div><strong>Pratinjau antarmuka HMI</strong><p>Perubahan mode belum dikirim ke ESP32. Firmware saat ini belum membaca perintah kontrol dari web.</p></div><span>LOCAL ONLY</span></div><div className="control-process"><span>URUTAN SISTEM</span><div><i className="process-node active" /><strong>Mode {currentMode.label.replace('Mode ', '')}</strong><i className="process-line" /><i className="process-node" /><strong>ESP32</strong><i className="process-line" /><i className="process-node" /><strong>HWST</strong></div></div></section>}
        <footer className="dashboard-footer"><span>MONITORING KONTROL HWST</span><span><ArrowUpRight size={13} /> Auto-refresh setiap {Math.round(config.refreshIntervalMs / 1000)} detik</span></footer>
      </section>
    </div>
  </main>
}