import { useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Reveal } from "../motion";
import ScrambleText from "../ScrambleText";

/** Mono section label like "[ 02 ] FEATURES" that decrypts when it scrolls into view. */
export function SectionLabel({ number, text, dark = false, className }) {
  return (
    <div className={cn("label-mono flex items-center gap-2", dark ? "text-white/55" : "text-muted", className)}>
      <span className={dark ? "text-white/35" : "text-muted/70"}>[ {number} ]</span>
      <ScrambleText text={text} onView className={dark ? "text-white" : "text-ink"} />
    </div>
  );
}

/** Label, huge headline and lead paragraph for a landing section. */
export function SectionIntro({ number, label, title, lead, center = false, dark = false, className }) {
  return (
    <Reveal className={cn("mb-14", center && "mx-auto text-center", className)} style={{ maxWidth: center ? 820 : undefined }}>
      <SectionLabel number={number} text={label} dark={dark} className={center ? "justify-center" : undefined} />
      <h2
        className={cn(
          "mt-5 text-[clamp(2.25rem,5vw,4rem)] leading-[1] font-semibold tracking-[-0.04em]",
          dark && "text-white",
        )}
      >
        {title}
      </h2>
      {lead && <p className={cn("mt-5 max-w-xl text-lg", center && "mx-auto", dark ? "text-white/65" : "text-muted")}>{lead}</p>}
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
