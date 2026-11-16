import { useEffect, useState } from "react";
import { getPendingCount } from "../api/access";

const REFRESH_MS = 30000;
const EVENT = "triad:access-changed";

/** Tell every pending-count badge to refresh now, e.g. after approving a request. */
export function notifyAccessChanged() {
  window.dispatchEvent(new Event(EVENT));
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

    refresh();
    const timer = setInterval(refresh, REFRESH_MS);
    window.addEventListener(EVENT, refresh);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener(EVENT, refresh);
    };
  }, [enabled]);

  return count;
}
