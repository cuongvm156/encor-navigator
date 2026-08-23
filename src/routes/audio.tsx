import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Pause, Play, RotateCcw, RotateCw, SkipBack, SkipForward, Video } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef } from "react";

import { PageHeader } from "@/components/layout/PageHeader";
import { ProgressBar } from "@/features/progress/ProgressBar";
import { chapters, course, getChapter, resources } from "@/features/course/data";
import { formatTime } from "@/features/course/derive";
import { toPercent } from "@/features/progress/weights";
import { useAudioPlayer } from "@/features/audio/useAudioPlayer";
import { playbackControls } from "@/features/audio/playbackControls";
import { hasAudio, resolveAudioSource } from "@/features/audio/sources";
import { useOfflineResources, useResolvedResource } from "@/features/offline/useOfflineResources";
import { useMediaSession } from "@/features/audio/useMediaSession";
import { formatRemaining, usePlaybackControls } from "@/features/audio/usePlaybackControls";
import type { RepeatMode, SleepTimerOption } from "@/features/audio/types";
import { getMediaTracks } from "@/data/resourceManifest";
import {
  useMediaPlaylist,
  useRenditionSource,
  useResolvedTrack,
} from "@/features/media/useResolvedTrack";
import { nextInChapter } from "@/features/media/tracks";
import { leaveAudioRendition } from "@/features/media/switchRendition";
import { syncFromAudio } from "@/features/media/sharedState";
import { useMediaTrackState } from "@/features/media/useMediaTrackState";
import {
  audioProgressRatio,
  playbackKey,
  usePersistedPlayback,
} from "@/features/audio/usePersistedPlayback";

interface AudioSearch {
  chapter?: string;
  /** Optional MediaTrack. Legacy `/audio?chapter=…` deep links stay valid. */
  track?: string;
}

export const Route = createFileRoute("/audio")({
  validateSearch: (search: Record<string, unknown>): AudioSearch => ({
    ...(typeof search["chapter"] === "string" ? { chapter: search["chapter"] } : {}),
    ...(typeof search["track"] === "string" ? { track: search["track"] } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Audio Player — ENCOR Study" },
      {
        name: "description",
        content: "Listen to CCNP ENCOR 350-401 chapter audio and pick up where you left off.",
      },
      { property: "og:title", content: "Audio Player — ENCOR Study" },
      {
        property: "og:description",
        content: "Listen to CCNP ENCOR chapter audio and pick up where you left off.",
      },
    ],
  }),
  component: AudioPage,
});

const SPEEDS = [0.75, 1, 1.25, 1.5, 1.75, 2] as const;
const REPEAT = ["Off", "Once", "Lesson"] as const;
const SLEEP = ["Off", "15 min", "30 min", "45 min", "60 min", "End of track"] as const;

const REPEAT_VALUE: Record<(typeof REPEAT)[number], RepeatMode> = {
  Off: "off",
  Once: "once",
  Lesson: "lesson",
};
const REPEAT_LABEL: Record<RepeatMode, (typeof REPEAT)[number]> = {
  off: "Off",
  once: "Once",
  lesson: "Lesson",
};
const SLEEP_VALUE: Record<(typeof SLEEP)[number], SleepTimerOption> = {
  Off: "off",
  "15 min": "15m",
  "30 min": "30m",
  "45 min": "45m",
  "60 min": "60m",
  "End of track": "end-of-track",
};
const SLEEP_LABEL: Record<SleepTimerOption, (typeof SLEEP)[number]> = {
  off: "Off",
  "15m": "15 min",
  "30m": "30 min",
  "45m": "45 min",
  "60m": "60 min",
  "end-of-track": "End of track",
};

const iconButton =
  "inline-flex size-11 items-center justify-center rounded-md border border-input bg-background transition-colors hover:bg-accent";

function OptionRow<T extends string | number>({
  label,
  options,
  value,
  onChange,
  format,
}: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (next: T) => void;
  format?: (option: T) => string;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((option) => {
          const active = option === value;
          return (
            <button
              key={String(option)}
              type="button"
              onClick={() => onChange(option)}
              aria-pressed={active}
              className={`min-h-9 rounded-md border px-3 text-xs transition-colors ${
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input bg-background text-muted-foreground hover:bg-accent"
              }`}
            >
              {format ? format(option) : String(option)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AudioPage() {
  const { chapter: chapterId, track: trackParam } = Route.useSearch();
  const navigate = useNavigate();
  const offlineRows = useOfflineResources();

  // Chapters whose audio exists only as a legacy chapter-wide offline copy.
  const offlineAudioChapters = useMemo(
    () =>
      new Set(
        offlineRows
          .filter((row) => row.kind === "audio" && row.status === "ready")
          .map((row) => row.chapterId),
      ),
    [offlineRows],
  );
  const playableChapters = useMemo(
    () =>
      chapters.filter(
        (chapter) => hasAudio(chapter, resources) || offlineAudioChapters.has(chapter.id),
      ),
    [offlineAudioChapters],
  );
  const fallback = playableChapters[0] ?? chapters[0]!;
  const current = (chapterId ? getChapter(chapterId) : undefined) ?? fallback;

  const controls = usePlaybackControls();
  const repeat = REPEAT_LABEL[controls.repeatMode];
  const sleep = SLEEP_LABEL[controls.sleepOption];
  const sleepRemaining = formatRemaining(controls.sleepRemainingMs);

  // --- source resolution -----------------------------------------------
  // Preferred path: the EXACT MediaTrack audio rendition. Chapters that declare
  // no track at all keep the legacy chapter-wide resolution.
  const { resolved, tracks, position, loading } = useResolvedTrack(current.id, trackParam);
  const trackAudio = useRenditionSource(resolved?.audio, loading);
  const legacyOffline = useResolvedResource(current.id, "audio");
  const legacySrc =
    legacyOffline.origin === "local-import" || legacyOffline.origin === "download"
      ? legacyOffline.url
      : undefined;

  const activeTrack = resolved?.track;
  const activeTrackId = activeTrack?.trackId;

  const source = useMemo(() => {
    if (activeTrack && trackAudio.url && trackAudio.resourceId) {
      return {
        chapterId: current.id,
        resourceId: trackAudio.resourceId,
        title: activeTrack.title,
        src: trackAudio.url,
      };
    }
    if (activeTrack) {
      return {
        chapterId: current.id,
        resourceId: activeTrack.audioResourceId ?? `${current.id}:no-audio`,
        title: activeTrack.title,
      };
    }
    const base = resolveAudioSource(current, resources);
    if (legacySrc && legacyOffline.resourceId) {
      return { ...base, src: legacySrc, resourceId: legacyOffline.resourceId };
    }
    return base;
  }, [activeTrack, trackAudio.url, trackAudio.resourceId, current, legacySrc, legacyOffline.resourceId]);

  const audioAvailable = Boolean(source.src);
  const player = useAudioPlayer(source);
  const playing = player.isPlaying;

  // --- playlist ----------------------------------------------------------
  // MediaTracks first (inside a chapter, then the next chapter). Chapters that
  // declare no track fall back to one legacy chapter-level entry.
  const trackPlaylist = useMediaPlaylist("audio");
  const playlist = useMemo(() => {
    const entries: Array<{ chapterId: string; trackId?: string }> = [];
    for (const chapter of chapters) {
      const declared = getMediaTracks(chapter.id);
      if (declared.length > 0) {
        for (const entry of trackPlaylist.filter((item) => item.chapterId === chapter.id)) {
          entries.push(entry);
        }
        continue;
      }
      if (hasAudio(chapter, resources) || offlineAudioChapters.has(chapter.id)) {
        entries.push({ chapterId: chapter.id });
      }
    }
    return entries;
  }, [trackPlaylist, offlineAudioChapters]);

  const index = playlist.findIndex(
    (entry) => entry.chapterId === current.id && entry.trackId === activeTrackId,
  );
  const previousEntry = index > 0 ? playlist[index - 1] : undefined;
  const nextEntry = index >= 0 && index < playlist.length - 1 ? playlist[index + 1] : undefined;

  const resumeForRef = useRef<string | undefined>(undefined);
  const switchingRef = useRef(false);

  /** The single track-switching path used by Previous, Next and the lists. */
  const selectEntry = useCallback(
    (entry: { chapterId: string; trackId?: string } | undefined) => {
      if (!entry || switchingRef.current) return;
      if (entry.chapterId === current.id && entry.trackId === activeTrackId) return;
      switchingRef.current = true;
      const wasPlaying = player.isPlaying;
      // Save what we are leaving BEFORE loading the next rendition.
      void leaveAudioRendition({
        chapterId: current.id,
        trackId: activeTrackId ?? "",
        currentTime: player.currentTime,
        duration: player.duration,
        playbackRate: player.playbackRate,
      }).finally(() => {
        resumeForRef.current = wasPlaying ? `${entry.chapterId}:${entry.trackId ?? ""}` : undefined;
        void navigate({
          to: "/audio",
          search: {
            chapter: entry.chapterId,
            ...(entry.trackId ? { track: entry.trackId } : {}),
          },
        });
        switchingRef.current = false;
      });
    },
    [current.id, activeTrackId, navigate, player],
  );

  // Continue playing across an in-app Previous/Next track change, and start
  // ONLY when this exact track consumes a one-shot rendition-switch intent that
  // the user just armed on the video screen. A direct or copied URL, a refresh
  // and Back/Forward carry no intent, so the player stays paused.
  const intentUsedRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!player.isLoaded || player.isPlaying) return;
    const key = `${current.id}:${activeTrackId ?? ""}`;
    if (resumeForRef.current === key) {
      resumeForRef.current = undefined;
      player.play();
      return;
    }
    if (intentUsedRef.current === key) return;
    intentUsedRef.current = key;
    // The browser may still refuse; that simply leaves the track paused.
    if (consumeRenditionSwitch(current.id, activeTrackId, "audio")) player.play();
  }, [player, current.id, activeTrackId]);

  // Repeat Lesson loops the MediaTracks of THIS chapter (single-track chapters
  // keep the legacy "restart the same track" behaviour).
  useEffect(() => {
    if (!activeTrackId) {
      playbackControls.setLessonAdvanceHandler(undefined);
      return;
    }
    const handler = () => {
      const target = nextInChapter(trackPlaylist, current.id, activeTrackId);
      if (!target || target.trackId === activeTrackId) return false;
      selectEntry(target);
      return true;
    };
    playbackControls.setLessonAdvanceHandler(handler);
    return () => playbackControls.setLessonAdvanceHandler(undefined);
  }, [activeTrackId, current.id, trackPlaylist, selectEntry]);

  // Lock-screen / system media controls reuse the exact same actions as the UI.
  useMediaSession({
    chapterId: current.id,
    title: activeTrack ? `${current.number}. ${activeTrack.title}` : `${current.number}. ${current.title}`,
    src: source.src ?? "",
    isPlaying: player.isPlaying,
    isLoaded: player.isLoaded,
    hasSource: Boolean(source.src),
    currentTime: player.currentTime,
    duration: player.duration,
    playbackRate: player.playbackRate,
    handlers: {
      onPlay: player.play,
      onPause: player.pause,
      onSeekBackward: (seconds) => player.seekBy(-seconds),
      onSeekForward: (seconds) => player.seekBy(seconds),
      onSeekTo: (seconds) => player.seekTo(seconds),
      onPreviousTrack: () => selectEntry(previousEntry),
      onNextTrack: () => selectEntry(nextEntry),
    },
  });

  // Shared MediaTrack state: the audio playhead of the active track is mirrored
  // into `mediaTrackStates` so the video rendition resumes at the same point.
  const { state: trackState } = useMediaTrackState(current.id, activeTrackId, source.resourceId);
  const videoUrl = resolved?.video.url;

  const lastSyncRef = useRef(0);
  useEffect(() => {
    if (!activeTrackId || !(player.duration > 0)) return;
    const stamp = Date.now();
    if (stamp - lastSyncRef.current < 4000 && player.isPlaying) return;
    lastSyncRef.current = stamp;
    void syncFromAudio({
      chapterId: current.id,
      trackId: activeTrackId,
      currentTime: player.currentTime,
      duration: player.duration,
      playbackRate: player.playbackRate,
    });
  }, [
    activeTrackId,
    current.id,
    player.currentTime,
    player.duration,
    player.isPlaying,
    player.playbackRate,
  ]);

  /** User switch to the paired video rendition: pause + flush first. */
  const switchToVideo = useCallback(async () => {
    if (!activeTrackId) return;
    const wasPlaying = await leaveAudioRendition({
      chapterId: current.id,
      trackId: activeTrackId,
      currentTime: player.currentTime,
      duration: player.duration,
      playbackRate: player.playbackRate,
    });
    if (wasPlaying) {
      requestRenditionSwitch({ chapterId: current.id, trackId: activeTrackId, mode: "video" });
    }
    void navigate({
      to: "/video",
      search: { chapter: current.id, track: activeTrackId },
    });
  }, [activeTrackId, current.id, navigate, player]);

  // Real playback state only — no demo ChapterProgress values on this screen.
  const { states } = usePersistedPlayback();
  const saved = states[playbackKey(source.chapterId, source.resourceId)];

  const duration = player.duration > 0 ? player.duration : (saved?.duration ?? 0);
  const positionSeconds = player.isLoaded ? player.currentTime : (saved?.currentTime ?? 0);
  // Live playback position: always derived from the element's currentTime.
  // Persisted maxRatio is the shared media PROGRESS and is shown separately.
  const ratio = duration > 0 ? Math.min(1, Math.max(0, positionSeconds / duration)) : 0;

  // Per-chapter list values come from persisted playback state only.
  const chapterRatios: Record<string, number> = {};
  const chapterDurations: Record<string, number> = {};
  for (const chapter of chapters) {
    if (!hasAudio(chapter, resources) && !offlineAudioChapters.has(chapter.id)) continue;
    const chapterSource = resolveAudioSource(chapter, resources);
    const offlineRow = offlineRows.find(
      (row) => row.chapterId === chapter.id && row.kind === "audio" && row.status === "ready",
    );
    const row = states[playbackKey(chapter.id, offlineRow?.resourceId ?? chapterSource.resourceId)];
    chapterDurations[chapter.id] = row?.duration ?? 0;
    chapterRatios[chapter.id] = toPercent(
      audioProgressRatio(row?.maxPosition ?? 0, row?.duration ?? 0),
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="Audio"
        title="Audio player"
        description="Chapter audio for hands-free review."
      />

      <section className="rounded-lg border border-border p-5">
        <p className="text-xs text-muted-foreground">
          {course.vendor} {course.code} · Chapter {current.number}
        </p>
        <p className="mt-1 text-base font-medium leading-snug">
          {activeTrack ? activeTrack.title : current.title}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {activeTrack
            ? `Track ${position} of ${tracks.length} · ${current.title} · Listening`
            : audioAvailable
              ? "Chapter audio narration"
              : "Audio unavailable"}
        </p>

        {audioAvailable ? (
          <>
            <div className="mt-5">
              <ProgressBar ratio={ratio} label="Current position" />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs tabular-nums text-muted-foreground">
              <span>{formatTime(positionSeconds)}</span>
              <span>{toPercent(ratio)}%</span>
              <span>{formatTime(duration)}</span>
            </div>
            {activeTrackId ? (
              <p className="mt-2 text-xs tabular-nums text-muted-foreground">
                Media progress (shared with video): {toPercent(trackState?.maxRatio ?? 0)}%
              </p>
            ) : null}
          </>
        ) : null}

        {videoUrl && activeTrackId ? (
          <button
            type="button"
            onClick={() => void switchToVideo()}
            className="mt-4 inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-xs font-medium transition-colors hover:bg-accent"
          >
            <Video className="size-3.5" strokeWidth={1.75} />
            Watch video instead
          </button>
        ) : null}

        {player.error ? <p className="mt-3 text-xs text-muted-foreground">{player.error}</p> : null}

        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => selectEntry(previousEntry)}
            disabled={!previousEntry}
            className={`${iconButton} disabled:pointer-events-none disabled:opacity-40`}
            aria-label="Previous track"
          >
            <SkipBack className="size-4" strokeWidth={1.75} />
          </button>

          <button
            type="button"
            onClick={player.skipBack}
            disabled={!audioAvailable}
            className={`${iconButton} disabled:pointer-events-none disabled:opacity-40`}
            aria-label="Back 15 seconds"
          >
            <RotateCcw className="size-4" strokeWidth={1.75} />
          </button>
          <button
            type="button"
            onClick={() => {
              // A manual (re)start clears the transient one-time repeat state.
              if (player.ended || !player.isPlaying) controls.resetRepeatConsumption();
              player.togglePlayPause();
            }}
            disabled={!audioAvailable}
            className="inline-flex size-16 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-40"
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? (
              <Pause className="size-6" strokeWidth={1.75} />
            ) : (
              <Play className="size-6" strokeWidth={1.75} />
            )}
          </button>
          <button
            type="button"
            onClick={player.skipForward}
            disabled={!audioAvailable}
            className={`${iconButton} disabled:pointer-events-none disabled:opacity-40`}
            aria-label="Forward 15 seconds"
          >
            <RotateCw className="size-4" strokeWidth={1.75} />
          </button>
          <button
            type="button"
            onClick={() => selectEntry(nextEntry)}
            disabled={!nextEntry}
            className={`${iconButton} disabled:pointer-events-none disabled:opacity-40`}
            aria-label="Next track"
          >
            <SkipForward className="size-4" strokeWidth={1.75} />
          </button>
        </div>

        <div className="mt-6 space-y-4 border-t border-border pt-5">
          <OptionRow
            label="Playback speed"
            options={SPEEDS}
            value={player.playbackRate as (typeof SPEEDS)[number]}
            onChange={player.setPlaybackRate}
            format={(s) => `${s}×`}
          />
          <OptionRow
            label="Repeat"
            options={REPEAT}
            value={repeat}
            onChange={(label) => controls.setRepeatMode(REPEAT_VALUE[label])}
          />
          <OptionRow
            label={sleepRemaining ? `Sleep timer · ${sleepRemaining} left` : "Sleep timer"}
            options={SLEEP}
            value={sleep}
            onChange={(label) => controls.setSleepOption(SLEEP_VALUE[label])}
          />
        </div>
      </section>

      {tracks.length > 1 ? (
        <section className="mt-8">
          <h2 className="text-sm font-semibold tracking-tight">Tracks in this chapter</h2>
          <ul className="mt-3 space-y-2">
            {tracks.map((entry, order) => (
              <li key={entry.track.trackId}>
                <button
                  type="button"
                  onClick={() =>
                    selectEntry({ chapterId: current.id, trackId: entry.track.trackId })
                  }
                  disabled={!entry.audio.url}
                  aria-current={entry.track.trackId === activeTrackId ? "true" : undefined}
                  className="flex w-full items-center justify-between gap-4 rounded-lg border border-border px-4 py-3 text-left text-sm transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
                >
                  <span className="truncate">
                    {order + 1}. {entry.track.title}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {entry.audio.url ? "Audio ready" : "Audio unavailable"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-8">
        <h2 className="text-sm font-semibold tracking-tight">Chapter audio</h2>
        <ul className="mt-3 space-y-2">
          {chapters.map((chapter) => {
            const available = hasAudio(chapter, resources) || offlineAudioChapters.has(chapter.id);
            const first = playlist.find((entry) => entry.chapterId === chapter.id);
            return (
              <li key={chapter.id}>
                <button
                  type="button"
                  onClick={() => selectEntry(first ?? { chapterId: chapter.id })}
                  disabled={!available}
                  aria-current={chapter.id === current.id ? "true" : undefined}
                  className="flex w-full items-center justify-between gap-4 rounded-lg border border-border px-4 py-3 text-left transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm">
                      {chapter.number}. {chapter.title}
                    </p>
                    <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
                      {available
                        ? formatTime(chapterDurations[chapter.id] ?? 0)
                        : "Audio unavailable"}
                    </p>
                  </div>
                  {available ? (
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {chapterRatios[chapter.id] ?? 0}%
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-6">
        <Link
          to="/offline"
          className="text-xs text-muted-foreground underline hover:text-foreground"
        >
          Manage offline media
        </Link>
      </section>
    </div>
  );
}
