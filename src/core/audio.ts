/**
 * Restrained procedural soundscape built with the Web Audio API.
 * Nothing is created until `start()` is called from a user gesture.
 */
class AudioEngine {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  ambient: GainNode | null = null;
  private muted = false;
  private lastTick = 0;
  private padNodes: AudioNode[] = [];
  private filter: BiquadFilterNode | null = null;

  get ready() {
    return !!this.ctx;
  }

  start() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    const master = ctx.createGain();
    master.gain.value = this.muted ? 0 : 0.7;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 3;
    master.connect(comp).connect(ctx.destination);
    this.master = master;
    this.buildAmbient();
  }

  private buildAmbient() {
    const ctx = this.ctx!;
    const amb = ctx.createGain();
    amb.gain.value = 0;
    amb.gain.linearRampToValueAtTime(0.055, ctx.currentTime + 4);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 520;
    filter.Q.value = 0.6;
    this.filter = filter;
    filter.connect(amb).connect(this.master!);
    // a soft open-fifth drone with slow detuned beating
    const freqs = [55, 82.41, 110.0, 164.81];
    for (const [i, f] of freqs.entries()) {
      for (const det of [-4, 4]) {
        const o = ctx.createOscillator();
        o.type = i % 2 ? 'sine' : 'triangle';
        o.frequency.value = f;
        o.detune.value = det;
        const g = ctx.createGain();
        g.gain.value = 0.18 / (i + 1);
        o.connect(g).connect(filter);
        o.start();
        this.padNodes.push(o, g);
      }
    }
    // slow filter sweep
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.045;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 220;
    lfo.connect(lfoGain).connect(filter.frequency);
    lfo.start();
    this.ambient = amb;
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master && this.ctx) {
      this.master.gain.cancelScheduledValues(this.ctx.currentTime);
      this.master.gain.linearRampToValueAtTime(m ? 0 : 0.7, this.ctx.currentTime + 0.25);
    }
  }

  /** Shift the ambient colour per equation (0..1). */
  setMood(x: number) {
    if (!this.ctx || !this.filter) return;
    this.filter.frequency.setTargetAtTime(380 + 500 * x, this.ctx.currentTime, 1.5);
  }

  private tone(freq: number, dur: number, type: OscillatorType, gain: number, when = 0) {
    if (!this.ctx || !this.master || this.muted) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  /** Tiny pitched tick for continuous controls (rate-limited). value in 0..1 maps to pitch. */
  tick(value = 0.5) {
    const now = performance.now();
    if (now - this.lastTick < 55) return;
    this.lastTick = now;
    this.tone(420 + 520 * value, 0.08, 'sine', 0.035);
  }

  click() {
    this.tone(880, 0.09, 'triangle', 0.05);
  }

  success() {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.tone(f, 0.5, 'sine', 0.05, i * 0.07));
  }

  /** Airy swell for major transitions. */
  swell() {
    if (!this.ctx || !this.master || this.muted) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const len = 1.6;
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * len), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.5;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 2.5;
    bp.frequency.setValueAtTime(300, t);
    bp.frequency.exponentialRampToValueAtTime(2400, t + len * 0.7);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.09, t + 0.5);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    src.connect(bp).connect(g).connect(this.master);
    src.start(t);
    this.tone(220, 1.4, 'sine', 0.04, 0.1);
    this.tone(330, 1.4, 'sine', 0.03, 0.25);
  }
}

export const audio = new AudioEngine();
