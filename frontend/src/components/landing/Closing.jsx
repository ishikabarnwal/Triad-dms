import { Gauge, ListChecks, Lock, ScanLine, Timer, Undo2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import usePublicConfig from "@/hooks/usePublicConfig";
import { fileTypeLabels } from "@/lib/limits";
import { Reveal } from "../motion";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../ui/accordion";
import { Button, ButtonArrow } from "../ui/button";
import { FAQS, SECURITY_FACTS } from "./content";
import { AuditTicker } from "./LiveDemos";
import { container, SectionIntro } from "./shared";

const FACT_ICONS = { lock: Lock, timer: Timer, undo: Undo2, gauge: Gauge, list: ListChecks, scan: ScanLine };

/** The page's one dark block: security facts beside a live audit log. */
export function Security() {
  return (
    <section id="security" className="scroll-mt-28 pb-24 sm:pb-28">
      <div className="mx-auto w-full max-w-[1280px] px-3 sm:px-4">
        <div className="card-dark rounded-[24px] px-6 py-16 sm:px-12 sm:py-20">
          <div className="mx-auto max-w-[1100px]">
            <SectionIntro
              dark
              eyebrow="Security"
              title="Locked by default, opened on purpose."
              lead="The division that owns a file decides who reads it, never whoever happens to find it."
            />
            <div className="grid gap-8 lg:grid-cols-12">
              <ul className="grid gap-x-8 gap-y-7 sm:grid-cols-2 lg:col-span-7">
                {SECURITY_FACTS.map((fact, index) => {
                  const Icon = FACT_ICONS[fact.icon];
                  return (
                    <Reveal as="li" key={fact.title} delay={index * 0.04} className="flex gap-4">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white">
                        <Icon className="size-5" aria-hidden="true" />
                      </span>
                      <div>
                        <h3 className="font-semibold text-white">{fact.title}</h3>
                        <p className="mt-1 text-sm leading-6 text-white/65">{fact.text}</p>
                      </div>
                    </Reveal>
                  );
                })}
              </ul>
              <Reveal className="lg:col-span-5" delay={0.1}>
                <div className="h-full rounded-2xl border border-white/10 bg-white/5 p-5">
                  <div className="mb-2 flex items-center justify-between border-b border-white/10 pb-3">
                    <h3 className="font-semibold text-white">Audit log</h3>
                    <span className="flex items-center gap-2 text-xs text-white/65">
                      <span className="size-2 animate-pulse-soft rounded-full bg-primary" aria-hidden="true" />
                      Live
                    </span>
                  </div>
                  <AuditTicker visible={8} dark intervalMs={1800} />
                </div>
              </Reveal>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/** "10 per minute" -> [10, "per minute"], so the label follows whatever the server is set to. */
function splitRate(rate) {
  const match = /^(\d+)\s*(.*)$/.exec(rate);
  return match ? [Number(match[1]), match[2]] : [0, rate];
}

/** Limits read from the running API. The hero shows the upload limits; these are the access rules. */
export function Numbers() {
  const config = usePublicConfig();
  const [attempts, period] = splitRate(config.login_rate_limit);
  const numbers = [
    { value: config.access_expiry_days.max, suffix: " days", label: "Longest access grant", detail: "Or until the owners revoke it." },
    { value: Math.round(config.session_minutes / 60), suffix: " hours", label: "Session length", detail: "Then people sign in again." },
    { value: attempts, label: `Sign in attempts ${period}`, detail: "From one address, then it slows down." },
    { value: config.ocr.page_timeout_seconds, suffix: " s", label: "OCR time per page", detail: "A huge scan can't stall the server." },
  ];
  return (
    <section aria-labelledby="numbers-title" className="pb-24 sm:pb-28">
      <div className={container}>
        <SectionIntro eyebrow="Limits" titleId="numbers-title" title="The rules, read from the running system." />
        <Reveal className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line lg:grid-cols-4">
          {numbers.map((number) => (
            <div key={number.label} className="bg-white p-5 sm:p-8">
              <p className="text-[1.625rem] leading-none font-bold tracking-[-0.03em] whitespace-nowrap tabular-nums sm:text-[2.5rem]">
                {number.value}
                {number.suffix}
              </p>
              <p className="mt-3 font-semibold">{number.label}</p>
              <p className="mt-1 text-sm leading-6 text-muted">{number.detail}</p>
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  );
}

/** "PDF, PNG and JPG" from a list of type labels. */
function listInWords(items) {
  return items.length > 1 ? `${items.slice(0, -1).join(", ")} and ${items.at(-1)}` : items.join("");
}

export function Faq() {
  const config = usePublicConfig();
  const facts = { formats: listInWords(fileTypeLabels(config.file_types)), maxUploadMb: config.max_upload_mb };
  return (
    <section id="faq" className="scroll-mt-28 pb-24 sm:pb-28">
      <div className="mx-auto w-full max-w-3xl px-5 sm:px-6">
        <SectionIntro center eyebrow="FAQ" title="Questions people ask first." />
        <Reveal className="card px-6 sm:px-8">
          <Accordion type="single" collapsible defaultValue="0">
            {FAQS.map((item, index) => (
              <AccordionItem key={item.question} value={String(index)}>
                <AccordionTrigger>{item.question}</AccordionTrigger>
                <AccordionContent>{typeof item.answer === "function" ? item.answer(facts) : item.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Reveal>
      </div>
    </section>
  );
}

/** Final call to action. Light, because the security block is the page's one dark section. */
export function CallToAction() {
  const { user } = useAuth();
  return (
    <section aria-labelledby="cta-title" className="pb-24">
      <div className={container}>
        <Reveal className="card px-6 py-16 text-center sm:py-20">
          <p className="text-sm font-semibold text-primary">Get started</p>
          <h2 id="cta-title" className="mx-auto mt-3 max-w-[720px] text-[2rem] leading-[1.15] font-bold tracking-[-0.03em] text-balance sm:text-5xl sm:leading-[1.1]">
            Ready to file your first document?
          </h2>
          <p className="mx-auto mt-4 max-w-md text-lg leading-[1.6] text-muted">
            Create an account, choose your division and upload a PDF or a scan.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link to={user ? "/dashboard" : "/signup"}>
                {user ? "Open dashboard" : "Create an account"} <ButtonArrow />
              </Link>
            </Button>
            {!user && (
              <Button asChild size="lg" variant="outline">
                <Link to="/login">Sign in</Link>
              </Button>
            )}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
