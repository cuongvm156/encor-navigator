/**
 * Sprint 6A.1 — native HTMLVideoElement player with explicit controls.
 *
 * No third-party player library and no Web Audio API. The element is created by
 * React and owned by this component only; the audio AudioController and its
 * single HTMLAudioElement are untouched. Only one of the two may play at a
 * time — starting the video pauses audio playback. Nothing here autoplays.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type React from "react";
import {
  Maximize,
  Pause,
  PictureInPicture2,
  Play,
  RotateCcw,
  RotateCw,
  SkipBack,
  SkipForward,
} from "lucide-react";

import { audioController } from "@/features/audio/AudioController";
import { playbackPersistence } from "@/features/audio/playbackPersistence";
import { formatTime } from "@/features/course/derive";
import { resumeSeconds, syncFromVideo } from "./sharedState";

const SAVE_INTERVAL_MS = 5000;
const SKIP_SECONDS = 15;
export const VIDEO_SPEEDS = [0.75, 1, 1.25, 1.5, 1.75, 2] as const;

export interface VideoPlayerApi {
  pause: () => void;
  /** Pauses and persists the shared position; resolves to "was playing". */
  pauseAndFlush: () => Promise<boolean>;
}

export interface VideoPlayerProps {
  chapterId: string;
  trackId: string;
  src: string;
  title: string;
  /** Audio rendition identity, so the audio resume point follows the video. */
  audioResourceId?: string;
  /** Shared resume position (0..1) from `mediaTrackStates`. */
  resumeRatio?: number;
  playbackRate?: number;
  onPlaybackRateChange?: (rate: number) => void;
  onPrevious?: (() => void) | undefined;
  onNext?: (() => void) | undefined;
  /** True when playback should start as the direct result of a user switch. */
  startPlaying?: boolean;
  onStarted?: () => void;
  apiRef?: React.MutableRefObject<VideoPlayerApi | null>;
}

const iconButton =
  "inline-flex size-11 items-center justify-center rounded-md border border-input bg-background transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-40";

export function VideoPlayer({
  chapterId,
  trackId,
  src,
  title,
  audioResourceId,
  resumeRatio,
  playbackRate = 1,
  onPlaybackRateChange,
  onPrevious,
  onNext,
  startPlaying = false,
  onStarted,
  apiRef,
}: VideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [waiting, setWaiting] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);
  const [pipSupported, setPipSupported] = useState(false);
  const appliedResumeRef = useRef<string | undefined>(undefined);
  const resumeRatioRef = useRef(resumeRatio);
  resumeRatioRef.current = resumeRatio;
  const startPlayingRef = useRef(startPlaying);
  startPlayingRef.current = startPlaying;

  // PiP is only offered when the browser really supports it (iPhone Safari
  // exposes it on video elements; many embedded webviews do not).
  useEffect(() => {
    const video = videoRef.current;
    setPipSupported(
      typeof document !== "undefined" &&
        document.pictureInPictureEnabled === true &&
        typeof (video as unknown as { requestPictureInPicture?: unknown })
          ?.requestPictureInPicture === "function",
    );
  }, [src]);

  const persist = useCallback(
    (time: number, length: number) => {
      if (!(length > 0)) return;
      void syncFromVideo({
        chapterId,
        trackId,
        currentTime: time,
        duration: length,
        playbackRate,
        ...(audioResourceId ? { audioResourceId } : {}),
      });
    },
    [chapterId, trackId, audioResourceId, playbackRate],
  );

  // Apply the shared resume point once per track/source, using the real
  // duration of THIS rendition: targetTime = resumeRatio * videoDuration.
  const onLoadedMetadata = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const length = Number.isFinite(video.duration) ? video.duration : 0;
    setDuration(length);
    setWaiting(false);
    const key = `${chapterId}:${trackId}:${src}`;
    if (appliedResumeRef.current !== key) {
      appliedResumeRef.current = key;
      const target = resumeSeconds(resumeRatioRef.current, length);
      // Never resume at the very end — that would immediately re-trigger "ended".
      if (target > 0 && target < length - 1) video.currentTime = target;
      // Playback only ever begins because the user asked to switch rendition.
      if (startPlayingRef.current && !startedRef.current) {
        startedRef.current = true;
        void video.play().catch(() => undefined);
        onStarted?.();
      }
    }
    video.playbackRate = playbackRate;
  }, [chapterId, trackId, src, playbackRate, onStarted]);

  useEffect(() => {
    setError(undefined);
    setCurrentTime(0);
    setDuration(0);
    setWaiting(true);
  }, [src]);

  useEffect(() => {
    const video = videoRef.current;
    if (video) video.playbackRate = playbackRate;
  }, [playbackRate]);

  // The one-shot switch intent can be consumed just after metadata arrived.
  // Playback still only ever begins because of that user switch action.
  const startedRef = useRef(false);
  useEffect(() => {
    const video = videoRef.current;
    if (!startPlaying || startedRef.current || !video) return;
    if (!(video.readyState >= 1) || !video.paused) return;
    startedRef.current = true;
    void video.play().catch(() => undefined);
    onStarted?.();
  }, [startPlaying, duration, onStarted]);

  // Periodic + unmount persistence of the shared position.
  useEffect(() => {
    const timer = setInterval(() => {
      const video = videoRef.current;
      if (!video || video.paused) return;
      persist(video.currentTime, video.duration || 0);
    }, SAVE_INTERVAL_MS);
    return () => {
      clearInterval(timer);
      const video = videoRef.current;
      if (video) persist(video.currentTime, video.duration || 0);
    };
  }, [persist]);

  // Imperative handle used by the rendition switch: pause + flush BEFORE the
  // paired audio rendition is loaded, so both can never play at once.
  useEffect(() => {
    if (!apiRef) return;
    apiRef.current = {
      pause: () => videoRef.current?.pause(),
      pauseAndFlush: async () => {
        const video = videoRef.current;
        if (!video) return false;
        const wasPlaying = !video.paused;
        video.pause();
        persist(video.currentTime, video.duration || 0);
        return wasPlaying;
      },
    };
    return () => {
      apiRef.current = null;
    };
  }, [apiRef, persist]);

  const handlePlay = useCallback(() => {
    setIsPlaying(true);
    // One logical item, one active rendition: stop audio before video starts.
    if (audioController.getState().isPlaying) {
      audioController.pause();
      void playbackPersistence.flushNow();
    }
  }, []);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) void video.play().catch(() => undefined);
    else video.pause();
  }, []);

  const seekBy = useCallback((delta: number) => {
    const video = videoRef.current;
    if (!video || !(video.duration > 0)) return;
    video.currentTime = Math.min(video.duration, Math.max(0, video.currentTime + delta));
  }, []);

  const toggleFullscreen = useCallback(() => {
    const video = videoRef.current;
    const container = containerRef.current;
    // iPhone Safari only supports fullscreen on the video element itself.
    const iosVideo = video as unknown as { webkitEnterFullscreen?: () => void };
    if (typeof iosVideo?.webkitEnterFullscreen === "function" && !document.fullscreenEnabled) {
      iosVideo.webkitEnterFullscreen();
      return;
    }
    if (document.fullscreenElement) void document.exitFullscreen();
    else void container?.requestFullscreen?.().catch(() => undefined);
  }, []);

  const togglePip = useCallback(() => {
    const video = videoRef.current as unknown as {
      requestPictureInPicture?: () => Promise<unknown>;
    } | null;
    if (!video?.requestPictureInPicture) return;
    if (document.pictureInPictureElement) void document.exitPictureInPicture();
    else void video.requestPictureInPicture().catch(() => undefined);
  }, []);

  const ratio = duration > 0 ? currentTime / duration : 0;

  return (
    <div ref={containerRef} className="rounded-lg bg-background">
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video
        ref={videoRef}
        src={src}
        title={title}
        playsInline
        preload="metadata"
        className="w-full rounded-lg bg-muted"
        onLoadedMetadata={onLoadedMetadata}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onPlay={handlePlay}
        onPlaying={() => setWaiting(false)}
        onWaiting={() => setWaiting(true)}
        onPause={(event) => {
          setIsPlaying(false);
          persist(event.currentTarget.currentTime, event.currentTarget.duration || 0);
        }}
        onEnded={(event) => {
          setIsPlaying(false);
          persist(event.currentTarget.duration || 0, event.currentTarget.duration || 0);
        }}
        onError={() => {
          setWaiting(false);
          setError("This video could not be played on this device.");
        }}
      />

      {/* Scrubber + time display */}
      <div className="mt-3">
        <input
          type="range"
          min={0}
          max={duration > 0 ? duration : 0}
          step={1}
          value={Math.min(currentTime, duration || 0)}
          disabled={!(duration > 0)}
          aria-label="Seek video"
          className="h-2 w-full cursor-pointer accent-primary disabled:opacity-40"
          onChange={(event) => {
            const video = videoRef.current;
            const next = Number(event.target.value);
            setCurrentTime(next);
            if (video) video.currentTime = next;
          }}
        />
        <div className="mt-1 flex items-center justify-between text-xs tabular-nums text-muted-foreground">
          <span>{formatTime(currentTime)}</span>
          <span>{duration > 0 ? `${Math.round(ratio * 100)}%` : "0%"}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Transport controls */}
      <div className="mt-4 flex items-center justify-center gap-3">
        <button
          type="button"
          className={iconButton}
          onClick={onPrevious}
          disabled={!onPrevious}
          aria-label="Previous track"
        >
          <SkipBack className="size-4" strokeWidth={1.75} />
        </button>
        <button
          type="button"
          className={iconButton}
          onClick={() => seekBy(-SKIP_SECONDS)}
          aria-label="Back 15 seconds"
        >
          <RotateCcw className="size-4" strokeWidth={1.75} />
        </button>
        <button
          type="button"
          onClick={togglePlay}
          className="inline-flex size-16 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary/90"
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? (
            <Pause className="size-6" strokeWidth={1.75} />
          ) : (
            <Play className="size-6" strokeWidth={1.75} />
          )}
        </button>
        <button
          type="button"
          className={iconButton}
          onClick={() => seekBy(SKIP_SECONDS)}
          aria-label="Forward 15 seconds"
        >
          <RotateCw className="size-4" strokeWidth={1.75} />
        </button>
        <button
          type="button"
          className={iconButton}
          onClick={onNext}
          disabled={!onNext}
          aria-label="Next track"
        >
          <SkipForward className="size-4" strokeWidth={1.75} />
        </button>
      </div>

      {/* Speed + screen controls */}
      <div className="mt-4 space-y-3 border-t border-border pt-4">
        <div>
          <p className="text-xs text-muted-foreground">Playback speed</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {VIDEO_SPEEDS.map((speed) => {
              const active = speed === playbackRate;
              return (
                <button
                  key={speed}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    const video = videoRef.current;
                    if (video) video.playbackRate = speed;
                    onPlaybackRateChange?.(speed);
                  }}
                  className={`min-h-9 rounded-md border px-3 text-xs transition-colors ${
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-background text-muted-foreground hover:bg-accent"
                  }`}
                >
                  {speed}×
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={`${iconButton} w-auto px-3 text-xs`}
            onClick={toggleFullscreen}
            aria-label="Fullscreen"
          >
            <Maximize className="size-4" strokeWidth={1.75} />
            Fullscreen
          </button>
          {pipSupported ? (
            <button
              type="button"
              className={`${iconButton} w-auto px-3 text-xs`}
              onClick={togglePip}
              aria-label="Picture in picture"
            >
              <PictureInPicture2 className="size-4" strokeWidth={1.75} />
              Picture in picture
            </button>
          ) : (
            <p className="self-center text-xs text-muted-foreground">
              Picture in picture is not supported by this browser.
            </p>
          )}
        </div>
      </div>

      {waiting && !error ? (
        <p className="mt-3 text-xs text-muted-foreground">Loading video…</p>
      ) : null}
      {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
