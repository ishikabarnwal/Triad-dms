import { useEffect, useState } from "react";
import { getPendingCount } from "../api/access";

const REFRESH_MS = 30000;
const EVENT = "triad:access-changed";

/**
 * Tell every pending-count badge to refresh now, e.g. after approving a request.
 * A `delta` (such as -1) moves the badge straight away, before the server confirms the new count.
 */
export function notifyAccessChanged(delta = 0) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { delta } }));
}

/** Pending access requests waiting on the current user, refreshed every 30s and on demand. */
export default function usePendingCount(enabled = true) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }
    let active = true;
    const refresh = () =>
      getPendingCount()
        .then((response) => active && setCount(response.data.count))
        .catch(() => {});

    const onChange = (event) => {
      const delta = event.detail?.delta || 0;
      if (delta) {
        setCount((current) => Math.max(0, current + delta));
      } else {
        refresh();
      }
    };

    refresh();
    const timer = setInterval(refresh, REFRESH_MS);
    window.addEventListener(EVENT, onChange);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener(EVENT, onChange);
    };
  }, [enabled]);

  return count;
}
