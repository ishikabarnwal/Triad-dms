import { useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Reveal } from "../motion";

/** Section opener: a small indigo eyebrow, a heading of at most 48px, and an optional one sentence lead. */
export function SectionIntro({ eyebrow, title, titleId, lead, center = false, dark = false, className }) {
  return (
    <Reveal className={cn("mb-12 max-w-[720px] sm:mb-14", center && "mx-auto text-center", className)}>
      <p className={cn("text-sm font-semibold", dark ? "text-white/70" : "text-primary")}>{eyebrow}</p>
      <h2
        id={titleId}
        className={cn(
          "mt-3 text-[2rem] leading-[1.15] font-bold tracking-[-0.03em] text-balance sm:text-[2.5rem] lg:text-5xl lg:leading-[1.1]",
          dark && "text-white",
        )}
      >
        {title}
      </h2>
      {lead && (
        <p className={cn("mt-4 max-w-xl text-lg leading-[1.6] text-pretty", center && "mx-auto", dark ? "text-white/65" : "text-muted")}>
          {lead}
        </p>
      )}
    </Reveal>
  );
}

/**
 * Steps through a looping sequence: returns the index of the current step, moving on after
 * each step's duration. With reduced motion it just holds the final step.
 */
export function useSequence(durations) {
  const reduced = useReducedMotion();
  const last = durations.length - 1;
  const [step, setStep] = useState(reduced ? last : 0);
  useEffect(() => {
    if (reduced) {
      setStep(last);
      return undefined;
    }
    const timer = setTimeout(() => setStep((current) => (current + 1) % durations.length), durations[step]);
    return () => clearTimeout(timer);
  }, [step, durations, reduced, last]);
  return step;
}

/** Counts from 0 to `target` while `running`, for progress bars in the demos. */
export function useProgress(running, target = 100, stepMs = 90) {
  const reduced = useReducedMotion();
  const [value, setValue] = useState(reduced ? target : 0);
  useEffect(() => {
    if (reduced) {
      setValue(target);
      return undefined;
    }
    if (!running) {
      setValue(0);
      return undefined;
    }
    const timer = setInterval(() => setValue((current) => Math.min(target, current + 6)), stepMs);
    return () => clearInterval(timer);
  }, [running, target, stepMs, reduced]);
  return value;
}

export const container = "mx-auto w-full max-w-[1200px] px-5 sm:px-6";
