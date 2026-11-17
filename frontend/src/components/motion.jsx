import { animate, motion, useInView, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

const EASE = [0.22, 1, 0.36, 1];

/**
 * Lifts its children into place the first time they scroll on screen. It only moves them, never
 * hides them: full-page screenshots and print are taken without scrolling, and must not come out blank.
 */
export function Reveal({ children, delay = 0, y = 16, className, style, as = "div" }) {
  const Component = motion[as];
  return (
    <Component
      className={className}
      style={style}
      initial={{ y }}
      whileInView={{ y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.55, delay, ease: EASE }}
    >
      {children}
    </Component>
  );
}

/** Wraps a page so route changes fade and slide in. */
export function PageTransition({ children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.25, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

/** Gentle up-and-down drift. Still when the user prefers reduced motion. */
export function Float({ children, className, duration = 6, distance = 8, delay = 0 }) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className={className}
      animate={reduced ? undefined : { y: [0, -distance, 0] }}
      transition={reduced ? undefined : { duration, delay, repeat: Infinity, ease: "easeInOut" }}
    >
      {children}
    </motion.div>
  );
}

/** Motion props for staggered list items: pass the item's index. */
export function staggerItem(index, step = 0.035) {
  return {
    initial: { opacity: 0, y: 6 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.28, delay: Math.min(index * step, 0.4), ease: EASE },
  };
}

/** A number that counts up from 0 the first time it scrolls into view. */
export function CountUp({ value, suffix = "", duration = 1.2, className }) {
  const reduced = useReducedMotion();
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const [shown, setShown] = useState(reduced ? value : 0);

  useEffect(() => {
    if (reduced) {
      setShown(value);
      return undefined;
    }
    if (!inView) {
      return undefined;
    }
    const controls = animate(0, value, {
      duration,
      ease: EASE,
      onUpdate: (latest) => setShown(Math.round(latest)),
    });
    return () => controls.stop();
  }, [value, inView, reduced, duration]);

  return (
    <span ref={ref} className={className}>
      {shown.toLocaleString("en-IN")}
      {suffix}
    </span>
  );
}
