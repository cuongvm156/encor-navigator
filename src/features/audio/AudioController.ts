/**
 * AudioController — Sprint 2B.
 *
 * Owns the single primary `HTMLAudioElement` for the whole application.
 * Web Audio API and third-party player libraries are NOT approved.
 *
 * Responsibilities:
 * - own one HTMLAudioElement instance for the whole app
 * - expose load/play/pause/seek/rate
 * - publish transient runtime state to subscribers
 *
 * It must never talk to IndexedDB directly — persistence lands in a later
 * sprint through `src/repositories/playbackRepository.ts`.
 */

import type { AudioControllerApi, AudioPlayerState, AudioSource, PlaybackRate } from "./types";

export const AUDIO_SKIP_SECONDS = 15;

const INITIAL_STATE: AudioPlayerState = {
  source: undefined,
  isLoaded: false,
  isLoading: false,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  playbackRate: 1,
  ended: false,
  error: undefined,
};

type Listener = (state: AudioPlayerState) => void;

const isBrowser = () => typeof window !== "undefined" && typeof window.Audio !== "undefined";

class AudioController implements AudioControllerApi {
  private el: HTMLAudioElement | undefined;
  private listeners = new Set<Listener>();
  private state: AudioPlayerState = INITIAL_STATE;
  /** Listeners for the native element `play` event (used by Media Session). */
  private playListeners = new Set<() => void>();
  /** Listeners for the native element `ended` event (repeat / sleep timer). */
  private endedListeners = new Set<() => void>();

  /** Subscribe to the native HTMLAudioElement "play" event. */
  onNativePlay(listener: () => void): () => void {
    this.playListeners.add(listener);
    return () => {
      this.playListeners.delete(listener);
    };
  }

  /** Subscribe to the native HTMLAudioElement "ended" event. */
  onNativeEnded(listener: () => void): () => void {
    this.endedListeners.add(listener);
    return () => {
      this.endedListeners.delete(listener);
    };
  }


  /**
   * Sets the native element `title` attribute (iOS Safari can fall back to it
   * for Now Playing when MediaMetadata is missing). Never creates a second
   * element — it only touches the one primary HTMLAudioElement.
   */
  setElementTitle(title: string): void {
    if (!title) return;
    const el = this.ensureElement();
    if (el) el.title = title;
  }

  /** Current native element title (diagnostics only). */
  getElementTitle(): string {
    return this.el?.title ?? "";
  }

  getState(): AudioPlayerState {
    return this.state;
  }


  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private setState(patch: Partial<AudioPlayerState>) {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener(this.state);
  }

  /** Lazily create the one and only audio element. Browser-only. */
  private ensureElement(): HTMLAudioElement | undefined {
    if (!isBrowser()) return undefined;
    if (!this.el) {
      const el = new Audio();
      el.preload = "metadata";
      el.addEventListener("loadedmetadata", this.onLoadedMetadata);
      el.addEventListener("timeupdate", this.onTimeUpdate);
      el.addEventListener("durationchange", this.onLoadedMetadata);
      el.addEventListener("play", this.onPlay);
      el.addEventListener("pause", this.onPause);
      el.addEventListener("ended", this.onEnded);
      el.addEventListener("error", this.onError);
      el.addEventListener("waiting", this.onWaiting);
      el.addEventListener("canplay", this.onCanPlay);
      this.el = el;
    }
    return this.el;
  }

  private onLoadedMetadata = () => {
    const el = this.el;
    if (!el) return;
    this.setState({
      isLoaded: true,
      isLoading: false,
      duration: Number.isFinite(el.duration) ? el.duration : 0,
      error: undefined,
    });
  };

  private onTimeUpdate = () => {
    if (!this.el) return;
    this.setState({ currentTime: this.el.currentTime });
  };

  private onPlay = () => {
    this.setState({ isPlaying: true, ended: false });
    for (const listener of this.playListeners) listener();
  };
  private onPause = () => this.setState({ isPlaying: false });
  private onEnded = () => this.setState({ isPlaying: false, ended: true });
  private onWaiting = () => this.setState({ isLoading: true });
  private onCanPlay = () => this.setState({ isLoading: false });

  private onError = () => {
    this.setState({
      isPlaying: false,
      isLoaded: false,
      isLoading: false,
      error: "This audio track could not be loaded.",
    });
  };

  load(source: AudioSource | undefined): void {
    const el = this.ensureElement();

    if (!source?.src) {
      if (el) {
        el.pause();
        el.removeAttribute("src");
        el.load();
      }
      this.setState({
        ...INITIAL_STATE,
        playbackRate: this.state.playbackRate,
        source,
        error: source ? "No audio file is available for this chapter yet." : undefined,
      });
      return;
    }

    if (this.state.source?.src === source.src) {
      const sameTrack =
        this.state.source?.chapterId === source.chapterId &&
        this.state.source?.resourceId === source.resourceId;
      if (sameTrack) {
        this.setState({ source });
        return;
      }
      // Same media URL (shared demo asset) but a different logical track:
      // reuse the element, reset the playhead to the new track's start.
      if (el) {
        el.pause();
        el.currentTime = 0;
      }
      this.setState({ source, currentTime: 0, isPlaying: false, ended: false });
      return;
    }

    this.setState({
      source,
      isLoaded: false,
      isLoading: true,
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      ended: false,
      error: undefined,
    });

    if (!el) return;
    el.pause();
    el.src = source.src;
    el.playbackRate = this.state.playbackRate;
    el.load();
  }

  async play(): Promise<void> {
    const el = this.el;
    if (!el || !this.state.source?.src) {
      this.setState({ error: "No audio file is available for this chapter yet." });
      return;
    }
    try {
      await el.play();
    } catch {
      this.setState({ isPlaying: false, error: "Playback could not start." });
    }
  }

  pause(): void {
    this.el?.pause();
  }

  togglePlayPause(): void {
    if (this.state.isPlaying) this.pause();
    else void this.play();
  }

  seekTo(seconds: number): void {
    const el = this.el;
    if (!el) return;
    const max = Number.isFinite(el.duration) && el.duration > 0 ? el.duration : this.state.duration;
    const next = Math.min(Math.max(seconds, 0), max || 0);
    el.currentTime = next;
    this.setState({ currentTime: next, ended: false });
  }

  seekBy(deltaSeconds: number): void {
    this.seekTo(this.getCurrentTime() + deltaSeconds);
  }

  setPlaybackRate(rate: PlaybackRate): void {
    if (this.el) this.el.playbackRate = rate;
    this.setState({ playbackRate: rate });
  }

  getCurrentTime(): number {
    return this.el?.currentTime ?? this.state.currentTime;
  }

  getDuration(): number {
    const d = this.el?.duration;
    return Number.isFinite(d) ? (d as number) : this.state.duration;
  }

  destroy(): void {
    const el = this.el;
    if (el) {
      el.pause();
      el.removeEventListener("loadedmetadata", this.onLoadedMetadata);
      el.removeEventListener("timeupdate", this.onTimeUpdate);
      el.removeEventListener("durationchange", this.onLoadedMetadata);
      el.removeEventListener("play", this.onPlay);
      el.removeEventListener("pause", this.onPause);
      el.removeEventListener("ended", this.onEnded);
      el.removeEventListener("error", this.onError);
      el.removeEventListener("waiting", this.onWaiting);
      el.removeEventListener("canplay", this.onCanPlay);
      el.removeAttribute("src");
      this.el = undefined;
    }
    this.state = INITIAL_STATE;
  }
}

/** The single shared controller instance for the application. */
export const audioController = new AudioController();
export type { AudioControllerApi };
