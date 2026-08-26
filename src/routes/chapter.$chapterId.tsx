import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { BookOpen, Bookmark, Headphones, StickyNote, Video } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { ProgressBar } from "@/features/progress/ProgressBar";
import {
  getChapter,
  getPart,
  resourcesForChapter,
} from "@/features/course/data";
import { audioStatus, getPdfResource, hasAudioResource, pdfStatus } from "@/data/resourceManifest";
import { useMediaTrackStates } from "@/features/media/useMediaTrackState";
import { chapterMediaRatio } from "@/features/media/mediaProgress";
import { resolveChapterTracks } from "@/features/media/tracks";
import { useOfflineResources } from "@/features/offline/useOfflineResources";
import { useLiveProgress } from "@/features/progress/useLiveProgress";
import { useChapterAnnotationCounts } from "@/features/annotations/useAnnotations";
import {
  audioRatioOf,
  chapterCompletion,
  readingRatioOf,
  statusOf,
  toPercent,
} from "@/features/progress/weights";

export const Route = createFileRoute("/chapter/$chapterId")({
  loader: ({ params }) => {
    const chapter = getChapter(params.chapterId);
    if (!chapter) throw notFound();
    return { chapter };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return { meta: [{ title: "Chapter not found — ENCOR Study" }, { name: "robots", content: "noindex" }] };
    }
    const title = `${loaderData.chapter.title} — ENCOR Study`;
    const description =
      loaderData.chapter.summary ??
      `Chapter ${loaderData.chapter.number} of the CCNP ENCOR 350-401 Official Cert Guide: ${loaderData.chapter.title}.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
      ],
    };
  },
  component: ChapterPage,
});

function ChapterPage() {
  const { chapter } = Route.useLoaderData();
  const part = getPart(chapter.partId);
  const { progressById } = useLiveProgress();
  const progress = progressById[chapter.id];
  const pdfResource = getPdfResource(chapter.id);
  const pdfAvailable = Boolean(pdfResource);
  const pdfTesting = pdfStatus(chapter.id) === "testing";
  const audioAvailable = hasAudioResource(chapter.id);
  const audioTesting = audioStatus(chapter.id) === "testing";
  const chapterResources = resourcesForChapter(chapter.id);
  const { noteCount, bookmarkCount } = useChapterAnnotationCounts(chapter.id);
  // Media = the shared audio+video progress of this chapter's MediaTracks. A
  // track completed through either rendition counts exactly once.
  const offlineRows = useOfflineResources();
  const trackStates = useMediaTrackStates();
  const tracks = resolveChapterTracks(offlineRows, chapter.id);
  const mediaRatio =
    tracks.length > 0 ? chapterMediaRatio(chapter.id, trackStates) : audioRatioOf(progress);


  return (
    <div>
      {domain ? (
        <Link
          to="/course/$domainId"
          params={{ domainId: domain.id }}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          ← Domain {domain.number}: {domain.title}
          {section ? ` · ${section.label} ${section.title}` : ""}
        </Link>
      ) : (
        <Link to="/course" className="text-xs text-muted-foreground hover:text-foreground">
          ← {OUT_OF_SCOPE_LABEL}
        </Link>
      )}
      {part ? (
        <p className="mt-1 text-xs text-muted-foreground">
          OCG reference · Part {part.number}: {part.title}
        </p>
      ) : null}

      <div className="mt-3">
        <PageHeader
          eyebrow={`Chapter ${chapter.number} · ${statusOf(progress)} · ${toPercent(
            chapterCompletion(progress),
          )}% overall`}
          title={chapter.title}
          {...(chapter.summary ? { description: chapter.summary } : {})}
        />
      </div>

      <section className="rounded-lg border border-border p-5">
        <ProgressBar ratio={chapterCompletion(progress)} label="Chapter completion" />
      </section>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <article className="rounded-lg border border-border p-4">
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <BookOpen className="size-3.5" strokeWidth={1.75} />
            Reading
          </p>
          <div className="mt-3">
            <ProgressBar ratio={readingRatioOf(progress)} label="Reading progress" />
          </div>
          {!pdfAvailable ? (
            <p className="mt-2 text-xs text-muted-foreground">PDF unavailable</p>
          ) : null}
          {pdfTesting ? (
            <p className="mt-2 inline-flex rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
              Test document
            </p>
          ) : null}
          {pdfAvailable ? (
            <Link
              to="/reader/$chapterId"
              params={{ chapterId: chapter.id }}
              className="mt-4 inline-flex items-center justify-center rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Continue reading
            </Link>
          ) : null}
        </article>

        <article className="rounded-lg border border-border p-4">
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Headphones className="size-3.5" strokeWidth={1.75} />
            Media
          </p>
          <div className="mt-3">
            <ProgressBar ratio={mediaRatio} label="Media progress" />
          </div>
          {audioTesting ? (
            <p className="mt-2 inline-flex rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
              Test audio
            </p>
          ) : null}
          {audioAvailable ? (
            <Link
              to="/audio"
              search={{ chapter: chapter.id }}
              className="mt-4 inline-flex items-center justify-center rounded-md border border-input bg-background px-3 py-2 text-xs font-medium transition-colors hover:bg-accent"
            >
              Continue listening
            </Link>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">Audio unavailable</p>
          )}
        </article>
      </div>

      <section className="mt-4 grid grid-cols-2 gap-3">
        <Link
          to="/notes"
          search={{ chapter: chapter.id, tab: "notes" as const }}
          className="flex items-center justify-between rounded-lg border border-border px-4 py-3 text-sm transition-colors hover:bg-accent"
        >
          <span className="flex items-center gap-2 text-muted-foreground">
            <StickyNote className="size-4" strokeWidth={1.75} />
            Notes
          </span>
          <span className="font-medium tabular-nums">{noteCount}</span>
        </Link>
        <Link
          to="/notes"
          search={{ chapter: chapter.id, tab: "bookmarks" as const }}
          className="flex items-center justify-between rounded-lg border border-border px-4 py-3 text-sm transition-colors hover:bg-accent"
        >
          <span className="flex items-center gap-2 text-muted-foreground">
            <Bookmark className="size-4" strokeWidth={1.75} />
            Bookmarks
          </span>
          <span className="font-medium tabular-nums">{bookmarkCount}</span>
        </Link>
      </section>

      {chapter.objectives && chapter.objectives.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-sm font-semibold tracking-tight">Objectives</h2>
          <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
            {chapter.objectives.map((objective) => (
              <li key={objective} className="rounded-md border border-border px-3 py-2">
                {objective}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {tracks.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-sm font-semibold tracking-tight">Media tracks</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Each track has one shared progress state; the MP3 and the MP4 are two renditions of the
            same lesson.
          </p>
          <ul className="mt-3 space-y-2">
            {tracks.map(({ track, audio, video }) => {
              const state = trackStates.find(
                (row) => row.chapterId === chapter.id && row.trackId === track.trackId,
              );
              return (
                <li key={track.trackId} className="rounded-lg border border-border px-4 py-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm">
                        {track.order}. {track.title}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {audio.url ? "Audio ready" : "Audio unavailable"} ·{" "}
                        {video.url ? "Video ready" : "Video unavailable"}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {toPercent(state?.maxRatio ?? 0)}%
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {audio.url ? (
                      <Link
                        to="/audio"
                        search={{ chapter: chapter.id }}
                        className="inline-flex items-center gap-2 rounded-md border border-input px-2.5 py-1.5 text-xs transition-colors hover:bg-accent"
                      >
                        <Headphones className="size-3.5" strokeWidth={1.75} />
                        Listen
                      </Link>
                    ) : null}
                    {video.url ? (
                      <Link
                        to="/video"
                        search={{ chapter: chapter.id, track: track.trackId }}
                        className="inline-flex items-center gap-2 rounded-md border border-input px-2.5 py-1.5 text-xs transition-colors hover:bg-accent"
                      >
                        <Video className="size-3.5" strokeWidth={1.75} />
                        Watch
                      </Link>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <section className="mt-8">
        <h2 className="text-sm font-semibold tracking-tight">Resources</h2>
        <ul className="mt-3 space-y-2">
          <li className="flex items-center justify-between gap-4 rounded-lg border border-border px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm">Chapter PDF</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {pdfAvailable ? (pdfTesting ? "pdf · test document" : "pdf") : "PDF unavailable"}
              </p>
            </div>
            {pdfAvailable ? (
              <Link
                to="/reader/$chapterId"
                params={{ chapterId: chapter.id }}
                className="shrink-0 rounded-md border border-input px-2.5 py-1.5 text-xs transition-colors hover:bg-accent"
              >
                Open
              </Link>
            ) : null}
          </li>
          <li className="flex items-center justify-between gap-4 rounded-lg border border-border px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm">Chapter audio</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {audioAvailable ? (audioTesting ? "audio · test audio" : "audio") : "Audio unavailable"}
              </p>
            </div>
            {audioAvailable ? (
              <Link
                to="/audio"
                search={{ chapter: chapter.id }}
                className="shrink-0 rounded-md border border-input px-2.5 py-1.5 text-xs transition-colors hover:bg-accent"
              >
                Open
              </Link>
            ) : null}
          </li>
          {chapterResources.map((resource) => (
            <li
              key={resource.id}
              className="flex items-center justify-between gap-4 rounded-lg border border-border px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm">{resource.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {resource.kind} · {resource.source}
                </p>
              </div>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {resource.minutes} min
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
