// Synthesized sound, no audio files: an engine hum that follows the car's
// speed, a two-tone police siren, and short blips for pickups, shots, punches
// and crashes. The context only starts after a user gesture, so it never
// autoplay-blocks.

export function createAudio() {
  let ctx = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = 0;
  let sirenHigh = false;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext ?? window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 320;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(ctx.destination);
      engineOsc.start();
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'triangle';
      sirenOsc.frequency.value = 660;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(ctx.destination);
      sirenOsc.start();
      return true;
    } catch {
      return false;
    }
  }

  function unlock() {
    if (ensure() && ctx.state === 'suspended') ctx.resume().catch(() => {});
  }

  /** A short tone: frequency, duration, type and volume. */
  function blip(freq, duration, type, volume, slideTo) {
    if (!ensure()) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + duration);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  /** A burst of noise (gunshot, crash): duration and volume. */
  function noise(duration, volume, lowpass) {
    if (!ensure()) return;
    const t = ctx.currentTime;
    const len = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    source.start(t);
  }

  return {
    unlock,
    /** The engine hum follows the player's car speed; silent on foot. */
    setEngine(speed, maxSpeed, driving) {
      if (!ctx) return;
      const level = driving ? 0.05 + 0.05 * Math.abs(speed) / maxSpeed : 0;
      engineGain.gain.setTargetAtTime(level, ctx.currentTime, 0.08);
      engineOsc.frequency.setTargetAtTime(52 + 130 * Math.abs(speed) / maxSpeed, ctx.currentTime, 0.08);
    },
    /** The siren wails while any heat is on. */
    setSiren(on, dt) {
      if (!ctx) return;
      if (!on) {
        sirenGain.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
        return;
      }
      sirenGain.gain.setTargetAtTime(0.045, ctx.currentTime, 0.1);
      sirenTimer += dt;
      if (sirenTimer > 0.42) {
        sirenTimer = 0;
        sirenHigh = !sirenHigh;
        sirenOsc.frequency.setTargetAtTime(sirenHigh ? 880 : 660, ctx.currentTime, 0.02);
      }
    },
    pickup() { blip(880, 0.14, 'sine', 0.16, 1320); },
    coin() { blip(660, 0.1, 'sine', 0.12, 990); },
    shoot() { noise(0.12, 0.25, 2400); },
    punch() { noise(0.08, 0.2, 700); },
    crash() { noise(0.22, 0.3, 500); },
    hurt() { blip(180, 0.18, 'sawtooth', 0.14, 90); },
    mission() { blip(523, 0.12, 'sine', 0.16); setTimeout(() => blip(784, 0.18, 'sine', 0.16), 130); },
    fail() { blip(220, 0.3, 'sawtooth', 0.14, 110); },
  };
}
