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
  lastCrit = 0;
  lastGrowl = 0;
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
      // A held breath, then the volley: sub drop, air rush and a bright minor stab.
      this.noise(0.9, 0.3);
      this.tone(110, 1.1, 'sine', 0.35, 'sfx', 0.35);
      this.tone(65, 0.8, 'triangle', 0.22);
      setTimeout(() => {
        for (const f of [587.33, 698.46, 880, 1174.66]) this.tone(f, 0.7, 'triangle', 0.06);
      }, 120);
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
    } else if (id === 'boss.intro') {
      // War drums under a rising drone.
      [0, 300, 600, 760, 920].forEach((ms, i) =>
        setTimeout(() => {
          this.tone(i < 3 ? 55 : 73.42, 0.6, 'sine', 0.4, 'sfx', 0.45);
          this.noise(0.12, 0.12);
        }, ms),
      );
      this.tone(73.42, 2.4, 'sawtooth', 0.05, 'sfx', 2);
      this.tone(110, 2.4, 'triangle', 0.06, 'sfx', 2);
    } else if (id === 'boss.fall') {
      // Collapse, then a resolving major chord.
      this.noise(1.2, 0.35);
      this.tone(82.41, 1.4, 'sine', 0.45, 'sfx', 0.4);
      setTimeout(() => {
        for (const f of [261.63, 329.63, 392, 523.25, 659.25]) this.tone(f, 2.2, 'sine', 0.06);
      }, 500);
    } else if (id.includes('telegraph') || id === 'formation.arrival')
      this.tone(146.83, 0.4, 'triangle', 0.15, 'sfx', 1.5);
    else if (id === 'hit.crit') {
      // A bright glassy ting, throttled so a volley of crits stays musical.
      const now = this.context.currentTime;
      if (now - this.lastCrit < 0.06) return;
      this.lastCrit = now;
      this.tone(1975.5, 0.16, 'sine', 0.09);
      this.tone(2959.96, 0.1, 'sine', 0.04);
      this.noise(0.03, 0.08);
    } else if (id === 'level.up') {
      // Surge: a sub drop and an air swell under a rising major arpeggio, then a held chord.
      this.tone(98, 0.9, 'sine', 0.3, 'sfx', 0.5);
      this.noise(0.5, 0.12);
      [392, 493.88, 587.33, 783.99, 987.77].forEach((f, i) =>
        setTimeout(
          () => {
            this.tone(f, 0.55, 'triangle', 0.1);
            this.tone(f * 2, 0.3, 'sine', 0.03);
          },
          60 + i * 55,
        ),
      );
      setTimeout(() => {
        for (const f of [392, 493.88, 587.33, 783.99]) this.tone(f, 1.4, 'sine', 0.05);
      }, 340);
    } else if (id === 'tool.moonraven') {
      // Caw: a falling, raspy chirp.
      this.tone(1250, 0.16, 'sawtooth', 0.05, 'sfx', 0.55);
      setTimeout(() => this.tone(1050, 0.14, 'sawtooth', 0.04, 'sfx', 0.6), 110);
      this.noise(0.06, 0.06);
    } else if (id === 'deadeye.strike') {
      return;
    } else if (id === 'enemy.hound.crouch') {
      // Pack growl: a rough low rumble, throttled so a pack crouching together growls once.
      const now = this.context.currentTime;
      if (now - this.lastGrowl < 0.4) return;
      this.lastGrowl = now;
      this.tone(70, 0.5, 'sawtooth', 0.08, 'sfx', 0.8);
      this.tone(105, 0.45, 'sawtooth', 0.04, 'sfx', 0.85);
    } else if (id === 'upgrade.starfall') {
      this.tone(1567.98, 0.5, 'sine', 0.08, 'sfx', 0.5);
      this.noise(0.35, 0.18);
      this.tone(98, 0.5, 'sine', 0.25, 'sfx', 0.6);
    } else if (id === 'upgrade.ricochet') {
      this.tone(2349.32, 0.06, 'triangle', 0.04, 'sfx', 1.3);
    } else if (id === 'streak.tier') {
      // Rising fanfare in key, higher with each tier.
      [587.33, 739.99, 880, 1174.66].forEach((f, i) =>
        setTimeout(() => this.tone(f, 0.35, 'triangle', 0.08), i * 50),
      );
    } else if (id === 'boss.fullmoon') {
      // Full Moon attack sting: a cold, rising fifth over a low swell.
      this.tone(220, 0.9, 'triangle', 0.07, 'sfx', 1.5);
      setTimeout(() => this.tone(329.63, 0.8, 'sine', 0.06, 'sfx', 1.4), 120);
    } else if (id === 'pace.lull') {
      this.tone(196, 2.2, 'sine', 0.08, 'sfx', 0.98);
    } else if (id === 'pace.swarm') {
      // A hunting horn: two low swelling notes.
      this.tone(110, 0.9, 'sawtooth', 0.07, 'sfx', 1.02);
      setTimeout(() => this.tone(146.83, 1.1, 'sawtooth', 0.07, 'sfx', 1.02), 450);
    } else if (id === 'coach.step') {
      this.tone(659.25, 0.35, 'sine', 0.1);
      setTimeout(() => this.tone(987.77, 0.5, 'sine', 0.09), 90);
    } else if (id === 'evolution.unlocked' || id === 'relic.open') {
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
  tick(time: number, drawing: number, quiet = false, boss = false) {
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
      if (boss) {
        // Battle pulse: a doubled heartbeat drum while a boss lives.
        this.tone(55, 0.25, 'sine', 0.22, 'music', 0.5);
        setTimeout(() => this.tone(55, 0.2, 'sine', 0.16, 'music', 0.5), 180);
        this.tone(220, 0.1, 'triangle', 0.03, 'music');
      } else if (time > 120) this.tone(49, 0.2, 'triangle', 0.08, 'music');
      if (drawing > 0) this.tone(80 + drawing * 180, 0.08, 'triangle', 0.025);
    }
  }
}
