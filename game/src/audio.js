// Skyline Courier — sound, all synthesized with WebAudio. No audio files: the
// engine hum, the wind, the ring chime and the crash are oscillators and noise.

export function createAudio() {
  const audio = {
    ctx: null,
    master: null,
    engineOsc: null,
    engineGain: null,
    windSrc: null,
    windGain: null,
    muted: false,
    started: false,
  };

  // Must be called from a user gesture at least once.
  audio.ensure = function ensure() {
    if (audio.ctx) {
      if (audio.ctx.state === 'suspended') audio.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    audio.ctx = new Ctx();
    audio.master = audio.ctx.createGain();
    audio.master.gain.value = 0.5;
    audio.master.connect(audio.ctx.destination);

    // Engine: two detuned saws through a low-pass, pitch follows throttle.
    audio.engineOsc = audio.ctx.createOscillator();
    audio.engineOsc.type = 'sawtooth';
    audio.engineOsc.frequency.value = 55;
    const engineOsc2 = audio.ctx.createOscillator();
    engineOsc2.type = 'sawtooth';
    engineOsc2.frequency.value = 55.7;
    const engineFilter = audio.ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 320;
    audio.engineGain = audio.ctx.createGain();
    audio.engineGain.gain.value = 0;
    audio.engineOsc.connect(engineFilter);
    engineOsc2.connect(engineFilter);
    engineFilter.connect(audio.engineGain);
    audio.engineGain.connect(audio.master);
    audio.engineOsc.start();
    engineOsc2.start();
    audio.engineOsc2 = engineOsc2;

    // Wind: looped white noise through a band-pass.
    const len = audio.ctx.sampleRate * 2;
    const buffer = audio.ctx.createBuffer(1, len, audio.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    audio.windSrc = audio.ctx.createBufferSource();
    audio.windSrc.buffer = buffer;
    audio.windSrc.loop = true;
    const windFilter = audio.ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 500;
    windFilter.Q.value = 0.6;
    audio.windGain = audio.ctx.createGain();
    audio.windGain.gain.value = 0;
    audio.windSrc.connect(windFilter);
    windFilter.connect(audio.windGain);
    audio.windGain.connect(audio.master);
    audio.windSrc.start();

    audio.started = true;
  };

  // Called every frame with the plane's state.
  audio.update = function update(plane, flying) {
    if (!audio.ctx || audio.muted) return;
    const t = audio.ctx.currentTime;
    const throttle = plane ? plane.throttle : 0;
    const speed = plane ? plane.speed : 0;
    audio.engineGain.gain.setTargetAtTime(flying ? 0.05 + throttle * 0.075 : 0.0, t, 0.1);
    const freq = 48 + throttle * 55 + speed * 0.12;
    audio.engineOsc.frequency.setTargetAtTime(freq, t, 0.08);
    audio.engineOsc2.frequency.setTargetAtTime(freq * 1.013, t, 0.08);
    audio.windGain.gain.setTargetAtTime(flying ? Math.min(0.12, speed * 0.0006) : 0, t, 0.15);
  };

  audio.chime = function chime(perfect) {
    if (!audio.ctx || audio.muted) return;
    const t = audio.ctx.currentTime;
    [880, perfect ? 1318.5 : 1174.7].forEach((freq, i) => {
      const osc = audio.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const g = audio.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t + i * 0.07);
      g.gain.exponentialRampToValueAtTime(0.28, t + i * 0.07 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.07 + 0.55);
      osc.connect(g);
      g.connect(audio.master);
      osc.start(t + i * 0.07);
      osc.stop(t + i * 0.07 + 0.6);
    });
  };

  audio.thud = function thud() {
    if (!audio.ctx || audio.muted) return;
    const t = audio.ctx.currentTime;
    const osc = audio.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(38, t + 0.25);
    const g = audio.ctx.createGain();
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    osc.connect(g);
    g.connect(audio.master);
    osc.start(t);
    osc.stop(t + 0.32);
  };

  audio.crash = function crash() {
    if (!audio.ctx || audio.muted) return;
    const t = audio.ctx.currentTime;
    const len = audio.ctx.sampleRate * 0.7;
    const buffer = audio.ctx.createBuffer(1, len, audio.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = audio.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = audio.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 700;
    const g = audio.ctx.createGain();
    g.gain.setValueAtTime(0.7, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    src.connect(filter);
    filter.connect(g);
    g.connect(audio.master);
    src.start(t);
  };

  audio.click = function click() {
    if (!audio.ctx || audio.muted) return;
    const t = audio.ctx.currentTime;
    const osc = audio.ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = 660;
    const g = audio.ctx.createGain();
    g.gain.setValueAtTime(0.12, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    osc.connect(g);
    g.connect(audio.master);
    osc.start(t);
    osc.stop(t + 0.09);
  };

  audio.toggleMute = function toggleMute() {
    audio.muted = !audio.muted;
    if (audio.master) audio.master.gain.value = audio.muted ? 0 : 0.5;
    return audio.muted;
  };

  return audio;
}
