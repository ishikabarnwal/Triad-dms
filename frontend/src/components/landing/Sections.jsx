import { AnimatePresence, motion, useInView, useReducedMotion } from "framer-motion";
import { Database, FileUp, ScanSearch, ScanText, UserCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Reveal } from "../motion";
import { MARQUEE, PIPELINE, STEPS } from "./content";
import {
  AccessRequestCard,
  AdminToggles,
  ApproveDownloadDemo,
  AuditTicker,
  IsolationLanes,
  MetadataBuilder,
  ScanDocument,
  UploadDemo,
} from "./LiveDemos";
import { container, SectionIntro } from "./shared";

/** Endless strip of capabilities and formats. Pauses on hover; static with reduced motion. */
export function Marquee() {
  const items = [...MARQUEE, ...MARQUEE];
  return (
    <section aria-label="Capabilities" className="border-y border-line bg-white py-5">
      <div className="group overflow-hidden">
        <ul className="flex w-max animate-marquee gap-10 group-hover:[animation-play-state:paused] motion-reduce:w-full motion-reduce:flex-wrap motion-reduce:justify-center">
          {items.map((item, index) => (
            <li key={`${item}-${index}`} className="label-mono flex items-center gap-10 text-muted" aria-hidden={index >= MARQUEE.length}>
              {item}
              <span className="size-1 rounded-full bg-primary" aria-hidden="true" />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Tile({ code, title, text, dark = false, className, children, delay = 0, align = "end" }) {
  return (
    <Reveal delay={delay} className={cn("h-full", className)}>
      <div className={cn(dark ? "card-dark" : "card lift", "flex h-full flex-col p-6")}>
        <div className={cn("label-mono", dark ? "text-white/45" : "text-muted")}>{code}</div>
        <h3 className={cn("mt-2 text-xl font-semibold tracking-[-0.03em]", dark && "text-white")}>{title}</h3>
        <p className={cn("mt-1.5 max-w-md text-sm", dark ? "text-white/60" : "text-muted")}>{text}</p>
        <div className={cn("mt-6 flex flex-1", align === "center" ? "items-center" : "items-end")}>
          <div className="w-full">{children}</div>
        </div>
      </div>
    </Reveal>
  );
}

/** Six asymmetric tiles, each with a live mini version of the real feature inside. */
export function Bento() {
  return (
    <section id="features" className="scroll-mt-28 py-28 sm:py-36">
      <div className={container}>
        <SectionIntro
          number="02"
          label="FEATURES"
          title="Built around who is allowed to see what."
          lead="Six parts that work together, from the upload form to the audit log."
        />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
          <Tile
            dark
            code="CAP.OCR"
            title="OCR text search"
            text="Embedded text is read directly; scanned pages go through Tesseract. Every word becomes searchable."
            className="md:col-span-2 lg:col-span-3 lg:row-span-2"
            align="center"
          >
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <ScanDocument dark />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10">
              {[
                ["PAGES", "3"],
                ["WORDS", "1,842"],
                ["ENGINE", "TESS 5"],
              ].map(([label, value]) => (
                <div key={label} className="bg-plum px-4 py-3">
                  <div className="label-mono text-white/40">{label}</div>
                  <div className="mt-1 font-mono text-sm text-white">{value}</div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <ScanSearch className="size-4 text-white/60" aria-hidden="true" />
              <span className="flex-1 font-mono text-xs text-white">convoy route north</span>
              <span className="label-mono text-white/45">3 MATCHES</span>
            </div>
          </Tile>
          <Tile
            code="CAP.META"
            title="Dynamic metadata"
            text="Admins define the fields. Upload forms and filters rebuild themselves."
            className="lg:col-span-3"
            delay={0.05}
          >
            <MetadataBuilder />
          </Tile>
          <Tile
            code="CAP.RBAC"
            title="Division isolation"
            text="People open files from their own division only. Everything else is locked by default."
            className="lg:col-span-3"
            delay={0.1}
          >
            <IsolationLanes />
          </Tile>
          <Tile code="CAP.ACCESS" title="Access requests" text="Ask the owner for one file; they approve for a set time." className="lg:col-span-2">
            <AccessRequestCard className="w-full shadow-none" />
          </Tile>
          <Tile code="CAP.AUDIT" title="Audit trail" text="Who did what, when, and from where." className="lg:col-span-2" delay={0.05}>
            <div className="rounded-2xl border border-line px-3 py-1">
              <AuditTicker visible={4} />
            </div>
          </Tile>
          <Tile code="CAP.ADMIN" title="Admin control" text="Divisions, fields and roles from one Settings page." className="lg:col-span-2" delay={0.1}>
            <AdminToggles />
          </Tile>
        </div>
      </div>
    </section>
  );
}

const PIPELINE_ICONS = [FileUp, ScanText, Database, ScanSearch, UserCheck];

/** A connector line with a dot travelling along it (solid colours, no gradient). */
function Beam({ vertical = false, delay = 0 }) {
  const reduced = useReducedMotion();
  return (
    <div className={cn("relative bg-primary/25", vertical ? "mx-auto h-10 w-px" : "h-px min-w-6 flex-1")} aria-hidden="true">
      {!reduced && (
        <motion.span
          className="absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary"
          style={vertical ? { left: "50%" } : { top: "50%" }}
          animate={vertical ? { top: ["0%", "100%"] } : { left: ["0%", "100%"] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "linear", delay }}
        />
      )}
    </div>
  );
}

function PipelineNode({ node, Icon }) {
  return (
    <div className="card lift w-full p-4 lg:w-44">
      <div className="flex items-center justify-between">
        <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <span className="label-mono text-muted">{node.code}</span>
      </div>
      <div className="mt-3 font-semibold tracking-tight">{node.title}</div>
      <div className="mt-0.5 text-xs text-muted">{node.detail}</div>
    </div>
  );
}

/** Upload → OCR → storage → index → authorised user, joined by moving beams. */
export function Pipeline() {
  return (
    <section aria-label="Document pipeline" className="pb-28 sm:pb-36">
      <div className={container}>
        <SectionIntro number="03" label="PIPELINE" title="What happens to a file." center />
        <Reveal>
          <ol className="flex flex-col items-stretch lg:flex-row lg:items-center" aria-label="Document pipeline">
            {PIPELINE.map((node, index) => (
              <li key={node.code} className="contents">
                <PipelineNode node={node} Icon={PIPELINE_ICONS[index]} />
                {index < PIPELINE.length - 1 && (
                  <>
                    <div className="hidden flex-1 lg:flex">
                      <Beam delay={index * 0.3} />
                    </div>
                    <div className="lg:hidden">
                      <Beam vertical delay={index * 0.3} />
                    </div>
                  </>
                )}
              </li>
            ))}
          </ol>
        </Reveal>
      </div>
    </section>
  );
}

const STEP_VISUALS = [UploadDemo, () => <ScanDocument className="w-full max-w-md" />, () => <AccessRequestCard />, ApproveDownloadDemo];

/** One step in the left column; reports itself active once it fills the middle of the screen. */
function StepBlock({ step, index, active, onActive }) {
  const ref = useRef(null);
  const inView = useInView(ref, { margin: "-45% 0px -45% 0px" });
  useEffect(() => {
    if (inView) {
      onActive(index);
    }
  }, [inView, index, onActive]);
  const Visual = STEP_VISUALS[index];

  return (
    <div ref={ref} className="py-10 lg:flex lg:min-h-[52vh] lg:items-center lg:py-0">
      <div className={cn("transition-opacity duration-300", active ? "opacity-100" : "lg:opacity-35")}>
        <div className="label-mono text-primary">
          [ {step.number} ] {step.title.toUpperCase()}
        </div>
        <h3 className="mt-3 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">{step.title}</h3>
        <p className="mt-3 max-w-md text-muted">{step.text}</p>
        <div className="card mt-6 flex justify-center p-6 lg:hidden">
          <Visual />
        </div>
      </div>
    </div>
  );
}

/** Steps on the left highlight as they scroll past; the sticky panel on the right shows each one live. */
export function HowItWorks() {
  const [active, setActive] = useState(0);
  const Visual = STEP_VISUALS[active];
  return (
    <section id="how-it-works" className="scroll-mt-28 pb-28 sm:pb-36">
      <div className={container}>
        <SectionIntro number="04" label="HOW IT WORKS" title="From upload to approved download." />
        <div className="grid gap-12 lg:grid-cols-2">
          <div>
            {STEPS.map((step, index) => (
              <StepBlock key={step.number} step={step} index={index} active={active === index} onActive={setActive} />
            ))}
          </div>
          <div className="hidden lg:block">
            <div className="card sticky top-28 flex h-[460px] flex-col p-6">
              <div className="label-mono flex items-center justify-between text-muted">
                <span>STEP {STEPS[active].number} / 04</span>
                <span className="flex gap-1.5">
                  {STEPS.map((step, index) => (
                    <span key={step.number} className={cn("h-1 w-6 rounded-full", index <= active ? "bg-primary" : "bg-line")} />
                  ))}
                </span>
              </div>
              <div className="flex flex-1 items-center justify-center">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={active}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.25 }}
                    className="flex w-full justify-center"
                  >
                    <Visual />
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
