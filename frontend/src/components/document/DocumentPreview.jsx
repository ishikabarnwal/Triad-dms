import { ArrowsIn, ArrowsOut, DownloadSimple, FileX, MagnifyingGlassPlus, Warning, X } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { blobErrorInfo } from "@/api/client";
import { previewDocument } from "@/api/documents";
import { Button } from "../ui/button";
import { Dialog, DialogClose, DialogContent } from "../ui/dialog";
import { Skeleton } from "../ui/skeleton";

const FRAME = "h-[72vh] min-h-[420px] max-h-[900px] w-full";

/** A blank page with pulsing lines, shown while the file streams in. */
function PreviewSkeleton() {
  return (
    <div className={`${FRAME} flex items-center justify-center rounded-xl bg-lavender`} role="status" aria-label="Loading preview">
      <div className="h-[78%] w-[min(70%,420px)] space-y-3 rounded-lg border border-line bg-white p-8 shadow-soft">
        <Skeleton className="mb-6 h-4 w-1/2" />
        {[100, 92, 96, 70, 100, 88, 94, 60].map((width, index) => (
          <Skeleton key={index} className="h-2.5" style={{ width: `${width}%` }} />
        ))}
      </div>
    </div>
  );
}

/** Calm message inside the preview frame: an icon, a line of explanation and an optional action. */
function PreviewMessage({ Icon, title, message, action }) {
  return (
    <div className={`${FRAME} flex flex-col items-center justify-center rounded-xl bg-lavender px-6 text-center`}>
      <span className="mb-4 flex size-12 items-center justify-center rounded-xl bg-white text-primary shadow-soft">
        <Icon className="size-6" aria-hidden="true" />
      </span>
      <p className="font-bold tracking-[-0.02em]">{title}</p>
      <p className="mt-1.5 max-w-sm text-sm leading-6 text-pretty text-muted">{message}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** Full screen view of an image. Clicking the image switches between fit to screen and actual size. */
function ImageZoom({ src, title, open, onOpenChange }) {
  const [actualSize, setActualSize] = useState(false);
  useEffect(() => {
    if (open) {
      setActualSize(false);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={`${title}, full view`} hideTitle className="max-w-[min(96vw,1600px)] bg-lavender">
        <div className="flex items-center justify-between gap-3 border-b border-line bg-white px-4 py-2.5">
          <p className="truncate text-sm font-semibold">{title}</p>
          <div className="flex shrink-0 gap-1">
            <Button variant="ghost" size="sm" onClick={() => setActualSize((current) => !current)}>
              {actualSize ? <ArrowsIn className="size-4" aria-hidden="true" /> : <ArrowsOut className="size-4" aria-hidden="true" />}
              {actualSize ? "Fit to screen" : "Actual size"}
            </Button>
            <DialogClose asChild>
              <Button variant="ghost" size="iconSm" aria-label="Close">
                <X className="size-4" aria-hidden="true" />
              </Button>
            </DialogClose>
          </div>
        </div>
        <div className="max-h-[calc(100dvh-7rem)] overflow-auto p-4">
          <img
            src={src}
            alt={title}
            onClick={() => setActualSize((current) => !current)}
            className={actualSize ? "max-w-none cursor-zoom-out" : "mx-auto max-h-[calc(100dvh-9rem)] w-auto cursor-zoom-in object-contain"}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Inline view of a document the user may open: PDFs in the browser's viewer, images with click to zoom.
 * The file is fetched with the auth header and shown from an object URL that is released on unmount.
 */
export default function DocumentPreview({ document, onDownload }) {
  const [state, setState] = useState({ url: null, loading: true, error: "" });
  const [attempt, setAttempt] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const isPdf = document.content_type === "application/pdf";
  // A PDF with no pages (like the API test file) can't be drawn, so don't try.
  const noPages = isPdf && document.page_count === 0;

  useEffect(() => {
    if (noPages) {
      return undefined;
    }
    let active = true;
    let url = null;
    setState({ url: null, loading: true, error: "" });
    previewDocument(document.id)
      .then((response) => {
        url = URL.createObjectURL(new Blob([response.data], { type: document.content_type }));
        if (active) {
          setState({ url, loading: false, error: "" });
        }
      })
      .catch(async (error) => {
        const info = await blobErrorInfo(error);
        if (active) {
          setState({ url: null, loading: false, error: info.message });
        }
      });
    return () => {
      active = false;
      if (url) {
        URL.revokeObjectURL(url);
      }
    };
  }, [document.id, document.content_type, noPages, attempt]);

  let body;
  if (noPages) {
    body = (
      <PreviewMessage
        Icon={FileX}
        title="This PDF has no pages to show"
        message="The file was saved exactly as uploaded, but it contains no readable pages. You can still download the original."
        action={
          <Button variant="outline" onClick={onDownload}>
            <DownloadSimple className="size-4" aria-hidden="true" />
            Download
          </Button>
        }
      />
    );
  } else if (state.loading) {
    body = <PreviewSkeleton />;
  } else if (state.error) {
    body = (
      <PreviewMessage
        Icon={Warning}
        title="Couldn't load the preview"
        message={state.error}
        action={
          <Button variant="outline" onClick={() => setAttempt((count) => count + 1)}>
            Try again
          </Button>
        }
      />
    );
  } else if (isPdf) {
    body = <iframe src={state.url} title={`Preview of ${document.title}`} className={`${FRAME} rounded-xl border border-line bg-white`} />;
  } else {
    body = (
      <button
        type="button"
        onClick={() => setZoomed(true)}
        className={`${FRAME} group relative flex cursor-zoom-in items-center justify-center overflow-hidden rounded-xl bg-lavender p-4`}
        aria-label={`Open ${document.title} full view`}
      >
        <img src={state.url} alt="" className="max-h-full max-w-full rounded-md object-contain shadow-soft" />
        <span className="absolute right-3 bottom-3 inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs font-semibold text-ink opacity-90 transition-opacity group-hover:opacity-100">
          <MagnifyingGlassPlus className="size-4" aria-hidden="true" />
          Click to zoom
        </span>
      </button>
    );
  }

  const pages = isPdf && document.page_count ? `${document.page_count} ${document.page_count === 1 ? "page" : "pages"}` : null;

  return (
    <section aria-labelledby="preview-title" className="card p-4 sm:p-5">
      <div className="mb-4 flex items-baseline justify-between gap-3 px-1">
        <h2 id="preview-title" className="text-lg font-bold tracking-[-0.02em]">
          Preview
        </h2>
        {pages && <span className="text-sm text-muted">{pages}</span>}
      </div>
      {body}
      {state.url && !isPdf && <ImageZoom src={state.url} title={document.title} open={zoomed} onOpenChange={setZoomed} />}
    </section>
  );
}
