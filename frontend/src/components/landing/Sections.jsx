import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Database, FileUp, ScanSearch, ScanText, UserCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Reveal } from "../motion";
import { PIPELINE, STEPS } from "./content";
import {
  AccessRequestCard,
  AdminToggles,
  ApproveDownloadDemo,
  AuditTicker,
  ExpiryChoices,
  IsolationLanes,
  MetadataBuilder,
  RequestDemo,
  ScanDocument,
  SearchRow,
  UploadDemo,
} from "./LiveDemos";
import { container, SectionIntro } from "./shared";

/**
 * A feature card: title, one line, and a visual panel that takes up the rest of the card,
 * so every card in a row ends at the same height with no empty space inside.
 */
function FeatureCard({ title, text, dark = false, delay = 0, children }) {
  return (
    <Reveal delay={delay} className="h-full">
      <article className={cn(dark ? "card-dark" : "card", "flex h-full flex-col p-6")}>
        <h3 className={cn("text-lg font-bold tracking-[-0.02em]", dark && "text-white")}>{title}</h3>
        <p className={cn("mt-1.5 text-sm leading-6", dark ? "text-white/65" : "text-muted")}>{text}</p>
        <div className={cn("mt-5 flex flex-1 flex-col justify-center rounded-xl p-4", dark ? "border border-white/10 bg-white/5" : "bg-lavender")}>
          {children}
        </div>
      </article>
    </Reveal>
  );
}

/** Six features in a 3 by 2 grid of equal cards, each with a live mini version of the real screen. */
export function Bento() {
  return (
    <section id="features" className="scroll-mt-28 py-24 sm:py-28">
      <div className={container}>
        <SectionIntro
          eyebrow="Features"
          title="Built around who is allowed to see what."
          lead="Six parts that work together, from the upload form to the audit log."
        />
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:auto-rows-fr lg:grid-cols-3">
          <FeatureCard dark title="Search inside scans" text="OCR reads every page, so a document can be found by the words in it.">
            <ScanDocument dark />
            <div className="mt-3">
              <SearchRow dark />
            </div>
          </FeatureCard>
          <FeatureCard title="Fields you define" text="Admins add fields, and upload forms and filters follow." delay={0.05}>
            <MetadataBuilder />
          </FeatureCard>
          <FeatureCard title="Division isolation" text="People open files from their own division. Everything else stays locked." delay={0.1}>
            <IsolationLanes />
          </FeatureCard>
          <FeatureCard title="Access requests" text="Ask the owners for one file. They approve it for a set time.">
            <div className="space-y-2">
              <AccessRequestCard className="w-full" />
              <ExpiryChoices />
            </div>
          </FeatureCard>
          <FeatureCard title="Audit trail" text="Who did what, and when, for every file." delay={0.05}>
            <div className="rounded-lg border border-line bg-white px-3">
              <AuditTicker visible={6} compact />
            </div>
          </FeatureCard>
          <FeatureCard title="Admin control" text="Divisions, fields and their rules from one Settings page." delay={0.1}>
            <AdminToggles />
          </FeatureCard>
        </div>
      </div>
    </section>
  );
}

const PIPELINE_ICONS = [FileUp, ScanText, Database, ScanSearch, UserCheck];

/** A connector line with a dot travelling along it. Solid colours only. */
function Beam({ vertical = false, delay = 0 }) {
  const reduced = useReducedMotion();
  return (
    <div className={cn("relative bg-primary/25", vertical ? "mx-auto h-8 w-px" : "h-px min-w-6 flex-1")} aria-hidden="true">
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

function PipelineNode({ node, number, Icon }) {
  return (
    <div className="card w-full p-5 lg:w-48 lg:shrink-0">
      <div className="flex items-center justify-between">
        <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <span className="flex size-7 items-center justify-center rounded-full border border-line text-xs font-bold text-primary">
          {number}
        </span>
      </div>
      <h3 className="mt-4 font-bold tracking-[-0.02em]">{node.title}</h3>
      <p className="mt-1 text-sm leading-5 text-muted">{node.detail}</p>
    </div>
  );
}

/** Upload, OCR, storage, index and the authorised reader, joined by moving beams. */
export function Pipeline() {
  return (
    <section aria-labelledby="pipeline-title" className="pb-24 sm:pb-28">
      <div className={container}>
        <SectionIntro eyebrow="Pipeline" titleId="pipeline-title" title="What happens to a file after upload." />
        <Reveal>
          <ol className="flex flex-col items-stretch lg:flex-row">
            {PIPELINE.map((node, index) => (
              <li key={node.title} className="contents">
                <PipelineNode node={node} number={index + 1} Icon={PIPELINE_ICONS[index]} />
                {index < PIPELINE.length - 1 && (
                  <>
                    <div className="hidden flex-1 items-center lg:flex">
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

const STEP_VISUALS = [UploadDemo, ScanStep, RequestDemo, ApproveDownloadDemo];
const STEP_MS = 6000;

/** Step 2 visual: the scanned page with its search box underneath. */
function ScanStep() {
  return (
    <div className="w-full space-y-3">
      <div className="rounded-xl border border-line bg-white p-5">
        <ScanDocument />
      </div>
      <SearchRow />
    </div>
  );
}

/**
 * Four steps on the left, the live visual for the chosen one on the right. The steps move on by
 * themselves until someone picks one, and stay put with reduced motion.
 */
export function HowItWorks() {
  const reduced = useReducedMotion();
  const [active, setActive] = useState(0);
  const [chosen, setChosen] = useState(false);
  const Visual = STEP_VISUALS[active];

  useEffect(() => {
    if (reduced || chosen) {
      return undefined;
    }
    const timer = setTimeout(() => setActive((current) => (current + 1) % STEPS.length), STEP_MS);
    return () => clearTimeout(timer);
  }, [active, reduced, chosen]);

  const choose = (index) => {
    setActive(index);
    setChosen(true);
  };

  return (
    <section id="how-it-works" className="scroll-mt-28 pb-24 sm:pb-28">
      <div className={container}>
        <SectionIntro eyebrow="How it works" title="From upload to an approved download." />
        <div className="grid gap-6 lg:grid-cols-12 lg:gap-8">
          <ol className="space-y-2 lg:col-span-5">
            {STEPS.map((step, index) => (
              <li key={step.title}>
                <button
                  type="button"
                  onClick={() => choose(index)}
                  aria-current={active === index ? "step" : undefined}
                  className={cn(
                    "flex w-full cursor-pointer gap-4 rounded-2xl border px-5 py-4 text-left transition-colors duration-200",
                    active === index ? "border-line bg-white shadow-soft" : "border-transparent hover:bg-white/60",
                  )}
                >
                  <span className="w-5 shrink-0 text-lg leading-7 font-bold text-primary">{index + 1}</span>
                  <span>
                    <span className="block text-lg leading-7 font-bold tracking-[-0.02em]">{step.title}</span>
                    <span className={active === index ? "mt-1 block text-sm leading-6 text-muted" : "sr-only"}>{step.text}</span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
          <div className="card flex p-4 sm:p-6 lg:col-span-7">
            <div className="flex flex-1 items-center rounded-xl bg-lavender p-5 sm:p-8">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={active}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.3 }}
                  className="mx-auto w-full max-w-lg"
                >
                  <Visual />
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
