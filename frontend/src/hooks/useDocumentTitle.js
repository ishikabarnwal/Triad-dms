import { useEffect } from "react";

/** Sets the browser tab title for a page, e.g. "Privacy · Triad DMS". */
export default function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · Triad DMS` : "Triad DMS";
  }, [title]);
}
