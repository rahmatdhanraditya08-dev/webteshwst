(() => {
  'use strict';

  const state = { circuit: 'series', mode: 'ac', running: false, elapsed: 0, lastFrame: 0, phase: 0 };
  const defaults = { voltage: 12, frequency: 60, resistance: 470, capacitance: 100, inductance: 220 };
  const ids = ['voltage', 'frequency', 'resistance', 'capacitance', 'inductance'];
  const $ = (id) => document.getElementById(id);
  const circuitCanvas = $('circuitCanvas');
  const waveCanvas = $('waveCanvas');
  const circuitCtx = circuitCanvas.getContext('2d');
  const waveCtx = waveCanvas.getContext('2d');

  function readParameters() {
    return {
      voltage: Number($('voltage').value), frequency: state.mode === 'ac' ? Number($('frequency').value) : 0,
      resistance: Number($('resistance').value), capacitance: Number($('capacitance').value) * 1e-6,
      inductance: Number($('inductance').value) * 1e-3
    };
  }

  function calculate(params) {
    const omega = 2 * Math.PI * params.frequency;
    const xl = omega * params.inductance;
    const xc = params.frequency ? 1 / (omega * params.capacitance) : 0;
    if (params.frequency === 0) {
      const isSeries = state.circuit === 'series';
      return { xl: 0, xc: 0, real: isSeries ? Infinity : 0, imaginary: 0, magnitude: isSeries ? Infinity : 0, phase: 0, rmsCurrent: isSeries ? 0 : Infinity, resonance: 1 / (2 * Math.PI * Math.sqrt(params.inductance * params.capacitance)) };
    }
    let real; let imaginary;
    if (state.circuit === 'series') {
      real = params.resistance;
      imaginary = xl - xc;
    } else {
      const branches = [{ real: 1 / params.resistance, imaginary: 0 }, { real: 0, imaginary: omega * params.capacitance }, { real: 0, imaginary: -1 / Math.max(xl, 0.000001) }];
      const conductance = branches.reduce((sum, branch) => sum + branch.real, 0);
      const susceptance = branches.reduce((sum, branch) => sum + branch.imaginary, 0);
      const denominator = conductance ** 2 + susceptance ** 2;
      real = conductance / denominator;
      imaginary = -susceptance / denominator;
    }
    const magnitude = Math.sqrt(real ** 2 + imaginary ** 2);
    const phase = Math.atan2(imaginary, real) * 180 / Math.PI;
    const rmsCurrent = params.voltage / Math.max(magnitude, 0.000001);
    const resonance = 1 / (2 * Math.PI * Math.sqrt(params.inductance * params.capacitance));
    return { xl, xc, real, imaginary, magnitude, phase, rmsCurrent, resonance };
  }

  function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
  function format(value, digits = 2) { if (value === Infinity) return '∞'; if (value === -Infinity) return '-∞'; return Number.isFinite(value) ? value.toFixed(digits) : '—'; }

  function updateCalculation() {
    const params = readParameters();
    const result = calculate(params);
    $('impedanceValue').textContent = format(result.magnitude);
    $('currentValue').textContent = format(result.rmsCurrent * 1000, 1);
    $('phaseValue').textContent = format(result.phase, 1);
    $('resonanceValue').textContent = format(result.resonance, 1);
    $('xlValue').textContent = format(result.xl, 2);
    $('xcValue').textContent = format(result.xc, 2);
    $('topologyValue').textContent = state.circuit === 'series' ? 'Seri' : 'Paralel';
    $('readoutMode').textContent = `${state.mode.toUpperCase()} / ${state.circuit.toUpperCase()}`;
    $('impedanceDetail').textContent = `Re ${format(result.real, 1)} / Im ${format(result.imaginary, 1)}`;
    $('currentDetail').textContent = `I = ${format(result.rmsCurrent * 1000, 1)} mA RMS`;
    $('formulaText').innerHTML = state.circuit === 'series' ? 'Z = R + j(X<sub>L</sub> - X<sub>C</sub>)' : '1/Z = 1/R + 1/jX<sub>L</sub> + jX<sub>C</sub>';
    $('phaseBar').style.left = `${clamp((result.phase + 90) / 180 * 100, 4, 96)}%`;
    drawCircuit(params, result);
    drawWave(params, result);
  }

  function syncRange(source, target) {
    $(source).addEventListener('input', () => { $(target).value = $(source).value; updateCalculation(); });
    $(target).addEventListener('input', () => { $(source).value = $(target).value; updateCalculation(); });
  }

  function setupControls() {
    syncRange('voltageRange', 'voltage'); syncRange('frequencyRange', 'frequency'); syncRange('resistanceRange', 'resistance'); syncRange('capacitanceRange', 'capacitance'); syncRange('inductanceRange', 'inductance');
    ids.forEach((id) => $(id).addEventListener('change', () => { const range = $(`${id}Range`); range.value = $(id).value; updateCalculation(); }));
    document.querySelectorAll('[data-circuit]').forEach((button) => button.addEventListener('click', () => { state.circuit = button.dataset.circuit; document.querySelectorAll('[data-circuit]').forEach((item) => item.classList.toggle('active', item === button)); updateCalculation(); }));
    document.querySelectorAll('[data-mode]').forEach((button) => button.addEventListener('click', () => { state.mode = button.dataset.mode; document.querySelectorAll('[data-mode]').forEach((item) => item.classList.toggle('active', item === button)); $('frequencyField').style.opacity = state.mode === 'ac' ? '1' : '.42'; $('frequencyField').style.pointerEvents = state.mode === 'ac' ? 'auto' : 'none'; updateCalculation(); }));
    $('playButton').addEventListener('click', toggleSimulation);
    $('resetButton').addEventListener('click', resetSimulation);
  }

  function toggleSimulation() {
    state.running = !state.running;
    $('playButton').innerHTML = state.running ? '<span class="play-icon">&#10074;&#10074;</span><span>Jeda simulasi</span>' : '<span class="play-icon">&#9654;</span><span>Lanjutkan simulasi</span>';
    $('statusText').textContent = state.running ? 'Simulasi sedang berjalan' : 'Simulasi dijeda';
    document.querySelector('.status-dot').style.background = state.running ? '#e89057' : '#72b78e';
    if (state.running) { state.lastFrame = performance.now(); requestAnimationFrame(animate); }
  }

  function resetSimulation() {
    ids.forEach((id) => { $(id).value = defaults[id]; $(`${id}Range`).value = defaults[id]; });
    state.elapsed = 0; state.phase = 0; state.running = false; $('measurementTime').textContent = 't = 0.00 s'; $('playButton').innerHTML = '<span class="play-icon">&#9654;</span><span>Mulai simulasi</span>'; $('statusText').textContent = 'Siap disimulasikan'; updateCalculation();
  }

  function resizeCanvas(canvas, ctx) {
    const ratio = window.devicePixelRatio || 1; const width = canvas.clientWidth; const height = canvas.clientHeight;
    if (canvas.width !== width * ratio || canvas.height !== height * ratio) { canvas.width = width * ratio; canvas.height = height * ratio; ctx.setTransform(ratio, 0, 0, ratio, 0, 0); }
    return { width, height };
  }

  function drawCircuit(params, result) {
    const { width, height } = resizeCanvas(circuitCanvas, circuitCtx); circuitCtx.clearRect(0, 0, width, height);
    const y = height / 2 + 7; const left = 42; const right = width - 42; const top = 43; const bottom = height - 32;
    circuitCtx.lineWidth = 2; circuitCtx.strokeStyle = '#b9c9c1'; circuitCtx.fillStyle = '#182326';
    const line = (x1, y1, x2, y2) => { circuitCtx.beginPath(); circuitCtx.moveTo(x1, y1); circuitCtx.lineTo(x2, y2); circuitCtx.stroke(); };
    const label = (text, x, yy, color = '#708083') => { circuitCtx.fillStyle = color; circuitCtx.font = '10px DM Mono, monospace'; circuitCtx.textAlign = 'center'; circuitCtx.fillText(text, x, yy); };
    if (state.circuit === 'series') {
      const points = [left, left + 50, left + 112, left + 185, right - 112, right - 48, right];
      line(left, y, points[1], y); line(points[1], y, points[2], y); line(points[2], y, points[3], y); line(points[3], y, points[4], y); line(points[4], y, points[5], y); line(points[5], y, right, y); line(right, y, right, top); line(right, top, left, top); line(left, top, left, y);
      drawSource(left, y, top); drawResistor(points[1], y); drawInductor(points[2], y); drawCapacitor(points[4], y); label('R', points[1], y + 34, '#e89057'); label('L', points[2] + 26, y + 34, '#1b8c87'); label('C', points[4], y + 34, '#3e8cc4');
    } else {
      line(left, y, left + 50, y); line(right - 50, y, right, y); line(left, y, left, top); line(right, y, right, top); line(left, top, right, top); line(left, y, left, bottom); line(right, y, right, bottom); line(left, bottom, right, bottom); drawSource(left, y, top); drawResistor(width / 2 - 100, top); drawInductor(width / 2, top); drawCapacitor(width / 2 + 100, top); drawResistor(width / 2 - 100, bottom); drawInductor(width / 2, bottom); drawCapacitor(width / 2 + 100, bottom); label('R', width / 2 - 100, top - 16, '#e89057'); label('L', width / 2, top - 16, '#1b8c87'); label('C', width / 2 + 100, top - 16, '#3e8cc4');
    }
    const speed = Math.min(120, 22 + result.rmsCurrent * 1000 / 3); const electronCount = 13; const flow = state.mode === 'dc' ? state.phase * speed / 40 : Math.sin(state.phase * Math.max(1, params.frequency / 18)) * speed / 45;
    circuitCtx.fillStyle = '#1b8c87'; for (let index = 0; index < electronCount; index += 1) { const progress = ((index / electronCount + state.phase * .025) % 1); const x = left + ((right - left) * progress); const yy = state.circuit === 'series' ? y : y + Math.sin(progress * Math.PI * 2) * 0; circuitCtx.beginPath(); circuitCtx.arc(x, yy + flow * .05, 3, 0, Math.PI * 2); circuitCtx.fill(); }
    label(`${params.voltage.toFixed(1)} V ${state.mode.toUpperCase()}`, left, bottom + 18, '#e89057'); label(`|I| ${format(result.rmsCurrent * 1000, 1)} mA`, right - 35, bottom + 18, '#1b8c87');
  }

  function drawSource(x, y, top) { circuitCtx.strokeStyle = '#e89057'; circuitCtx.lineWidth = 2; circuitCtx.beginPath(); circuitCtx.arc(x, y - 1, 16, 0, Math.PI * 2); circuitCtx.stroke(); circuitCtx.fillStyle = '#e89057'; circuitCtx.font = '14px DM Mono, monospace'; circuitCtx.textAlign = 'center'; circuitCtx.fillText('~', x, y + 5); circuitCtx.strokeStyle = '#b9c9c1'; }
  function drawResistor(x, y) { circuitCtx.strokeStyle = '#e89057'; circuitCtx.beginPath(); circuitCtx.moveTo(x - 26, y); circuitCtx.lineTo(x - 15, y); circuitCtx.lineTo(x - 10, y - 9); circuitCtx.lineTo(x, y + 9); circuitCtx.lineTo(x + 10, y - 9); circuitCtx.lineTo(x + 15, y); circuitCtx.lineTo(x + 26, y); circuitCtx.stroke(); circuitCtx.strokeStyle = '#b9c9c1'; }
  function drawInductor(x, y) { circuitCtx.strokeStyle = '#1b8c87'; circuitCtx.beginPath(); circuitCtx.moveTo(x - 28, y); circuitCtx.lineTo(x - 20, y); for (let i = 0; i < 3; i += 1) circuitCtx.arc(x - 12 + i * 12, y, 8, Math.PI, 0); circuitCtx.lineTo(x + 27, y); circuitCtx.stroke(); circuitCtx.strokeStyle = '#b9c9c1'; }
  function drawCapacitor(x, y) { circuitCtx.strokeStyle = '#3e8cc4'; circuitCtx.beginPath(); circuitCtx.moveTo(x - 27, y, x - 5, y); circuitCtx.moveTo(x - 5, y - 16); circuitCtx.lineTo(x - 5, y + 16); circuitCtx.moveTo(x + 5, y - 16); circuitCtx.lineTo(x + 5, y + 16); circuitCtx.moveTo(x + 5, y, x + 27, y); circuitCtx.stroke(); circuitCtx.strokeStyle = '#b9c9c1'; }

  function drawWave(params, result) {
    const { width, height } = resizeCanvas(waveCanvas, waveCtx); waveCtx.clearRect(0, 0, width, height); waveCtx.strokeStyle = '#e2ebe6'; waveCtx.lineWidth = 1;
    for (let x = 0; x <= width; x += width / 8) { waveCtx.beginPath(); waveCtx.moveTo(x, 0); waveCtx.lineTo(x, height); waveCtx.stroke(); } for (let y = 0; y <= height; y += height / 4) { waveCtx.beginPath(); waveCtx.moveTo(0, y); waveCtx.lineTo(width, y); waveCtx.stroke(); }
    const center = height / 2; const amplitude = height * .31; const phaseRad = result.phase * Math.PI / 180; const cycles = state.mode === 'ac' ? 2 : .35;
    const plot = (color, offset, scale) => { waveCtx.strokeStyle = color; waveCtx.lineWidth = 2; waveCtx.beginPath(); for (let x = 0; x <= width; x += 2) { const t = x / width; const value = Math.sin(t * Math.PI * 2 * cycles - state.phase * .06 + offset); const yy = center - value * amplitude * scale; if (x === 0) waveCtx.moveTo(x, yy); else waveCtx.lineTo(x, yy); } waveCtx.stroke(); };
    plot('#e89057', 0, 1); plot('#1b8c87', -phaseRad, .75); waveCtx.fillStyle = '#9aa8a6'; waveCtx.font = '9px DM Mono, monospace'; waveCtx.fillText('0', 5, center - 5); waveCtx.fillText('t', width - 10, height - 7);
  }

  function animate(timestamp) { if (!state.running) return; const delta = Math.min(.05, (timestamp - state.lastFrame) / 1000); state.lastFrame = timestamp; state.elapsed += delta; state.phase += delta * 6; const params = readParameters(); const result = calculate(params); $('measurementTime').textContent = `t = ${state.elapsed.toFixed(2)} s`; drawCircuit(params, result); drawWave(params, result); requestAnimationFrame(animate); }
  window.addEventListener('resize', updateCalculation); setupControls(); updateCalculation();
})();
