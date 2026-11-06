const AudioEngine = {
  _ctx: null,
  _muted: false,

  _getCtx() {
    if (!this._ctx) this._ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (this._ctx.state === 'suspended') this._ctx.resume();
    return this._ctx;
  },

  setMuted(v) { this._muted = v; },
  isMuted()   { return this._muted; },

  _secuencia(notas, startDelay = 0) {
    if (this._muted) return;
    const ctx  = this._getCtx();
    let tiempo = ctx.currentTime + startDelay;
    for (const nota of notas) {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type      = nota.type || 'sine';
      osc.frequency.setValueAtTime(nota.f, tiempo);
      gain.gain.setValueAtTime(nota.gain ?? 0.35, tiempo);
      gain.gain.exponentialRampToValueAtTime(0.001, tiempo + nota.t);
      osc.start(tiempo);
      osc.stop(tiempo + nota.t + 0.05);
      tiempo += nota.t;
    }
  },

  alertaSospechoso() {
    if (this._muted) return;
    const ctx = this._getCtx();
    for (let i = 0; i < 3; i++) {
      const delay = i * 0.55;
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'sawtooth';
      const t0 = ctx.currentTime + delay;
      osc.frequency.setValueAtTime(960, t0);
      osc.frequency.exponentialRampToValueAtTime(380, t0 + 0.45);
      gain.gain.setValueAtTime(0.0, t0);
      gain.gain.linearRampToValueAtTime(0.4, t0 + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.45);
      osc.start(t0); osc.stop(t0 + 0.5);
    }
    this._secuencia([
      { f: 1200, t: 0.08, type: 'square', gain: 0.25 },
      { f: 1000, t: 0.08, type: 'square', gain: 0.25 },
    ], 1.7);
  },

  alertaDesaparecido() {
    if (this._muted) return;
    const patron = [
      { f: 440, t: 0.18, type: 'sine', gain: 0.3 },
      { f: 660, t: 0.18, type: 'sine', gain: 0.3 },
      { f: 880, t: 0.28, type: 'sine', gain: 0.35 },
      { f: 0,   t: 0.12, type: 'sine', gain: 0.001 },
    ];
    this._secuencia([...patron, ...patron]);
  },

  alertaLPR() {
    if (this._muted) return;
    const ctx = this._getCtx();
    for (let i = 0; i < 2; i++) {
      const delay = i * 0.45;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'triangle';
      const t0 = ctx.currentTime + delay;
      osc.frequency.setValueAtTime(280, t0);
      osc.frequency.exponentialRampToValueAtTime(180, t0 + 0.35);
      gain.gain.setValueAtTime(0.0, t0);
      gain.gain.linearRampToValueAtTime(0.35, t0 + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.35);
      osc.start(t0); osc.stop(t0 + 0.4);
    }
    this._secuencia([
      { f: 600, t: 0.08, type: 'square', gain: 0.2 },
      { f: 500, t: 0.08, type: 'square', gain: 0.2 },
    ], 0.95);
  },

  click() {
    this._secuencia([{ f: 880, t: 0.06, type: 'sine', gain: 0.15 }]);
  },

  unlock() {
    const ctx = this._getCtx();
    if (ctx.state === 'suspended') ctx.resume();
  },
};

export default AudioEngine;
