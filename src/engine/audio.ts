import { Howl, Howler } from "howler";
import type { AssetManifest, AudioAsset } from "./schema";
import type { RuntimeSnapshot } from "./runtime";

export class AudioManager {
  private readonly cache = new Map<string, Howl>();
  private currentMusicId: string | null = null;
  private currentVoice: Howl | null = null;
  private masterVolume = 1;

  constructor(private readonly manifest: AssetManifest) {}

  applySnapshot(snapshot: RuntimeSnapshot): void {
    this.playMusic(snapshot.scene.music);
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
    howl.play();
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

  setMuted(muted: boolean): void {
    Howler.mute(muted);
  }

  setMasterVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    Howler.volume(this.masterVolume);
  }

  dispose(): void {
    this.stopVoice();
    this.stopMusic();
    for (const howl of this.cache.values()) {
      howl.unload();
    }
    this.cache.clear();
  }

  private stopMusic(): void {
    if (!this.currentMusicId) {
      return;
    }

    const howl = this.cache.get(this.currentMusicId);
    howl?.stop();
    this.currentMusicId = null;
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
