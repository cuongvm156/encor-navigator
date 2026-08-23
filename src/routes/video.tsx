import { createFileRoute, Link } from "@tanstack/react-router";
import { Headphones } from "lucide-react";
import { useMemo } from "react";

import { PageHeader } from "@/components/layout/PageHeader";
import { ProgressBar } from "@/features/progress/ProgressBar";
import { getChapter } from "@/features/course/data";
import { getMediaTracks } from "@/data/resourceManifest";
import { VideoPlayer } from "@/features/media/VideoPlayer";
import { useMediaTrackState } from "@/features/media/useMediaTrackState";
import { useOfflineResources } from "@/features/offline/useOfflineResources";
import { useResolvedResource } from "@/features/offline/useOfflineResources";
import { resolveChapterTracks } from "@/features/media/tracks";
import { toPercent } from "@/features/progress/weights";

export const Route = createFileRoute("/video")({
  validateSearch: (search: Record<string, unknown>) => ({
    chapter: typeof search["chapter"] === "string" ? (search["chapter"] as string) : undefined,
    track: typeof search["track"] === "string" ? (search["track"] as string) : undefined,
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
    ],
  }),
  component: VideoPage,
});

function VideoPage() {
  const { chapter: chapterId, track: trackId } = Route.useSearch();
  const chapter = chapterId ? getChapter(chapterId) : undefined;
  const offlineRows = useOfflineResources();

  const resolved = useMemo(() => {
    if (!chapter) return undefined;
    const tracks = resolveChapterTracks(offlineRows, chapter.id);
    return tracks.find((entry) => entry.track.trackId === trackId) ?? tracks[0];
  }, [chapter, offlineRows, trackId]);

  const activeTrackId = resolved?.track.trackId;
  // Same offline-aware resolution as Reader/Audio (object-URL fallback in dev).
  const video = useResolvedResource(chapter?.id, "video");
  const { state } = useMediaTrackState(
    chapter?.id,
    activeTrackId,
    resolved?.audio.resourceId ?? undefined,
  );

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
  const audioPlayable = Boolean(resolved?.audio.url);

  return (
    <div>
      <PageHeader
        eyebrow={`Video · Chapter ${chapter.number}`}
        title={resolved?.track.title ?? chapter.title}
        description="Audio and video are two renditions of the same track and share one progress state."
      />

      <section className="rounded-lg border border-border p-5">
        <p className="text-xs text-muted-foreground">{chapter.title}</p>

        {declaredTracks.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            This chapter has no media track yet.
          </p>
        ) : video.loading ? (
          <p className="mt-3 text-sm text-muted-foreground">Opening video…</p>
        ) : video.url && resolved ? (
          <div className="mt-4">
            <VideoPlayer
              chapterId={chapter.id}
              trackId={resolved.track.trackId}
              src={video.url}
              title={`${chapter.number}. ${resolved.track.title}`}
              {...(resolved.audio.resourceId ? { audioResourceId: resolved.audio.resourceId } : {})}
              {...(state?.resumeRatio !== undefined ? { resumeRatio: state.resumeRatio } : {})}
            />
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            Video unavailable. Import an MP4 for this chapter on the Offline resources screen.
          </p>
        )}

        <div className="mt-5">
          <ProgressBar ratio={state?.maxRatio ?? 0} label="Media progress (shared)" />
        </div>
        <p className="mt-2 text-xs tabular-nums text-muted-foreground">
          {toPercent(state?.maxRatio ?? 0)}% of this track completed
        </p>

        {audioPlayable ? (
          <Link
            to="/audio"
            search={{ chapter: chapter.id }}
            className="mt-5 inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-xs font-medium transition-colors hover:bg-accent"
          >
            <Headphones className="size-3.5" strokeWidth={1.75} />
            Switch to audio
          </Link>
        ) : null}
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
