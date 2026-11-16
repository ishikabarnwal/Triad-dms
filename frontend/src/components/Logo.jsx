import { cn } from "@/lib/utils";

const HEIGHTS = { sm: "h-6", md: "h-8", lg: "h-11" };

/**
 * The Triad logo. Its lettering is black, so on plum it sits on a white tile;
 * `bare` drops the tile for white backgrounds.
 */
export default function Logo({ size = "md", bare = false, className }) {
  return (
    <span className={cn("inline-flex items-center", !bare && "rounded-xl bg-white px-2.5 py-1.5", className)}>
      <img src="/logo.png" alt="Triad AI" className={cn("block w-auto", HEIGHTS[size])} />
    </span>
  );
}
