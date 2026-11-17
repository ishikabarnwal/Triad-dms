import { cn } from "@/lib/utils";

const HEIGHTS = { sm: "h-7", md: "h-8", lg: "h-11" };

/**
 * The Triad logo. By default it has white lettering for plum surfaces;
 * `bare` switches to the black-lettered version for light backgrounds.
 */
export default function Logo({ size = "md", bare = false, className }) {
  return (
    <img
      src={bare ? "/logo-transparent.png" : "/logo-white.png"}
      alt="Triad AI"
      width={981}
      height={297}
      className={cn("block w-auto", HEIGHTS[size], className)}
    />
  );
}
