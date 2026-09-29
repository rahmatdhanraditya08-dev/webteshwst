import { useEffect, useMemo, useRef, useState } from 'react'
import { Activity, Info, Moon, Pause, Play, RotateCcw, Sun } from 'lucide-react'

type ComponentType = 'resistor' | 'capacitor' | 'inductor'
type Mode = 'ac' | 'dc'
type Parameters = { voltage: number; frequency: number; resistance: number; capacitance: number; inductance: number }
type Measurement = { xl: number; xc: number; real: number; imaginary: number; magnitude: number; phase: number; rmsCurrent: number; resonance: number }

const defaults: Parameters = { voltage: 12, frequency: 60, resistance: 470, capacitance: 100, inductance: 220 }

function calculate(parameters: Parameters, component: ComponentType, mode: Mode): Measurement {
  const frequency = mode === 'ac' ? parameters.frequency : 0
  const omega = 2 * Math.PI * frequency
  const xl = omega * parameters.inductance * 1e-3
  const xc = frequency ? 1 / (omega * parameters.capacitance * 1e-6) : 0
  if (!frequency && component !== 'resistor') {
    const openCircuit = component === 'capacitor'
    return { xl: 0, xc: 0, real: openCircuit ? Infinity : 0, imaginary: 0, magnitude: openCircuit ? Infinity : 0, phase: 0, rmsCurrent: openCircuit ? 0 : Infinity, resonance: 1 / (2 * Math.PI * Math.sqrt(parameters.inductance * 1e-3 * parameters.capacitance * 1e-6)) }
  }
  let real = 0
  let imaginary = 0
  if (component === 'resistor') real = parameters.resistance
  if (component === 'capacitor') imaginary = -xc
  if (component === 'inductor') imaginary = xl
  const magnitude = Math.hypot(real, imaginary)
  return { xl, xc, real, imaginary, magnitude, phase: Math.atan2(imaginary, real) * 180 / Math.PI, rmsCurrent: parameters.voltage / Math.max(magnitude, 0.000001), resonance: 1 / (2 * Math.PI * Math.sqrt(parameters.inductance * 1e-3 * parameters.capacitance * 1e-6)) }
}

function format(value: number, digits = 2) {
  if (value === Infinity) return '∞'
  if (value === -Infinity) return '-∞'
  return Number.isFinite(value) ? value.toFixed(digits) : '—'
}

function SliderField({ label, symbol, unit, value, min, max, step, onChange, tone }: { label: string; symbol: string; unit: string; value: number; min: number; max: number; step: number; onChange: (value: number) => void; tone: string }) {
  return <label className={`component-control ${tone}`}>
    <span className="component-label"><span className="component-symbol">{symbol}</span>{label}</span>
    <span className="number-unit"><input type="number" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} /><small>{unit}</small></span>
    <input className="range-input" type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
  </label>
}

function CanvasPanel({ parameters, measurement, component, mode, elapsed, running }: { parameters: Parameters; measurement: Measurement; component: ComponentType; mode: Mode; elapsed: number; running: boolean }) {
  const circuitRef = useRef<HTMLCanvasElement>(null)
  const waveRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const draw = () => {
      const canvas = circuitRef.current
      const wave = waveRef.current
      if (!canvas || !wave) return
      drawCircuit(canvas, parameters, measurement, component, mode, elapsed)
      drawWave(wave, measurement, mode, elapsed)
    }
    draw()
    if (!running) return
    const frame = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frame)
  }, [parameters, measurement, component, mode, elapsed, running])
  return <>
    <div className="circuit-card">
      <div className="card-heading"><span className="card-label">SCHEMATIC VIEW</span><span className="card-note">electron flow / realtime</span></div>
      <canvas ref={circuitRef} className="circuit-canvas" aria-label="Visualisasi rangkaian komponen aktif" />
      <div className="canvas-legend"><span><i className="legend-line voltage-line" /> Tegangan</span><span><i className="legend-line current-line" /> Arus elektron</span></div>
    </div>
    <div className="oscilloscope-card"><div className="card-heading"><div><span className="card-label">OSCILLOSCOPE</span><p>Tegangan dan arus terhadap waktu</p></div><div className="scope-values"><span><i className="scope-dot voltage-dot" />V(t)</span><span><i className="scope-dot current-dot" />I(t)</span></div></div><canvas ref={waveRef} className="wave-canvas" aria-label="Grafik respons waktu" /></div>
  </>
}

function drawCanvasSize(canvas: HTMLCanvasElement, context: CanvasRenderingContext2D) {
  const ratio = window.devicePixelRatio || 1
  const width = canvas.clientWidth || 600
  const height = canvas.clientHeight || 260
  if (canvas.width !== width * ratio || canvas.height !== height * ratio) { canvas.width = width * ratio; canvas.height = height * ratio }
  context.setTransform(ratio, 0, 0, ratio, 0, 0)
  context.clearRect(0, 0, width, height)
  return { width, height }
}

function drawCircuit(canvas: HTMLCanvasElement, parameters: Parameters, measurement: Measurement, component: ComponentType, mode: Mode, elapsed: number) {
  const context = canvas.getContext('2d')
  if (!context) return
  const { width, height } = drawCanvasSize(canvas, context)
  const y = height / 2 + 7; const left = 42; const right = width - 42; const top = 42; const bottom = height - 30
  context.strokeStyle = '#b9c9c1'; context.lineWidth = 2; context.fillStyle = '#182326'
  const line = (x1: number, y1: number, x2: number, y2: number) => { context.beginPath(); context.moveTo(x1, y1); context.lineTo(x2, y2); context.stroke() }
  const label = (text: string, x: number, yy: number, color = '#708083') => { context.fillStyle = color; context.font = '10px DM Mono, monospace'; context.textAlign = 'center'; context.fillText(text, x, yy) }
  const componentX = width / 2
  const componentGap = component === 'capacitor' ? 25 : 24
  line(left, y, componentX - componentGap - 20, y)
  if (component === 'resistor') {
    line(componentX + componentGap + 20, y, componentX + 67, y)
    line(componentX + 89, y, right, y)
  } else {
    line(componentX + componentGap + 20, y, right, y)
  }
  line(right, y, right, top); line(right, top, left, top); line(left, top, left, y - 16)
  drawSource(context, left, y)
  if (component === 'resistor') { drawResistor(context, componentX, y); drawLed(context, componentX + 78, y); label('R', componentX, y + 34, '#e89057'); label('LED', componentX + 78, y + 34, '#f2c75c') }
  if (component === 'capacitor') { drawCapacitor(context, componentX, y); label('C', componentX, y + 34, '#3e8cc4') }
  if (component === 'inductor') { drawInductor(context, componentX, y); label('L', componentX, y + 34, '#1b8c87') }
  const motion = mode === 'dc' ? elapsed * 0.15 : Math.sin(elapsed * parameters.frequency * 0.7) * 0.18
  context.fillStyle = '#1b8c87'
  for (let index = 0; index < 14; index += 1) { const progress = (index / 14 + elapsed * (0.08 + Math.min(measurement.rmsCurrent, 1) * 0.01) + motion) % 1; const x = left + (right - left) * progress; context.beginPath(); context.arc(x, y, 3, 0, Math.PI * 2); context.fill() }
  label(`${parameters.voltage.toFixed(1)} V ${mode.toUpperCase()}`, left, bottom + 18, '#e89057'); label(`|I| ${format(measurement.rmsCurrent * 1000, 1)} mA`, right - 35, bottom + 18, '#1b8c87')
}

function drawSource(context: CanvasRenderingContext2D, x: number, y: number) { context.strokeStyle = '#e89057'; context.beginPath(); context.arc(x, y, 16, 0, Math.PI * 2); context.stroke(); context.fillStyle = '#e89057'; context.font = '14px DM Mono, monospace'; context.textAlign = 'center'; context.fillText('~', x, y + 5); context.strokeStyle = '#b9c9c1' }
function drawResistor(context: CanvasRenderingContext2D, x: number, y: number) { context.strokeStyle = '#e89057'; context.beginPath(); context.moveTo(x - 20, y); context.lineTo(x - 13, y); context.lineTo(x - 8, y - 8); context.lineTo(x, y + 8); context.lineTo(x + 8, y - 8); context.lineTo(x + 13, y); context.lineTo(x + 20, y); context.stroke(); context.strokeStyle = '#b9c9c1' }
function drawLed(context: CanvasRenderingContext2D, x: number, y: number) { context.strokeStyle = '#f2c75c'; context.fillStyle = '#fff3bb'; context.beginPath(); context.arc(x, y, 11, 0, Math.PI * 2); context.fill(); context.stroke(); context.beginPath(); context.moveTo(x - 5, y - 14); context.lineTo(x - 11, y - 20); context.moveTo(x + 5, y - 14); context.lineTo(x + 11, y - 20); context.stroke(); context.strokeStyle = '#b9c9c1' }
function drawInductor(context: CanvasRenderingContext2D, x: number, y: number) { context.strokeStyle = '#1b8c87'; context.beginPath(); context.moveTo(x - 21, y); context.lineTo(x - 15, y); for (let i = 0; i < 2; i += 1) context.arc(x - 8 + i * 16, y, 8, Math.PI, 0); context.lineTo(x + 21, y); context.stroke(); context.strokeStyle = '#b9c9c1' }
function drawCapacitor(context: CanvasRenderingContext2D, x: number, y: number) { context.strokeStyle = '#3e8cc4'; context.beginPath(); context.moveTo(x - 19, y); context.lineTo(x - 5, y); context.moveTo(x - 5, y - 14); context.lineTo(x - 5, y + 14); context.moveTo(x + 5, y - 14); context.lineTo(x + 5, y + 14); context.moveTo(x + 5, y); context.lineTo(x + 19, y); context.stroke(); context.strokeStyle = '#b9c9c1' }
function drawWave(canvas: HTMLCanvasElement, measurement: Measurement, mode: Mode, elapsed: number) { const context = canvas.getContext('2d'); if (!context) return; const { width, height } = drawCanvasSize(canvas, context); context.strokeStyle = '#e2ebe6'; context.lineWidth = 1; for (let x = 0; x <= width; x += width / 8) { context.beginPath(); context.moveTo(x, 0); context.lineTo(x, height); context.stroke() } for (let y = 0; y <= height; y += height / 4) { context.beginPath(); context.moveTo(0, y); context.lineTo(width, y); context.stroke() } const center = height / 2; const amplitude = height * .31; const cycles = mode === 'ac' ? 2 : .35; const plot = (color: string, offset: number, scale: number) => { context.strokeStyle = color; context.lineWidth = 2; context.beginPath(); for (let x = 0; x <= width; x += 2) { const value = Math.sin(x / width * Math.PI * 2 * cycles - elapsed * 2 + offset); const yy = center - value * amplitude * scale; x === 0 ? context.moveTo(x, yy) : context.lineTo(x, yy) } context.stroke() }; plot('#e89057', 0, 1); plot('#1b8c87', -measurement.phase * Math.PI / 180, .75) }

export default function App() {
  const [parameters, setParameters] = useState(defaults)
  const [component, setComponent] = useState<ComponentType>('resistor')
  const [mode, setMode] = useState<Mode>('ac')
  const [darkMode, setDarkMode] = useState(false)
  const [running, setRunning] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const measurement = useMemo(() => calculate(parameters, component, mode), [parameters, component, mode])
  useEffect(() => {
    if (!running) return
    let lastTime = performance.now()
    let frame = 0
    const tick = (time: number) => { const delta = Math.min((time - lastTime) / 1000, .05); lastTime = time; setElapsed((value) => value + delta); frame = requestAnimationFrame(tick) }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [running])
  const setParameter = (key: keyof Parameters, value: number) => setParameters((current) => ({ ...current, [key]: value }))
  const reset = () => { setParameters(defaults); setComponent('resistor'); setMode('ac'); setElapsed(0); setRunning(false) }
  const componentName = component === 'resistor' ? 'Resistor + LED' : component === 'capacitor' ? 'Kapasitor' : 'Induktor'
  return <main className={`app-shell ${darkMode ? 'dark-theme' : ''}`}>
    <header className="topbar"><div className="brand-lockup"><div className="brand-mark"><span>R</span><span>L</span><span>C</span></div><div><p className="eyebrow">PHYSICS LAB / 01</p><h1>CircuitLab <em>Sim</em></h1></div></div><div className="creator-credit" aria-label="Dibuat oleh @radityakustik">@radityakustik</div><div className="header-actions"><button className="theme-toggle" onClick={() => setDarkMode((value) => !value)} title="Ganti tema">{darkMode ? <Sun size={15} /> : <Moon size={15} />}</button><div className="status-pill"><span className={`status-dot ${running ? 'live' : ''}`} />{running ? 'Simulasi sedang berjalan' : 'Siap disimulasikan'}</div></div></header>
    <div className="workspace-grid"><aside className="control-panel"><div className="panel-heading"><div><p className="eyebrow">KONFIGURASI</p><h2>Atur eksperimen</h2></div><span className="step-badge">01</span></div>
      <section className="control-section"><div className="section-label"><span className="section-number">A</span>Rangkaian aktif</div><div className="segmented-control component-tabs"><button className={component === 'resistor' ? 'active resistor-tab' : ''} onClick={() => setComponent('resistor')}>R + LED</button><button className={component === 'capacitor' ? 'active capacitor-tab' : ''} onClick={() => setComponent('capacitor')}>Kapasitor</button><button className={component === 'inductor' ? 'active inductor-tab' : ''} onClick={() => setComponent('inductor')}>Induktor</button></div><p className="section-help">Setiap pilihan memiliki rangkaian dan respons arusnya sendiri.</p></section>
      <section className="control-section"><div className="section-label"><span className="section-number">B</span>Sumber tegangan</div><div className="mode-row"><button className={mode === 'ac' ? 'active' : ''} onClick={() => setMode('ac')}><span>~</span> AC</button><button className={mode === 'dc' ? 'active' : ''} onClick={() => setMode('dc')}><span>=</span> DC</button></div><div className="dual-input"><SliderField label="Tegangan sumber" symbol="V" unit="V" value={parameters.voltage} min={1} max={24} step={.1} onChange={(value) => setParameter('voltage', value)} tone="voltage" /><SliderField label="Frekuensi" symbol="f" unit="Hz" value={parameters.frequency} min={10} max={1000} step={1} onChange={(value) => setParameter('frequency', value)} tone={mode === 'dc' ? 'disabled' : 'frequency'} /></div></section>
      <section className="control-section"><div className="section-label"><span className="section-number">C</span>Komponen pasif</div><SliderField label="Resistor" symbol="R" unit="Ohm" value={parameters.resistance} min={1} max={10000} step={1} onChange={(value) => setParameter('resistance', value)} tone="resistor" /><SliderField label="Kapasitor" symbol="C" unit="uF" value={parameters.capacitance} min={1} max={1000} step={1} onChange={(value) => setParameter('capacitance', value)} tone="capacitor" /><SliderField label="Induktor" symbol="L" unit="mH" value={parameters.inductance} min={1} max={1000} step={1} onChange={(value) => setParameter('inductance', value)} tone="inductor" /></section>
      <div className="control-actions"><button className="primary-action" onClick={() => setRunning((value) => !value)}>{running ? <Pause size={14} /> : <Play size={14} />}{running ? 'Jeda simulasi' : 'Mulai simulasi'}</button><button className="icon-action" onClick={reset} title="Reset simulasi"><RotateCcw size={17} /></button></div><p className="tip-line"><Info size={14} /> Ubah parameter untuk mengamati respons rangkaian secara langsung.</p>
    </aside><section className="simulation-area"><div className="simulation-header"><div><p className="eyebrow">LIVE SIMULATION</p><h2>Ruang eksperimen</h2></div><div className="readout-chip"><Activity size={13} />{mode.toUpperCase()} / {componentName.toUpperCase()}</div></div><CanvasPanel parameters={parameters} measurement={measurement} component={component} mode={mode} elapsed={elapsed} running={running} />
      <div className="results-layout"><div className="results-card"><div className="card-heading"><span className="card-label">MEASUREMENTS</span><span className="measurement-time">t = {elapsed.toFixed(2)} s</span></div><div className="metrics-grid"><div className="metric-main"><span>Impedansi {componentName}</span><strong>{format(measurement.magnitude)}</strong><small>Ohm</small><em>Re {format(measurement.real, 1)} / Im {format(measurement.imaginary, 1)}</em></div><div className="metric-main accent-current"><span>Arus RMS</span><strong>{format(measurement.rmsCurrent * 1000, 1)}</strong><small>mA</small><em>I = {format(measurement.rmsCurrent * 1000, 1)} mA RMS</em></div><div className="metric-small"><span>Sudut fase</span><strong>{format(measurement.phase, 1)}</strong><small>deg</small></div><div className="metric-small"><span>Resonansi LC</span><strong>{format(measurement.resonance, 1)}</strong><small>Hz</small></div></div><div className="reactance-row"><div><span>X<sub>L</sub></span><strong>{format(measurement.xl)}</strong><small>Ohm</small></div><div><span>X<sub>C</sub></span><strong>{format(measurement.xc)}</strong><small>Ohm</small></div><div><span>Mode</span><strong>{componentName}</strong><small>eksperimen</small></div></div></div><div className="formula-card"><span className="card-label">FORMULA AKTIF</span><div className="formula">{component === 'resistor' ? <>Z = R</> : component === 'capacitor' ? <>Z<sub>C</sub> = 1 / jωC</> : <>Z<sub>L</sub> = jωL</>}</div><p>Rangkaian ini hanya menampilkan respons komponen aktif yang dipilih.</p><div className="phase-bar"><span style={{ left: `${Math.min(96, Math.max(4, (measurement.phase + 90) / 180 * 100))}%` }} /></div><div className="phase-labels"><span>kapasitif</span><span>resistif</span><span>induktif</span></div></div></div>
    </section></div><footer><span>CIRCUITLAB SIM</span><span>Media pembelajaran elektronika dasar <b>•</b> RLC transient & AC steady-state</span></footer>
  </main>
}
