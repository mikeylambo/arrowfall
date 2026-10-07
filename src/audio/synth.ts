import type { AudioSystem } from '@slu/web-shell';
export class Synth implements AudioSystem {
  context: AudioContext | null = null;
  master: GainNode | null = null;
  music: GainNode | null = null;
  volumes: Record<string, number> = { master: 0.6, music: 0.25, sfx: 0.7, ui: 0.4 };
  muted = false;
  streak = 0;
  cue = 'moonrise';
  voiceCount = 0;
  nextBeat = 0;
  unlock() {
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.connect(this.context.destination);
      this.music = this.context.createGain();
      this.music.connect(this.master);
      this.setBusVolume('master', this.volumes.master);
    }
    void this.context.resume();
  }
  setBusVolume(bus: string, value: number) {
    this.volumes[bus] = value;
    if (bus === 'master' && this.master) this.master.gain.value = this.muted ? 0 : value;
    if (bus === 'music' && this.music) this.music.gain.value = value;
  }
  setMuted(muted: boolean) {
    this.muted = muted;
    this.setBusVolume('master', this.volumes.master);
  }
  pauseAll() {
    void this.context?.suspend();
  }
  resumeAll() {
    void this.context?.resume();
  }
  tone(
    freq: number,
    duration: number,
    type: OscillatorType = 'sine',
    volume = 0.12,
    bus = 'sfx',
    slide = 1,
  ) {
    const c = this.context;
    if (!c || this.muted || this.voiceCount >= 24) return;
    this.voiceCount++;
    const osc = c.createOscillator(),
      gain = c.createGain(),
      now = c.currentTime;
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), now + duration);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume * (this.volumes[bus] ?? 0.5), now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(bus === 'music' ? this.music! : this.master!);
    osc.start();
    osc.stop(now + duration);
    osc.onended = () => {
      this.voiceCount--;
      osc.disconnect();
      gain.disconnect();
    };
  }
  noise(duration: number, volume = 0.06) {
    const c = this.context;
    if (!c || this.voiceCount >= 24) return;
    const buffer = c.createBuffer(1, Math.floor(c.sampleRate * duration), c.sampleRate),
      data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = c.createBufferSource(),
      filter = c.createBiquadFilter(),
      gain = c.createGain();
    src.buffer = buffer;
    filter.type = 'bandpass';
    filter.frequency.value = 1100;
    gain.gain.value = volume * this.volumes.sfx;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master!);
    src.start();
    src.onended = () => {
      src.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
  }
  playSfx(id: string) {
    if (!this.context) return;
    if (id === 'bow.window' || id === 'bow.perfect') {
      const scale = [293.66, 349.23, 440, 523.25, 587.33],
        freq = scale[this.streak++ % scale.length] * (this.cue === 'midnight' ? 0.89 : 1);
      this.tone(freq, 0.45, 'sine', 0.25);
      this.tone(freq * 2, 0.22, 'sine', 0.07);
      this.tone(freq * 3, 0.12, 'sine', 0.03);
      if (id === 'bow.perfect') this.noise(0.1, 0.1);
    } else if (id === 'deadeye.enter') {
      this.tone(110, 0.8, 'sine', 0.2, 'sfx', 0.35);
      this.music!.gain.setTargetAtTime(0.05, this.context.currentTime, 0.1);
    } else if (id === 'deadeye.release') {
      this.noise(0.7, 0.25);
      this.tone(65, 0.6, 'triangle', 0.2);
      this.music!.gain.setTargetAtTime(this.volumes.music, this.context.currentTime, 0.3);
    } else if (id === 'deadeye.mark') this.tone(440 * (1 + this.streak++ * 0.03), 0.1, 'sine', 0.1);
    else if (id === 'player.hurt' || id === 'player.death')
      this.tone(100, 0.3, 'sawtooth', 0.1, 'sfx', 0.35);
    else if (id === 'world.midnight') {
      for (let i = 0; i < 12; i++) setTimeout(() => this.tone(146.83, 1.5, 'sine', 0.2), i * 220);
    } else if (id.startsWith('pickup'))
      this.tone(id === 'pickup.heal' ? 523.25 : 659.25, 0.12, 'sine', 0.06);
    else if (id.startsWith('enemy.hit')) {
      this.noise(0.045, 0.055);
      if (id.endsWith('armor')) this.tone(1400, 0.08, 'sine', 0.035);
    } else if (id.includes('telegraph') || id === 'boss.intro' || id === 'formation.arrival')
      this.tone(146.83, 0.4, 'triangle', 0.15, 'sfx', 1.5);
    else if (id === 'level.up' || id === 'evolution.unlocked' || id === 'relic.open') {
      [293.66, 349.23, 440, 587.33].forEach((f, i) =>
        setTimeout(() => this.tone(f, 0.4, 'sine', 0.15), i * 70),
      );
    } else if (id.startsWith('bow') || id.includes('dodge')) this.noise(0.12, 0.09);
    else this.tone(220, 0.07, 'triangle', 0.025);
  }
  playMusic(id: string) {
    this.cue = id;
  }
  /** Ambient score. `quiet` (cards, pause) keeps only the pad: no pulse, no draw tone. */
  tick(time: number, drawing: number, quiet = false) {
    if (!this.context) return;
    const now = this.context.currentTime;
    if (now >= this.nextBeat) {
      this.nextBeat = now + 0.75;
      const phase =
        time >= 900
          ? 'false-dawn'
          : time >= 600
            ? 'midnight'
            : time >= 300
              ? 'deep-night'
              : 'moonrise';
      this.cue = phase;
      const minor = time >= 600;
      const notes = minor ? [73.42, 87.31, 110, 130.81] : [73.42, 98, 110, 146.83];
      for (const f of notes) this.tone(f, 2.5, 'sine', 0.028, 'music');
      if (quiet) return;
      if (time > 120) this.tone(49, 0.2, 'triangle', 0.08, 'music');
      if (drawing > 0) this.tone(80 + drawing * 180, 0.08, 'triangle', 0.025);
    }
  }
}
