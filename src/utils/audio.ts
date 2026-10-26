const MASTER_VOLUME = 0.3;

class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private initialized = false;
  private muted = (() => { try { return localStorage.getItem('midnight_paws_muted') === '1'; } catch { return false; } })();

  // Store audio clips as AudioBuffers
  private clips: Record<string, AudioBuffer> = {};

  isMuted() { return this.muted; }
  setMuted(muted: boolean) {
    this.muted = muted;
    try { localStorage.setItem('midnight_paws_muted', muted ? '1' : '0'); } catch { /* storage unavailable */ }
    if (this.masterGain) this.masterGain.gain.value = muted ? 0 : MASTER_VOLUME;
  }
  // Silence everything while the app is in the background, and pick back up after
  suspend() { if (this.ctx && this.ctx.state === 'running') this.ctx.suspend().catch(() => {}); }
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); }

  init() {
    try {
      if (!this.ctx) {
        this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = this.muted ? 0 : MASTER_VOLUME;
        this.masterGain.connect(this.ctx.destination);
        
        // Generate synthetic audio clips into AudioBuffers
        this.generateClips();
      }
      
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      
      this.initialized = true;
    } catch (e) {
      console.error("Audio Context initialization failed", e);
    }
  }
  
  private createBuffer(duration: number, renderFunc: (ctx: OfflineAudioContext, dest: AudioBufferSourceNode | GainNode) => void): Promise<AudioBuffer> {
    if (!this.ctx) return Promise.reject();
    const offlineCtx = new OfflineAudioContext(1, this.ctx.sampleRate * duration, this.ctx.sampleRate);
    renderFunc(offlineCtx, offlineCtx.destination as unknown as GainNode); // type hack
    return offlineCtx.startRendering();
  }

  private generateClips() {
    if (!this.ctx) return;
    
    // Jump Clip
    const jumpLength = this.ctx.sampleRate * 0.2;
    const jumpBuffer = this.ctx.createBuffer(1, jumpLength, this.ctx.sampleRate);
    const jumpData = jumpBuffer.getChannelData(0);
    for (let i = 0; i < jumpLength; i++) {
      const t = i / this.ctx.sampleRate;
      const freq = 150 + t * 500;
      jumpData[i] = Math.sign(Math.sin(2 * Math.PI * freq * t)) * Math.exp(-t * 15);
    }
    this.clips['jump'] = jumpBuffer;

    // Fish / Coin Clip
    const coinLength = this.ctx.sampleRate * 0.3;
    const coinBuffer = this.ctx.createBuffer(1, coinLength, this.ctx.sampleRate);
    const coinData = coinBuffer.getChannelData(0);
    for (let i = 0; i < coinLength; i++) {
      const t = i / this.ctx.sampleRate;
      const freq = t < 0.1 ? 800 : 1200;
      coinData[i] = Math.sin(2 * Math.PI * freq * t) * Math.exp(-t * 8);
    }
    this.clips['coin'] = coinBuffer;

    // Hit / Destroy Clip
    const hitLength = this.ctx.sampleRate * 0.3;
    const hitBuffer = this.ctx.createBuffer(1, hitLength, this.ctx.sampleRate);
    const hitData = hitBuffer.getChannelData(0);
    for (let i = 0; i < hitLength; i++) {
      const t = i / this.ctx.sampleRate;
      const noise = Math.random() * 2 - 1;
      const env = Math.exp(-t * 20);
      hitData[i] = noise * env;
    }
    this.clips['hit'] = hitBuffer;

    // Powerup Clip
    const powerLength = this.ctx.sampleRate * 0.4;
    const powerBuffer = this.ctx.createBuffer(1, powerLength, this.ctx.sampleRate);
    const powerData = powerBuffer.getChannelData(0);
    for (let i = 0; i < powerLength; i++) {
      const t = i / this.ctx.sampleRate;
      const freq = 400 + Math.floor(t * 10) * 100;
      powerData[i] = Math.sign(Math.sin(2 * Math.PI * freq * t)) * Math.exp(-t * 5);
    }
    this.clips['powerup'] = powerBuffer;
    
    // Destroy Object Clip (Explosion)
    const destroyLength = this.ctx.sampleRate * 0.5;
    const destroyBuffer = this.ctx.createBuffer(1, destroyLength, this.ctx.sampleRate);
    const destroyData = destroyBuffer.getChannelData(0);
    for (let i = 0; i < destroyLength; i++) {
      const t = i / this.ctx.sampleRate;
      const noise = (Math.random() * 2 - 1) * Math.sin(2 * Math.PI * 50 * t);
      const env = Math.exp(-t * 10);
      destroyData[i] = noise * env;
    }
    this.clips['destroy'] = destroyBuffer;

    // Meow Clip
    const meowLength = this.ctx.sampleRate * 0.6;
    const meowBuffer = this.ctx.createBuffer(1, meowLength, this.ctx.sampleRate);
    const meowData = meowBuffer.getChannelData(0);
    for (let i = 0; i < meowLength; i++) {
      const t = i / this.ctx.sampleRate;
      // Frequency slide: 400 -> 600 -> 300
      let freq = 400;
      if (t < 0.3) freq = 400 + (t / 0.3) * 200;
      else freq = 600 - ((t - 0.3) / 0.3) * 300;
      // Simple waveform with harmonics
      const val = Math.sin(2 * Math.PI * freq * t) + 0.5 * Math.sin(2 * Math.PI * (freq * 2) * t);
      // Envelope
      const env = Math.sin((t / 0.6) * Math.PI);
      meowData[i] = val * env * 0.3;
    }
    this.clips['meow'] = meowBuffer;

    // Purr Clip
    const purrLength = this.ctx.sampleRate * 1.5;
    const purrBuffer = this.ctx.createBuffer(1, purrLength, this.ctx.sampleRate);
    const purrData = purrBuffer.getChannelData(0);
    for (let i = 0; i < purrLength; i++) {
      const t = i / this.ctx.sampleRate;
      // Low frequency noise/rumble
      const noise = (Math.random() * 2 - 1) * 0.5 + Math.sin(2 * Math.PI * 40 * t);
      // Amplitude modulation (purr pulsing ~25Hz)
      const env = (Math.sin(2 * Math.PI * 25 * t) * 0.5 + 0.5) * Math.sin((t / 1.5) * Math.PI);
      purrData[i] = noise * env * 0.15;
    }
    this.clips['purr'] = purrBuffer;

    // Boss Alert Clip
    const alertLength = this.ctx.sampleRate * 1.5;
    const alertBuffer = this.ctx.createBuffer(1, alertLength, this.ctx.sampleRate);
    const alertData = alertBuffer.getChannelData(0);
    for (let i = 0; i < alertLength; i++) {
      const t = i / this.ctx.sampleRate;
      const freq = t % 0.5 < 0.25 ? 400 : 600; // Siren effect
      const env = Math.exp(-(t % 0.25) * 5);
      alertData[i] = Math.sign(Math.sin(2 * Math.PI * freq * t)) * env * 0.4;
    }
    this.clips['bossAlert'] = alertBuffer;

    // Boss Music Loop (Simple ominous bass)
    const musicLength = this.ctx.sampleRate * 2.0;
    const musicBuffer = this.ctx.createBuffer(1, musicLength, this.ctx.sampleRate);
    const musicData = musicBuffer.getChannelData(0);
    for (let i = 0; i < musicLength; i++) {
      const t = i / this.ctx.sampleRate;
      // 4 notes: C2, D#2, F2, F#2
      let note = 65.41; // C2
      if (t > 1.5) note = 92.50; // F#2
      else if (t > 1.0) note = 87.31; // F2
      else if (t > 0.5) note = 77.78; // D#2
      
      const env = Math.exp(-(t % 0.5) * 4);
      // Square-ish wave for bass
      const wave = Math.sign(Math.sin(2 * Math.PI * note * t));
      musicData[i] = wave * env * 0.2;
    }
    this.clips['bossMusic'] = musicBuffer;



  }

  playClip(name: string, volume = 1) {
    if (!this.ctx || !this.masterGain || !this.clips[name]) return;
    try {
      const source = this.ctx.createBufferSource();
      source.buffer = this.clips[name];
      
      const gain = this.ctx.createGain();
      gain.gain.value = volume;
      
      source.connect(gain);
      gain.connect(this.masterGain);
      source.start();
    } catch(e) {}
  }

  playJump() {
    this.playClip('jump', 0.4);
  }

  playCoin() {
    this.playClip('coin', 0.5);
  }

  playPowerup() {
    this.playClip('powerup', 0.4);
  }

  playHit() {
    this.playClip('hit', 0.6);
  }
  
  playDestroy() {
    this.playClip('destroy', 0.8);
  }

  playMeow() {
    this.playClip('meow', 0.6);
  }

  playPurr() {
    this.playClip('purr', 0.8);
  }

  playBossAlert() {
    this.playClip('bossAlert', 0.7);
  }

  private bossMusicNode: AudioBufferSourceNode | null = null;
  startBossMusic() {
    if (!this.ctx || !this.masterGain || !this.clips['bossMusic']) return;
    try {
      if (this.bossMusicNode) this.stopBossMusic();
      this.bossMusicNode = this.ctx.createBufferSource();
      this.bossMusicNode.buffer = this.clips['bossMusic'];
      this.bossMusicNode.loop = true;
      
      const gain = this.ctx.createGain();
      gain.gain.value = 0.5;
      
      this.bossMusicNode.connect(gain);
      gain.connect(this.masterGain);
      this.bossMusicNode.start();
    } catch(e) {}
  }
  stopBossMusic() {
    if (this.bossMusicNode) {
       try { this.bossMusicNode.stop(); } catch(e) {}
       this.bossMusicNode = null;
    }
  }
}

export const audio = new AudioEngine();
