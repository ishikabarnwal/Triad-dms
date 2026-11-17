import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import Logo from "../Logo";
import { CountUp, Reveal } from "../motion";
import ScrambleText from "../ScrambleText";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../ui/accordion";
import { Button, ButtonArrow } from "../ui/button";
import { FAQS, NAV_SECTIONS, NUMBERS, SECURITY_FACTS } from "./content";
import { AuditTicker } from "./LiveDemos";
import { container, SectionIntro, SectionLabel } from "./shared";

/** Full-width plum block: security facts in mono, plus a terminal-style audit feed. */
export function Security() {
  return (
    <section id="security" className="scroll-mt-28 pb-28 sm:pb-36">
      <div className="mx-auto w-full max-w-[1280px] px-3 sm:px-4">
        <div className="card-dark rounded-[32px] px-6 py-16 sm:px-12 sm:py-20">
          <div className="mx-auto max-w-[1100px]">
            <SectionIntro
              dark
              number="05"
              label="SECURITY"
              title="Locked down by default. Opened on purpose."
              lead="Access is decided by the division that owns a file, never by whoever happens to find it."
            />
            <div className="grid gap-10 lg:grid-cols-12">
              <ul className="grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-2 lg:col-span-7">
                {SECURITY_FACTS.map((fact, index) => (
                  <Reveal as="li" key={fact.code} delay={index * 0.05} className="bg-plum p-5">
                    <div className="label-mono text-white/40">{fact.code}</div>
                    <div className="mt-2 font-medium text-white">{fact.title}</div>
                    <p className="mt-1 text-sm text-white/55">{fact.text}</p>
                  </Reveal>
                ))}
              </ul>
              <Reveal className="lg:col-span-5" delay={0.1}>
                <div className="h-full rounded-2xl border border-white/10 bg-plum-hover p-5">
                  <div className="mb-3 flex items-center justify-between border-b border-white/10 pb-3 font-mono text-xs">
                    <span className="text-white/80">$ tail -f audit.log</span>
                    <span className="label-mono flex items-center gap-1.5 text-white/50">
                      <span className="size-1.5 animate-pulse-soft rounded-full bg-primary" /> LIVE
                    </span>
                  </div>
                  <AuditTicker visible={7} dark intervalMs={1800} />
                </div>
              </Reveal>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Real system limits, counting up as they scroll into view. */
export function Numbers() {
  return (
    <section aria-label="System limits" className="pb-28 sm:pb-36">
      <div className={container}>
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[24px] border border-line bg-line lg:grid-cols-4">
          {NUMBERS.map((number, index) => (
            <Reveal key={number.label} delay={index * 0.06} className="bg-white p-6 sm:p-8">
              <CountUp
                value={number.value}
                suffix={number.suffix || ""}
                className="block text-[clamp(2.5rem,5vw,4rem)] leading-none font-semibold tracking-[-0.05em]"
              />
              <div className="mt-3 font-medium">{number.label}</div>
              <div className="label-mono mt-1 text-muted">{number.detail}</div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Faq() {
  return (
    <section id="faq" className="scroll-mt-28 pb-28 sm:pb-36">
      <div className="mx-auto w-full max-w-3xl px-5 sm:px-6">
        <SectionIntro number="06" label="FAQ" title="Questions people actually ask." center />
        <Reveal className="card px-6 sm:px-8">
          <Accordion type="single" collapsible defaultValue="0">
            {FAQS.map((item, index) => (
              <AccordionItem key={item.question} value={String(index)}>
                <AccordionTrigger>{item.question}</AccordionTrigger>
                <AccordionContent>{item.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Reveal>
      </div>
    </section>
  );
}

export function CallToAction() {
  const { user } = useAuth();
  return (
    <section aria-labelledby="cta-title" className="pb-20">
      <div className="mx-auto w-full max-w-[1280px] px-3 sm:px-4">
        <Reveal className="card-dark rounded-[32px] px-6 py-20 text-center sm:py-28">
          <SectionLabel number="07" text="GET STARTED" dark className="justify-center" />
          <h2 id="cta-title" className="mx-auto mt-6 max-w-4xl text-[clamp(2.75rem,7vw,5.5rem)] leading-[0.95] font-semibold tracking-[-0.045em] text-white">
            Put every file in the{" "}
            <ScrambleText text="right hands." onView className="text-primary" />
          </h2>
          <p className="mx-auto mt-6 max-w-md text-white/60">Create an account in your division and upload your first document in under a minute.</p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link to={user ? "/dashboard" : "/signup"}>
                {user ? "Open dashboard" : "Create your account"} <ButtonArrow />
              </Link>
            </Button>
            {!user && (
              <Button asChild size="lg" variant="ghostDark">
                <Link to="/login">Sign in</Link>
              </Button>
            )}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

const FOOTER_COLUMNS = [
  { title: "Product", links: NAV_SECTIONS.slice(0, 3).map((section) => ({ label: section.label, href: `#${section.id}` })) },
  {
    title: "Resources",
    links: [
      { label: "FAQ", href: "#faq" },
      { label: "Sign in", to: "/login" },
      { label: "Create account", to: "/signup" },
    ],
  },
  { title: "Company", links: [{ label: "triad-ai.com", href: "https://triad-ai.com", external: true }] },
];

export function Footer() {
  return (
    <footer className="border-t border-line bg-white">
      <div className={`${container} py-14`}>
        <div className="grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <Logo bare />
            <p className="mt-4 max-w-xs text-sm text-muted">Secure document management for defence divisions.</p>
            <address className="label-mono mt-6 leading-relaxed text-muted not-italic">
              Plot No. 76, Survey No. 252, Malkapoor Village,
              <br />
              Chevella Mandal, Telangana – 501503
            </address>
          </div>
          {FOOTER_COLUMNS.map((column) => (
            <div key={column.title} className="lg:col-span-2">
              <h3 className="label-mono mb-4 text-muted">{column.title}</h3>
              <ul className="space-y-2.5 text-sm">
                {column.links.map((link) => (
                  <li key={link.label}>
                    {link.to ? (
                      <Link to={link.to} className="hover:text-primary">
                        {link.label}
                      </Link>
                    ) : (
                      <a
                        href={link.href}
                        className="hover:text-primary"
                        {...(link.external ? { target: "_blank", rel: "noreferrer" } : {})}
                      >
                        {link.label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="label-mono mt-14 flex flex-wrap justify-between gap-3 border-t border-line pt-6 text-muted">
          <span>© 2026 Triad AI Pvt. Ltd.</span>
          <span>Authorised personnel only · All activity is recorded</span>
        </div>
      </div>
    </footer>
  );
}
