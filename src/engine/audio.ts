import { Howl, Howler } from "howler";
import type { AssetManifest, AudioAsset } from "./schema";
import type { RuntimeSnapshot } from "./runtime";

export class AudioManager {
  private readonly cache = new Map<string, Howl>();
  private currentMusicId: string | null = null;
  private currentAmbienceId: string | null = null;
  private currentVoice: Howl | null = null;
  private readonly fadeTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private masterVolume = 1;
  private muted = false;
  private nextTextTickAt = 0;
  private textTickSequence = 0;

  constructor(private readonly manifest: AssetManifest) {}

  applySnapshot(snapshot: RuntimeSnapshot): void {
    this.playMusic(snapshot.scene.music);
    this.playAmbience(snapshot.scene.ambience);
    for (const event of snapshot.events) {
      if (event.type === "sfx") {
        this.playSfx(event.audio);
      }
    }
  }

  playMusic(id: string | null | undefined): void {
    if (id === undefined) {
      return;
    }

    if (id === null) {
      this.stopMusic();
      return;
    }

    if (id === this.currentMusicId) {
      return;
    }

    this.stopMusic();
    const howl = this.getHowl(id);
    if (!howl) {
      return;
    }
    this.currentMusicId = id;
    this.startWithFade(id, howl, 1100);
  }

  playAmbience(id: string | null | undefined): void {
    if (id === undefined) {
      return;
    }

    if (id === null) {
      this.stopAmbience();
      return;
    }

    if (id === this.currentAmbienceId) {
      return;
    }

    this.stopAmbience();
    const howl = this.getHowl(id);
    if (!howl) {
      return;
    }
    this.currentAmbienceId = id;
    this.startWithFade(id, howl, 900);
  }

  playVoice(id: string | undefined): void {
    this.stopVoice();
    if (!id) {
      return;
    }

    const howl = this.getHowl(id);
    if (!howl) {
      return;
    }
    this.currentVoice = howl;
    howl.play();
  }

  stopVoice(): void {
    if (this.currentVoice) {
      this.currentVoice.stop();
      this.currentVoice = null;
    }
  }

  playSfx(id: string): void {
    const howl = this.getHowl(id);
    howl?.play();
  }

  unlock(): void {
    if (Howler.ctx.state !== "running") {
      void Howler.ctx.resume().catch(() => undefined);
    }
  }

  playTextTick(speakerId: string | undefined, glyph: string): void {
    if (this.muted || !isSpeakingGlyph(glyph)) {
      return;
    }

    const context = Howler.ctx;
    if (context.state !== "running") {
      void context.resume().catch(() => undefined);
      return;
    }

    const now = context.currentTime;
    if (now < this.nextTextTickAt) {
      return;
    }

    const profile = getTextVoiceProfile(speakerId);
    const oscillator = context.createOscillator();
    const filter = context.createBiquadFilter();
    const envelope = context.createGain();
    const inflection = [-1, 0, 2, 0][this.textTickSequence % 4];
    const frequency = profile.frequency * 2 ** (inflection / 12);

    this.textTickSequence += 1;
    this.nextTextTickAt = now + profile.intervalMs / 1000;

    oscillator.type = profile.waveform;
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(frequency * 0.94, now + profile.durationMs / 1000);
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(profile.filterFrequency, now);
    filter.Q.setValueAtTime(1.8, now);
    envelope.gain.setValueAtTime(0.0001, now);
    envelope.gain.exponentialRampToValueAtTime(profile.volume, now + 0.004);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + profile.durationMs / 1000);

    oscillator.connect(filter);
    filter.connect(envelope);
    envelope.connect(Howler.masterGain);
    oscillator.onended = () => {
      oscillator.disconnect();
      filter.disconnect();
      envelope.disconnect();
    };
    oscillator.start(now);
    oscillator.stop(now + profile.durationMs / 1000 + 0.006);
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    Howler.mute(muted);
  }

  setMasterVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    Howler.volume(this.masterVolume);
  }

  dispose(): void {
    for (const timer of this.fadeTimers.values()) {
      clearTimeout(timer);
    }
    this.fadeTimers.clear();
    this.stopVoice();
    this.stopMusic(true);
    this.stopAmbience(true);
    for (const howl of this.cache.values()) {
      howl.unload();
    }
    this.cache.clear();
  }

  private stopMusic(immediate = false): void {
    if (!this.currentMusicId) {
      return;
    }

    const id = this.currentMusicId;
    const howl = this.cache.get(id);
    this.currentMusicId = null;
    if (!howl) {
      return;
    }
    if (immediate) {
      howl.stop();
      return;
    }
    this.fadeOutAndStop(id, howl, 700);
  }

  private stopAmbience(immediate = false): void {
    if (!this.currentAmbienceId) {
      return;
    }

    const id = this.currentAmbienceId;
    const howl = this.cache.get(id);
    this.currentAmbienceId = null;
    if (!howl) {
      return;
    }
    if (immediate) {
      howl.stop();
      return;
    }
    this.fadeOutAndStop(id, howl, 700);
  }

  private startWithFade(id: string, howl: Howl, durationMs: number): void {
    this.cancelFadeTimer(id);
    howl.stop();
    const targetVolume = this.manifest.audio[id]?.volume ?? 1;
    howl.volume(0);
    howl.play();
    howl.fade(0, targetVolume, durationMs);
  }

  private fadeOutAndStop(id: string, howl: Howl, durationMs: number): void {
    this.cancelFadeTimer(id);
    const currentVolume = Number(howl.volume());
    howl.fade(Number.isFinite(currentVolume) ? currentVolume : 1, 0, durationMs);
    const timer = setTimeout(() => {
      howl.stop();
      howl.volume(this.manifest.audio[id]?.volume ?? 1);
      this.fadeTimers.delete(id);
    }, durationMs + 40);
    this.fadeTimers.set(id, timer);
  }

  private cancelFadeTimer(id: string): void {
    const timer = this.fadeTimers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.fadeTimers.delete(id);
    }
  }

  private getHowl(id: string): Howl | null {
    const cached = this.cache.get(id);
    if (cached) {
      return cached;
    }

    const asset = this.manifest.audio[id];
    if (!asset) {
      console.warn(`[audio] Missing audio asset '${id}'.`);
      return null;
    }

    const howl = makeHowl(asset);
    this.cache.set(id, howl);
    return howl;
  }
}

function makeHowl(asset: AudioAsset): Howl {
  return new Howl({
    src: [asset.src],
    loop: asset.loop ?? false,
    volume: asset.volume ?? 1,
    html5: asset.kind === "music" || asset.kind === "ambience"
  });
}

export type TextVoiceProfile = {
  frequency: number;
  waveform: OscillatorType;
  filterFrequency: number;
  volume: number;
  intervalMs: number;
  durationMs: number;
};

const TEXT_VOICE_NOTES = [146.83, 164.81, 185, 207.65, 220, 246.94, 277.18, 311.13];

export function getTextVoiceProfile(speakerId: string | undefined): TextVoiceProfile {
  const hash = stableHash(speakerId ?? "narrator");
  const baseNote = TEXT_VOICE_NOTES[hash % TEXT_VOICE_NOTES.length];
  const octave = (hash >>> 5) % 4 === 0 ? 0.5 : 1;
  const waveform: OscillatorType = (hash >>> 8) % 3 === 0 ? "square" : "triangle";

  return {
    frequency: baseNote * octave,
    waveform,
    filterFrequency: 760 + ((hash >>> 11) % 7) * 115,
    volume: 0.046 + ((hash >>> 15) % 4) * 0.004,
    intervalMs: 44 + ((hash >>> 18) % 3) * 5,
    durationMs: 43 + ((hash >>> 21) % 4) * 4
  };
}

function stableHash(value: string): number {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function isSpeakingGlyph(glyph: string): boolean {
  return /[\p{L}\p{N}]/u.test(glyph);
}
