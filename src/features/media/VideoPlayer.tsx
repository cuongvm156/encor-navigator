/**
 * Sprint 6A.1 — native HTMLVideoElement player.
 *
 * No third-party player library and no Web Audio API. The element is created by
 * React and owned by this component only; the audio AudioController and its
 * single HTMLAudioElement are untouched. Only one of the two may play at a
 * time — starting the video pauses audio playback.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { audioController } from "@/features/audio/AudioController";
import { playbackPersistence } from "@/features/audio/playbackPersistence";
import { formatTime } from "@/features/course/derive";
import { resumeSeconds, syncFromVideo } from "./sharedState";

const SAVE_INTERVAL_MS = 5000;

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
}

export function VideoPlayer({
  chapterId,
  trackId,
  src,
  title,
  audioResourceId,
  resumeRatio,
  playbackRate = 1,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [error, setError] = useState<string | undefined>(undefined);
  const appliedResumeRef = useRef<string | undefined>(undefined);
  const resumeRatioRef = useRef(resumeRatio);
  resumeRatioRef.current = resumeRatio;

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
    const key = `${chapterId}:${trackId}:${src}`;
    if (appliedResumeRef.current !== key) {
      appliedResumeRef.current = key;
      const target = resumeSeconds(resumeRatioRef.current, length);
      // Never resume at the very end — that would immediately re-trigger "ended".
      if (target > 0 && target < length - 1) video.currentTime = target;
    }
    video.playbackRate = playbackRate;
  }, [chapterId, trackId, src, playbackRate]);

  useEffect(() => {
    setError(undefined);
    setCurrentTime(0);
    setDuration(0);
  }, [src]);

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

  const handlePlay = useCallback(() => {
    // One logical item, one active rendition: stop audio before video starts.
    if (audioController.getState().isPlaying) {
      audioController.pause();
      void playbackPersistence.flushNow();
    }
  }, []);

  return (
    <div>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video
        ref={videoRef}
        src={src}
        title={title}
        controls
        playsInline
        preload="metadata"
        className="w-full rounded-lg bg-muted"
        onLoadedMetadata={onLoadedMetadata}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onPlay={handlePlay}
        onPause={(event) => persist(event.currentTarget.currentTime, event.currentTarget.duration || 0)}
        onEnded={(event) => persist(event.currentTarget.duration || 0, event.currentTarget.duration || 0)}
        onError={() => setError("This video could not be played on this device.")}
      />
      <div className="mt-2 flex items-center justify-between text-xs tabular-nums text-muted-foreground">
        <span>{formatTime(currentTime)}</span>
        <span>{duration > 0 ? `${Math.round((currentTime / duration) * 100)}%` : "0%"}</span>
        <span>{formatTime(duration)}</span>
      </div>
      {error ? <p className="mt-2 text-xs text-muted-foreground">{error}</p> : null}
    </div>
  );
}
