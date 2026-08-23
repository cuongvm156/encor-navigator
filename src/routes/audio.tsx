import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Pause, Play, RotateCcw, RotateCw, SkipBack, SkipForward, Video } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { ProgressBar } from "@/features/progress/ProgressBar";
import { chapters, course, getChapter, resources } from "@/features/course/data";
import { formatTime } from "@/features/course/derive";
import { toPercent } from "@/features/progress/weights";
import { useAudioPlayer } from "@/features/audio/useAudioPlayer";
import { playbackPersistence } from "@/features/audio/playbackPersistence";
import { hasAudio, resolveAudioSource } from "@/features/audio/sources";
import {
  useOfflineResources,
  useResolvedResource,
} from "@/features/offline/useOfflineResources";
import { useMediaSession } from "@/features/audio/useMediaSession";
import { formatRemaining, usePlaybackControls } from "@/features/audio/usePlaybackControls";
import type { RepeatMode, SleepTimerOption } from "@/features/audio/types";

import { Link } from "@tanstack/react-router";
import { resolveChapterTracks } from "@/features/media/tracks";
import { syncFromAudio } from "@/features/media/sharedState";
import { useMediaTrackState } from "@/features/media/useMediaTrackState";
import {
  audioProgressRatio,
  playbackKey,
  usePersistedPlayback,
} from "@/features/audio/usePersistedPlayback";


export const Route = createFileRoute("/audio")({
  validateSearch: (search: Record<string, unknown>) => ({
    chapter: typeof search["chapter"] === "string" ? (search["chapter"] as string) : undefined,
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
  const { chapter: chapterId } = Route.useSearch();
  const navigate = useNavigate();
  // Offline copies (downloaded or locally imported) take priority over the
  // online manifest URL and can make a chapter playable on their own.
  const offlineRows = useOfflineResources();
  const offlineAudioChapters = useMemo(
    () =>
      new Set(
        offlineRows
          .filter((row) => row.kind === "audio" && row.status === "ready")
          .map((row) => row.chapterId),
      ),
    [offlineRows],
  );
  const playable = useMemo(
    () =>
      chapters.filter(
        (chapter) => hasAudio(chapter, resources) || offlineAudioChapters.has(chapter.id),
      ),
    [offlineAudioChapters],
  );
  const fallback = playable[0] ?? chapters[0]!;
  const current = (chapterId ? getChapter(chapterId) : undefined) ?? fallback;

  const controls = usePlaybackControls();
  const repeat = REPEAT_LABEL[controls.repeatMode];
  const sleep = SLEEP_LABEL[controls.sleepOption];
  const sleepRemaining = formatRemaining(controls.sleepRemainingMs);

  const offlineAudio = useResolvedResource(current.id, "audio");
  const offlineSrc =
    offlineAudio.origin === "local-import" || offlineAudio.origin === "download"
      ? offlineAudio.url
      : undefined;

  const source = useMemo(() => {
    const base = resolveAudioSource(current, resources);
    if (offlineSrc && offlineAudio.resourceId) {
      return { ...base, src: offlineSrc, resourceId: offlineAudio.resourceId };
    }
    return base;
  }, [current, offlineSrc, offlineAudio.resourceId]);
  // Availability is chapter-specific: no chapter may borrow another's audio.
  const audioAvailable = Boolean(source.src);
  const player = useAudioPlayer(source);

  const playing = player.isPlaying;

  // Canonical selected chapter = the `chapter` search param, so title, source,
  // runtime state and persistence can never drift apart.
  const index = playable.findIndex((c) => c.id === current.id);
  const previousChapter = index > 0 ? playable[index - 1] : undefined;
  const nextChapter = index >= 0 && index < playable.length - 1 ? playable[index + 1] : undefined;

  // Chapter whose playback should auto-resume once its metadata is loaded.
  const resumeForRef = useRef<string | undefined>(undefined);
  const switchingRef = useRef(false);

  /** The single track-switching path used by Previous, Next and the chapter list. */
  const selectAudioChapter = useCallback(
    (id: string | undefined) => {
      if (!id || id === current.id || switchingRef.current) return;
      switchingRef.current = true;
      const wasPlaying = player.isPlaying;
      // Save the chapter we are leaving BEFORE loading the next one.
      void playbackPersistence.flushNow().finally(() => {
        player.pause();
        resumeForRef.current = wasPlaying ? id : undefined;
        void navigate({ to: "/audio", search: { chapter: id } });
        switchingRef.current = false;
      });
    },
    [current.id, navigate, player],
  );

  // Auto-resume after a switch that happened while playing (browser may reject).
  useEffect(() => {
    const target = resumeForRef.current;
    if (!target || target !== source.chapterId) return;
    if (!player.isLoaded || player.isPlaying) return;
    resumeForRef.current = undefined;
    player.play();
  }, [player, source.chapterId]);

  // Lock-screen / system media controls reuse the exact same actions as the UI.
  useMediaSession({
    chapterId: current.id,
    title: `${current.number}. ${current.title}`,
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
      onPreviousTrack: () => selectAudioChapter(previousChapter?.id),
      onNextTrack: () => selectAudioChapter(nextChapter?.id),
    },
  });




  // Shared MediaTrack state: the audio playhead of the active track is mirrored
  // into `mediaTrackStates` so the video rendition resumes at the same point.
  const chapterTracks = useMemo(
    () => resolveChapterTracks(offlineRows, current.id),
    [offlineRows, current.id],
  );
  const activeTrack = chapterTracks.find((entry) => Boolean(entry.audio.url)) ?? chapterTracks[0];
  const activeTrackId = activeTrack?.track.trackId;
  const videoUrl = activeTrack?.video.url;
  useMediaTrackState(current.id, activeTrackId, source.resourceId);

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

  // Real playback state only — no demo ChapterProgress values on this screen.
  const { states } = usePersistedPlayback();
  const saved = states[playbackKey(source.chapterId, source.resourceId)];

  const duration = player.duration > 0 ? player.duration : (saved?.duration ?? 0);
  const position = player.isLoaded ? player.currentTime : (saved?.currentTime ?? 0);
  // Live playback progress: always derived from the element's currentTime.
  // Persisted maxPosition is completion tracking only — never rendered here.
  const ratio = duration > 0 ? Math.min(1, Math.max(0, position / duration)) : 0;


  // Per-chapter list values come from persisted playback state only; chapters
  // with no saved state show 0:00 / 0%.
  const chapterRatios: Record<string, number> = {};
  const chapterDurations: Record<string, number> = {};
  for (const chapter of chapters) {
    if (!hasAudio(chapter, resources) && !offlineAudioChapters.has(chapter.id)) continue;
    const chapterSource = resolveAudioSource(chapter, resources);
    const offlineRow = offlineRows.find(
      (row) => row.chapterId === chapter.id && row.kind === "audio" && row.status === "ready",
    );
    const row =
      states[playbackKey(chapter.id, offlineRow?.resourceId ?? chapterSource.resourceId)];
    chapterDurations[chapter.id] = row?.duration ?? 0;
    chapterRatios[chapter.id] = toPercent(audioProgressRatio(row?.maxPosition ?? 0, row?.duration ?? 0));
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
        <p className="mt-1 text-base font-medium leading-snug">{current.title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {audioAvailable ? "Chapter audio narration" : "Audio unavailable"}
        </p>

        {audioAvailable ? (
          <>
            <div className="mt-5">
              <ProgressBar ratio={ratio} label="Audio progress" />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs tabular-nums text-muted-foreground">
              <span>{formatTime(position)}</span>
              <span>{toPercent(ratio)}%</span>
              <span>{formatTime(duration)}</span>
            </div>
          </>
        ) : null}

        {videoUrl && activeTrackId ? (
          <Link
            to="/video"
            search={{ chapter: current.id, track: activeTrackId }}
            className="mt-4 inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-xs font-medium transition-colors hover:bg-accent"
          >
            <Video className="size-3.5" strokeWidth={1.75} />
            Watch video instead
          </Link>
        ) : null}

        {player.error ? (
          <p className="mt-3 text-xs text-muted-foreground">{player.error}</p>
        ) : null}

        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => selectAudioChapter(previousChapter?.id)}
            disabled={!previousChapter}
            className={`${iconButton} disabled:pointer-events-none disabled:opacity-40`}
            aria-label="Previous chapter"
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
            onClick={() => selectAudioChapter(nextChapter?.id)}
            disabled={!nextChapter}
            className={`${iconButton} disabled:pointer-events-none disabled:opacity-40`}
            aria-label="Next chapter"
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

      <section className="mt-8">
        <h2 className="text-sm font-semibold tracking-tight">Chapter audio</h2>
        <ul className="mt-3 space-y-2">
          {chapters.map((chapter) => {
            const available =
              hasAudio(chapter, resources) || offlineAudioChapters.has(chapter.id);
            return (
              <li key={chapter.id}>
                <button
                  type="button"
                  onClick={() => selectAudioChapter(chapter.id)}
                  disabled={!available}
                  aria-current={chapter.id === current.id ? "true" : undefined}
                  className="flex w-full items-center justify-between gap-4 rounded-lg border border-border px-4 py-3 text-left transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm">
                      {chapter.number}. {chapter.title}
                    </p>
                    <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
                      {available ? formatTime(chapterDurations[chapter.id] ?? 0) : "Audio unavailable"}
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
    </div>
  );
}
