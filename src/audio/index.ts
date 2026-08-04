export type SoundEvent =
  | "move"
  | "capture"
  | "check"
  | "premove"
  | "illegal"
  | "tenseconds"
  | "victory"
  | "defeat"
  | "draw";

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private muted = false;
  private volume = 0.8;

  constructor() {
    // Lazy AudioContext initialization on first user gesture
  }

  private ensureContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = this.muted ? 0 : this.volume;
        this.masterGain.connect(this.ctx.destination);
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(
        muted ? 0 : this.volume,
        this.ctx.currentTime,
      );
    }
  }

  setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.masterGain && this.ctx && !this.muted) {
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
    }
  }

  playSound(event: SoundEvent) {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || this.muted) return;

    const now = ctx.currentTime;

    switch (event) {
      case "move": {
        // Soft wooden click
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        osc.type = "triangle";
        osc.frequency.setValueAtTime(420, now);
        osc.frequency.exponentialRampToValueAtTime(120, now + 0.035);

        filter.type = "lowpass";
        filter.frequency.setValueAtTime(1200, now);

        gain.gain.setValueAtTime(0.7, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        osc.start(now);
        osc.stop(now + 0.035);
        break;
      }

      case "capture": {
        // Heavy sub-bass thud + violent crunch noise impact
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        osc.type = "triangle";
        osc.frequency.setValueAtTime(240, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.09);

        filter.type = "lowpass";
        filter.frequency.setValueAtTime(1000, now);

        gain.gain.setValueAtTime(0.95, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        osc.start(now);
        osc.stop(now + 0.09);

        // Synthesize short noise crunch burst for shatter effect
        try {
          const bufferSize = ctx.sampleRate * 0.05; // 50ms noise
          const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
          const data = buffer.getChannelData(0);
          for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
          }

          const noise = ctx.createBufferSource();
          noise.buffer = buffer;

          const noiseFilter = ctx.createBiquadFilter();
          noiseFilter.type = "bandpass";
          noiseFilter.frequency.setValueAtTime(1400, now);

          const noiseGain = ctx.createGain();
          noiseGain.gain.setValueAtTime(0.6, now);
          noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

          noise.connect(noiseFilter);
          noiseFilter.connect(noiseGain);
          noiseGain.connect(this.masterGain);

          noise.start(now);
          noise.stop(now + 0.05);
        } catch {
          // Ignore audio buffer fallback
        }
        break;
      }

      case "check": {
        // Resonant chime (680Hz + 1020Hz fifth harmonic)
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        osc1.type = "sine";
        osc1.frequency.setValueAtTime(680, now);

        osc2.type = "sine";
        osc2.frequency.setValueAtTime(1020, now);

        gain.gain.setValueAtTime(0.5, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(this.masterGain);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 0.18);
        osc2.stop(now + 0.18);
        break;
      }

      case "premove": {
        // Double tick
        for (const delay of [0, 0.04]) {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = "sine";
          osc.frequency.setValueAtTime(1200, now + delay);

          gain.gain.setValueAtTime(0.3, now + delay);
          gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.015);

          osc.connect(gain);
          gain.connect(this.masterGain);

          osc.start(now + delay);
          osc.stop(now + delay + 0.015);
        }
        break;
      }

      case "illegal": {
        // A dull buzz against the wooden click of a move that worked: same
        // family of sound, deliberately the wrong end of it.
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        osc.type = "square";
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(90, now + 0.12);

        filter.type = "lowpass";
        filter.frequency.setValueAtTime(700, now);

        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        osc.start(now);
        osc.stop(now + 0.12);
        break;
      }

      case "tenseconds": {
        // Two dry ticks high above everything else in the set, so it reads as
        // the clock rather than as anything happening on the board.
        for (const delay of [0, 0.12]) {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = "square";
          osc.frequency.setValueAtTime(1760, now + delay);

          gain.gain.setValueAtTime(0.22, now + delay);
          gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.03);

          osc.connect(gain);
          gain.connect(this.masterGain);

          osc.start(now + delay);
          osc.stop(now + delay + 0.03);
        }
        break;
      }

      case "victory": {
        // Ascending triad C5 - E5 - G5
        const freqs = [523.25, 659.25, 783.99];
        freqs.forEach((freq, idx) => {
          const t = now + idx * 0.08;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = "triangle";
          osc.frequency.setValueAtTime(freq, t);

          gain.gain.setValueAtTime(0.4, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

          osc.connect(gain);
          gain.connect(this.masterGain!);

          osc.start(t);
          osc.stop(t + 0.25);
        });
        break;
      }

      case "defeat": {
        // Descending minor triad
        const freqs = [659.25, 587.33, 440.0];
        freqs.forEach((freq, idx) => {
          const t = now + idx * 0.1;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = "sawtooth";
          osc.frequency.setValueAtTime(freq, t);

          gain.gain.setValueAtTime(0.3, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);

          osc.connect(gain);
          gain.connect(this.masterGain!);

          osc.start(t);
          osc.stop(t + 0.3);
        });
        break;
      }

      case "draw": {
        // Neutral fifth interval
        const freqs = [440.0, 659.25];
        freqs.forEach((freq) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, now);

          gain.gain.setValueAtTime(0.3, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

          osc.connect(gain);
          gain.connect(this.masterGain!);

          osc.start(now);
          osc.stop(now + 0.3);
        });
        break;
      }
    }
  }
}

export const audioEngine = new AudioEngine();
