import { Eye, EyeSlash } from "@phosphor-icons/react";
import { useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import useMediaQuery from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";
import { SHEET } from "./content";

const LENS_RADIUS = 72;
const WIPE_MS = 1200;
// Leaving runs at 70% of entering, so redacting again feels quicker than declassifying.
const UNWIPE_MS = Math.round(WIPE_MS * 0.7);

/** A run of sheet text. Redacted parts are solid ink bars until the sheet is read in the clear. */
function Parts({ parts, clear }) {
  return parts.map((part, index) =>
    typeof part === "string" ? (
      part
    ) : (
      <span
        key={index}
        className={cn("box-decoration-clone", clear ? "bg-primary/15 text-ink" : "bg-ink text-transparent")}
      >
        {part.r}
      </span>
    ),
  );
}

/**
 * The report itself. Rendered three times (redacted, lens, full reveal) with identical
 * layout, so the clear copies line up with the bars underneath to the pixel.
 */
function SheetContent({ clear = false }) {
  return (
    <div className="flex flex-col gap-4 p-5 md:px-8 md:py-6">
      <p className="label-mono text-center tracking-[0.3em]">{SHEET.marking}</p>

      <div className="flex justify-between gap-4 border-b border-ink pb-3">
        <div className="label-mono">
          <p>{SHEET.division}</p>
          <p className="text-muted">{SHEET.unit}</p>
        </div>
        <div className="label-mono text-right">
          <p>{SHEET.reference}</p>
          <p className="text-muted">{SHEET.date}</p>
        </div>
      </div>

      <div>
        <p className="display-s">{SHEET.title}</p>
        <p className="label-mono mt-1 text-muted">{SHEET.period}</p>
      </div>

      <dl className="grid grid-cols-2 border-t border-l border-rule">
        {SHEET.fields.map(([label, value]) => (
          <div key={label} className="border-r border-b border-rule px-3 py-1.5">
            <dt className="label-mono text-muted">{label}</dt>
            <dd className="body-6">{value}</dd>
          </div>
        ))}
      </dl>

      {SHEET.sections.map((section) => (
        <div key={section.heading}>
          <p className="label-mono">{section.heading}</p>
          <p className="body-6 mt-1.5">
            <Parts parts={section.parts} clear={clear} />
          </p>
        </div>
      ))}

      <div className="flex items-end justify-between gap-4 border-t border-rule pt-3">
        <div>
          <p className="label-mono text-muted">Signed</p>
          <p className="body-6 mt-0.5">
            <Parts parts={[{ r: SHEET.signatory.name }]} clear={clear} />
          </p>
        </div>
        <p className="body-6 text-right text-muted">{SHEET.signatory.role}</p>
      </div>

      <p className="label-mono text-center tracking-[0.3em]">{SHEET.marking}</p>
    </div>
  );
}

/** The ring that frames the lens: a hard circle with four ticks, like a reticle. */
function LensRing({ ringRef, visible }) {
  const tick = "absolute bg-ink";
  return (
    <div
      ref={ringRef}
      aria-hidden="true"
      className="pointer-events-none absolute top-0 left-0 z-30 will-change-transform"
      style={{ width: LENS_RADIUS * 2, height: LENS_RADIUS * 2 }}
    >
      <div
        className={cn(
          "relative size-full rounded-full border-2 border-ink transition-[opacity,scale] duration-300 ease-file",
          visible ? "scale-100 opacity-100" : "scale-75 opacity-0",
        )}
      >
        <span className={cn(tick, "-top-2 left-1/2 h-2 w-px")} />
        <span className={cn(tick, "-bottom-2 left-1/2 h-2 w-px")} />
        <span className={cn(tick, "top-1/2 -left-2 h-px w-2")} />
        <span className={cn(tick, "top-1/2 -right-2 h-px w-2")} />
      </div>
    </div>
  );
}

/**
 * The hero's signature: a redacted report that can be read through a hard-edged clearance lens.
 * Mouse and pen users get the lens. Touch screens lift the bars once the sheet is in view.
 * Everyone gets the Declassify toggle, which is also the only motion under reduced motion.
 */
export default function RedactedSheet() {
  const reduced = useReducedMotion();
  const canHover = useMediaQuery("(hover: hover) and (pointer: fine)");
  const [revealed, setRevealed] = useState(false);
  const [lensOn, setLensOn] = useState(false);
  const [scanning, setScanning] = useState(false);

  const sheetRef = useRef(null);
  const lensRef = useRef(null);
  const ringRef = useRef(null);
  const point = useRef({ x: 0, y: 0 });
  const frame = useRef(0);
  const userToggled = useRef(false);

  const placeLens = () => {
    frame.current = 0;
    const { x, y } = point.current;
    lensRef.current?.style.setProperty("--lx", `${x}px`);
    lensRef.current?.style.setProperty("--ly", `${y}px`);
    if (ringRef.current) {
      ringRef.current.style.transform = `translate3d(${x - LENS_RADIUS}px, ${y - LENS_RADIUS}px, 0)`;
    }
  };

  const trackPointer = (event) => {
    const rect = sheetRef.current.getBoundingClientRect();
    point.current = { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const handlePointerEnter = (event) => {
    if (event.pointerType === "touch" || revealed) {
      return;
    }
    trackPointer(event);
    placeLens();
    setLensOn(true);
  };

  const handlePointerMove = (event) => {
    if (event.pointerType === "touch" || revealed) {
      return;
    }
    trackPointer(event);
    if (!lensOn) {
      setLensOn(true);
    }
    // One lens update per frame, however fast the pointer reports.
    frame.current ||= requestAnimationFrame(placeLens);
  };

  const handlePointerLeave = () => setLensOn(false);

  const setRevealedWithScan = (next) => {
    setRevealed(next);
    setLensOn(false);
    if (!reduced) {
      setScanning(true);
    }
  };

  const toggle = () => {
    userToggled.current = true;
    setRevealedWithScan(!revealed);
  };

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  useEffect(() => {
    if (!scanning) {
      return undefined;
    }
    const timer = setTimeout(() => setScanning(false), revealed ? WIPE_MS : UNWIPE_MS);
    return () => clearTimeout(timer);
  }, [scanning, revealed]);

  // Touch screens have no lens, so the bars lift by themselves once, when the sheet is mostly in view.
  useEffect(() => {
    if (canHover || reduced || !sheetRef.current) {
      return undefined;
    }
    let timer;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !userToggled.current) {
          observer.disconnect();
          timer = setTimeout(() => {
            setRevealed(true);
            setScanning(true);
          }, 400);
        }
      },
      { threshold: 0.6 },
    );
    observer.observe(sheetRef.current);
    return () => {
      observer.disconnect();
      clearTimeout(timer);
    };
  }, [canHover, reduced]);

  const wipeMs = revealed ? WIPE_MS : UNWIPE_MS;
  const hint = canHover
    ? "Point at the sheet to read it."
    : reduced
      ? "Tap Declassify to read it."
      : "The bars lift once it is in view.";

  return (
    <figure className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="label-mono">Clearance lens</p>
          <p className="body-6 mt-1 text-muted">{hint}</p>
        </div>
        <Button variant="outline" size="sm" onClick={toggle} aria-pressed={revealed}>
          {revealed ? <EyeSlash aria-hidden="true" className="size-4" /> : <Eye aria-hidden="true" className="size-4" />}
          {revealed ? "Redact again" : "Declassify sheet"}
        </Button>
      </div>

      <div
        ref={sheetRef}
        aria-hidden="true"
        onPointerEnter={handlePointerEnter}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        className="relative overflow-hidden border border-ink bg-white shadow-sheet select-none"
      >
        <SheetContent />

        <div
          ref={lensRef}
          className="absolute inset-0 z-10 bg-white"
          style={{
            "--lens-r": lensOn && !revealed ? `${LENS_RADIUS}px` : "0px",
            clipPath: "circle(var(--lens-r) at var(--lx, 50%) var(--ly, 50%))",
            transition: reduced ? "none" : "--lens-r 300ms var(--ease-file)",
          }}
        >
          <SheetContent clear />
        </div>

        <div
          className="absolute inset-0 z-20 bg-white"
          style={{
            clipPath: revealed ? "inset(0 0 0 0)" : "inset(0 0 100% 0)",
            transition: reduced ? "none" : `clip-path ${wipeMs}ms var(--ease-file)`,
          }}
        >
          <SheetContent clear />
        </div>

        <div
          className="pointer-events-none absolute inset-0 z-20"
          style={{
            transform: revealed ? "translateY(100%)" : "translateY(0%)",
            transition: reduced ? "none" : `transform ${wipeMs}ms var(--ease-file)`,
          }}
        >
          <div
            className={cn(
              "h-0.5 w-full bg-primary transition-opacity duration-200",
              scanning ? "opacity-100" : "opacity-0",
            )}
          />
        </div>

        {canHover && <LensRing ringRef={ringRef} visible={lensOn && !revealed} />}
      </div>

      <figcaption className="sr-only">
        Sample document: a Division A fleet maintenance report with its sensitive details redacted. The Declassify
        sheet button shows it in full.
      </figcaption>
    </figure>
  );
}
