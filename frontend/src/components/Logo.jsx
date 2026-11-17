import { cn } from "@/lib/utils";

const HEIGHTS = { sm: "h-7", md: "h-8", lg: "h-11" };

// Intrinsic size of the logo files, so the browser reserves the space before the image loads.
const LOGO_WIDTH = 981;
const LOGO_HEIGHT = 297;

/** The Triad logo: black lettering on Paper, white lettering on Plum or Ink. */
export default function Logo({ size = "md", tone = "paper", className }) {
  return (
    <img
      src={tone === "dark" ? "/logo-white.png" : "/logo-transparent.png"}
      alt="Triad AI"
      width={LOGO_WIDTH}
      height={LOGO_HEIGHT}
      className={cn("block w-auto", HEIGHTS[size], className)}
    />
  );
}
