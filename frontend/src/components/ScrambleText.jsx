import { useInView, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&*/<>[]";
const DURATION_MS = 600;

function randomGlyph() {
  return GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
}

/**
 * Text that "decrypts": random characters settle into the real word, left to right.
 * Plays once on mount, or when it first scrolls into view with `onView`. Screen readers
 * always get the real text; reduced-motion users just see it.
 */
export default function ScrambleText({ text, onView = false, delay = 0, className, as: Component = "span" }) {
  const reduced = useReducedMotion();
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const [display, setDisplay] = useState(reduced ? text : text.replace(/\S/g, " "));

  const shouldPlay = !reduced && (!onView || inView);

  useEffect(() => {
    if (reduced) {
      setDisplay(text);
      return undefined;
    }
    if (!shouldPlay) {
      return undefined;
    }
    let frame;
    let start;
    const tick = (now) => {
      start ??= now + delay;
      const progress = Math.max(0, Math.min(1, (now - start) / DURATION_MS));
      const settled = Math.floor(progress * text.length);
      setDisplay(
        text
          .split("")
          .map((char, index) => (index < settled || char === " " ? char : randomGlyph()))
          .join(""),
      );
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [text, shouldPlay, reduced, delay]);

  return (
    <Component ref={ref} className={className} aria-label={text}>
      <span aria-hidden="true">{display}</span>
    </Component>
  );
}
