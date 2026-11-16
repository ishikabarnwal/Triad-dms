import { motion, useReducedMotion } from "framer-motion";

const EASE = [0.22, 1, 0.36, 1];

/** Fades and lifts its children into view the first time they scroll on screen. */
export function Reveal({ children, delay = 0, y = 24, className, style, as = "div" }) {
  const Component = motion[as];
  return (
    <Component
      className={className}
      style={style}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6, delay, ease: EASE }}
    >
      {children}
    </Component>
  );
}

/** A card that lifts slightly on hover. */
export function LiftCard({ children, className, ...props }) {
  return (
    <motion.div className={className} whileHover={{ y: -4 }} transition={{ duration: 0.2, ease: EASE }} {...props}>
      {children}
    </motion.div>
  );
}

/** Wraps a page so route changes fade and slide in. */
export function PageTransition({ children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.28, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

/** Gentle up-and-down drift for the landing page's floating cards. Still when motion is reduced. */
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
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.3, delay: Math.min(index * step, 0.4), ease: EASE },
  };
}
