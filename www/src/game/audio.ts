export type SoundCue = 'start' | 'shoot' | 'hit' | 'break' | 'pickup' | 'round' | 'over';

export class ArcadeAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private enabled = true;
  private lastHit = -1;
  private lastBreak = -1;

  constructor(enabled: boolean) {
    this.enabled = enabled;
  }

  unlock() {
    if (!this.enabled) return;
    try {
      if (!this.context) {
        const AudioConstructor = window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioConstructor) return;
        this.context = new AudioConstructor();
        this.master = this.context.createGain();
        this.master.gain.value = 0.15;
        this.master.connect(this.context.destination);
      }
      if (this.context.state === 'suspended') void this.context.resume().catch(() => {});
    } catch {
      // Audio is optional when a browser or device cannot create an audio context.
    }
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (this.context && this.master) {
      this.master.gain.setTargetAtTime(enabled ? 0.15 : 0, this.context.currentTime, 0.025);
    }
  }

  private note(frequency: number, duration: number, delay = 0, type: OscillatorType = 'sine', end?: number) {
    if (!this.context || !this.master || !this.enabled) return;
    const at = this.context.currentTime + delay;
    const oscillator = this.context.createOscillator();
    const envelope = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, at);
    if (end) oscillator.frequency.exponentialRampToValueAtTime(end, at + duration);
    envelope.gain.setValueAtTime(0.001, at);
    envelope.gain.exponentialRampToValueAtTime(0.45, at + 0.006);
    envelope.gain.exponentialRampToValueAtTime(0.001, at + duration);
    oscillator.connect(envelope);
    envelope.connect(this.master);
    oscillator.start(at);
    oscillator.stop(at + duration + 0.02);
    oscillator.onended = () => {
      oscillator.disconnect();
      envelope.disconnect();
    };
  }

  play(cue: SoundCue, value = 0) {
    if (!this.enabled || !this.context) return;
    const now = this.context.currentTime;
    switch (cue) {
      case 'start':
        [330, 440, 660, 880].forEach((note, index) => this.note(note, 0.18, index * 0.075, 'triangle'));
        break;
      case 'shoot':
        this.note(750, 0.11, 0, 'sine', 260);
        break;
      case 'hit':
        if (now - this.lastHit < 0.045) return;
        this.lastHit = now;
        this.note(480 + (value % 8) * 75, 0.065, 0, 'sine', 350);
        break;
      case 'break':
        if (now - this.lastBreak < 0.065) return;
        this.lastBreak = now;
        this.note(520 + value * 45, 0.13, 0, 'triangle');
        this.note(1040 + value * 45, 0.13, 0.035);
        break;
      case 'pickup':
        [660, 880, 1320].forEach((note, index) => this.note(note, 0.16, index * 0.06));
        break;
      case 'round':
        this.note(440, 0.1);
        this.note(660, 0.16, 0.06);
        break;
      case 'over':
        this.note(330, 0.6, 0, 'triangle', 70);
        this.note(220, 0.5, 0.1, 'sine', 55);
        break;
    }
  }

  dispose() {
    if (this.context) void this.context.close().catch(() => {});
    this.context = null;
    this.master = null;
  }
}