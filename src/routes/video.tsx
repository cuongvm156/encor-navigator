import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Headphones } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { PageHeader } from "@/components/layout/PageHeader";
import { ProgressBar } from "@/features/progress/ProgressBar";
import { getChapter } from "@/features/course/data";
import { getMediaTracks } from "@/data/resourceManifest";
import { VideoPlayer, type VideoPlayerApi } from "@/features/media/VideoPlayer";
import { useMediaTrackState } from "@/features/media/useMediaTrackState";
import {
  useMediaPlaylist,
  useRenditionSource,
  useResolvedTrack,
} from "@/features/media/useResolvedTrack";
import { neighbours } from "@/features/media/tracks";
import {
  consumeRenditionSwitch,
  requestRenditionSwitch,
} from "@/features/media/switchRendition";
import { toPercent } from "@/features/progress/weights";

interface VideoSearch {
  chapter?: string;
  track?: string;
}

export const Route = createFileRoute("/video")({
  validateSearch: (search: Record<string, unknown>): VideoSearch => ({
    ...(typeof search["chapter"] === "string" ? { chapter: search["chapter"] } : {}),
    ...(typeof search["track"] === "string" ? { track: search["track"] } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Video Player — ENCOR Study" },
      {
        name: "description",
        content:
          "Watch the video rendition of a CCNP ENCOR 350-401 media track and resume where the audio left off.",
      },
      { property: "og:title", content: "Video Player — ENCOR Study" },
      {
        property: "og:description",
        content: "Watch the video rendition of an ENCOR media track with shared resume state.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: VideoPage,
});

function VideoPage() {
  const { chapter: chapterId, track: trackId } = Route.useSearch();
  const navigate = useNavigate();
  const chapter = chapterId ? getChapter(chapterId) : undefined;

  // Track-scoped resolution: the EXACT requested MediaTrack, never chapter-wide.
  const { resolved, tracks, position, loading } = useResolvedTrack(chapter?.id, trackId);
  const video = useRenditionSource(resolved?.video, loading);
  const audioPlayable = Boolean(resolved?.audio.url);

  const { state } = useMediaTrackState(
    chapter?.id,
    resolved?.track.trackId,
    resolved?.audio.resourceId ?? undefined,
  );

  // Playlist follows tracks inside the chapter first, then the next chapter.
  const playlist = useMediaPlaylist("video");
  const { previous, next } = useMemo(
    () =>
      chapter && resolved
        ? neighbours(playlist, chapter.id, resolved.track.trackId)
        : { previous: undefined, next: undefined },
    [playlist, chapter, resolved],
  );

  const apiRef = useRef<VideoPlayerApi | null>(null);

  // One-shot switch intent: the video may start ONLY when the user just pressed
  // "Watch video instead" for THIS exact track while the audio was playing.
  // A direct/copied URL, a refresh, Back/Forward or Previous/Next arms nothing.
  const [startPlaying, setStartPlaying] = useState(false);
  const consumedForRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!chapter || !resolved) return;
    const key = `${chapter.id}:${resolved.track.trackId}`;
    if (consumedForRef.current === key) return;
    consumedForRef.current = key;
    setStartPlaying(consumeRenditionSwitch(chapter.id, resolved.track.trackId, "video"));
  }, [chapter, resolved]);

  const goTo = useCallback(
    (target: { chapterId: string; trackId: string } | undefined) => {
      if (!target) return;
      apiRef.current?.pause();
      setStartPlaying(false);
      void navigate({
        to: "/video",
        search: { chapter: target.chapterId, track: target.trackId },
      });
    },
    [navigate],
  );

  /** User switch: pause + flush the video BEFORE the audio rendition loads. */
  const switchToAudio = useCallback(async () => {
    if (!chapter || !resolved) return;
    const wasPlaying = apiRef.current?.pauseAndFlush ? await apiRef.current.pauseAndFlush() : false;
    if (wasPlaying) {
      requestRenditionSwitch({
        chapterId: chapter.id,
        trackId: resolved.track.trackId,
        mode: "audio",
      });
    }
    void navigate({
      to: "/audio",
      search: { chapter: chapter.id, track: resolved.track.trackId },
    });
  }, [chapter, resolved, navigate]);

  if (!chapter) {
    return (
      <div>
        <PageHeader eyebrow="Video" title="Video player" description="No chapter selected." />
        <Link to="/course" className="text-sm underline">
          Browse chapters
        </Link>
      </div>
    );
  }

  const declaredTracks = getMediaTracks(chapter.id);

  return (
    <div>
      <PageHeader
        eyebrow={`Video · Chapter ${chapter.number}`}
        title={resolved?.track.title ?? chapter.title}
        description="Audio and video are two renditions of the same track and share one progress state."
      />

      <section className="rounded-lg border border-border p-5">
        <p className="text-xs text-muted-foreground">
          {chapter.number}. {chapter.title}
        </p>
        {resolved ? (
          <p className="mt-1 text-xs text-muted-foreground">
            Track {position} of {tracks.length} · {resolved.track.title} · Watching video
          </p>
        ) : null}

        {declaredTracks.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">This chapter has no media track yet.</p>
        ) : video.loading ? (
          <p className="mt-3 text-sm text-muted-foreground">Opening video…</p>
        ) : video.url && resolved ? (
          <div className="mt-4">
            <VideoPlayer
              key={`${resolved.track.trackId}:${video.url}`}
              chapterId={chapter.id}
              trackId={resolved.track.trackId}
              src={video.url}
              title={`${chapter.number}. ${resolved.track.title}`}
              apiRef={apiRef}
              {...(resolved.audio.resourceId ? { audioResourceId: resolved.audio.resourceId } : {})}
              {...(state?.resumeRatio !== undefined ? { resumeRatio: state.resumeRatio } : {})}
              {...(state?.playbackRate ? { playbackRate: state.playbackRate } : {})}
              {...(startPlaying ? { startPlaying: true } : {})}
              onPrevious={previous ? () => goTo(previous) : undefined}
              onNext={next ? () => goTo(next) : undefined}
            />
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            Video unavailable for this track. Import an MP4 for it on the Offline resources screen.
          </p>
        )}

        <div className="mt-5">
          <ProgressBar ratio={state?.maxRatio ?? 0} label="Media progress (shared)" />
        </div>
        <p className="mt-2 text-xs tabular-nums text-muted-foreground">
          {toPercent(state?.maxRatio ?? 0)}% of this track completed
        </p>

        {audioPlayable ? (
          <button
            type="button"
            onClick={() => void switchToAudio()}
            className="mt-5 inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-xs font-medium transition-colors hover:bg-accent"
          >
            <Headphones className="size-3.5" strokeWidth={1.75} />
            Switch to audio
          </button>
        ) : null}
      </section>

      {tracks.length > 1 ? (
        <section className="mt-8">
          <h2 className="text-sm font-semibold tracking-tight">Tracks in this chapter</h2>
          <ul className="mt-3 space-y-2">
            {tracks.map((entry, index) => (
              <li key={entry.track.trackId}>
                <Link
                  to="/video"
                  search={{ chapter: chapter.id, track: entry.track.trackId }}
                  aria-current={entry.track.trackId === resolved?.track.trackId ? "true" : undefined}
                  className="flex items-center justify-between gap-4 rounded-lg border border-border px-4 py-3 text-sm transition-colors hover:bg-accent"
                >
                  <span className="truncate">
                    {index + 1}. {entry.track.title}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {entry.video.url ? "Video ready" : "Video unavailable"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

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
