import { useEffect, useState } from "react";
import { getPublicConfig } from "@/api/config";

// The API's defaults, shown until the real values arrive or if the request fails.
// They mirror app/config.py so the page never shows an empty number.
export const FALLBACK_CONFIG = {
  file_types: ["pdf", "png", "jpeg", "tiff", "bmp", "webp"],
  extensions: ["pdf", "png", "jpg", "jpeg", "tif", "tiff", "bmp", "webp"],
  max_upload_mb: 25,
  ocr: { enabled: true, max_pages: 25, page_timeout_seconds: 60 },
  session_minutes: 480,
  password: { hashing: "bcrypt", cost: 12, min_length: 6 },
  login_rate_limit: "10 per minute",
  access_expiry_days: { min: 1, max: 365 },
};

// One request per page load, shared by every component that asks.
let pending = null;

function loadConfig() {
  pending ??= getPublicConfig()
    .then((response) => ({ ...FALLBACK_CONFIG, ...response.data }))
    .catch(() => FALLBACK_CONFIG);
  return pending;
}

/** The limits the API enforces, from GET /api/config/public, with fallbacks so it never renders blank. */
export default function usePublicConfig() {
  const [config, setConfig] = useState(FALLBACK_CONFIG);

  useEffect(() => {
    let active = true;
    loadConfig().then((loaded) => active && setConfig(loaded));
    return () => {
      active = false;
    };
  }, []);

  return config;
}
