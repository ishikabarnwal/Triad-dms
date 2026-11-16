import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { CalendarDays, FileStack, FileText, Hourglass, LayoutDashboard, ScanText, Search, ShieldCheck } from "lucide-react";
import { useRef } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import { Chip } from "../Chips";
import Logo from "../Logo";
import { Float } from "../motion";
import ScrambleText from "../ScrambleText";
import { Button, ButtonArrow } from "../ui/button";
import { AccessRequestCard, AuditTicker, OcrScanCard } from "./LiveDemos";
import { container } from "./shared";

const DEMO_STATS = [
  { code: "DOCS.TOTAL", value: "1,284", label: "Total documents", Icon: FileStack, dark: true },
  { code: "LAST.7D", value: "96", label: "This week", Icon: CalendarDays },
  { code: "REQ.PENDING", value: "7", label: "Pending requests", Icon: Hourglass },
  { code: "OCR.DONE", value: "1,201", label: "Text extracted", Icon: ScanText },
];

const DEMO_BARS = [
  ["Financial", 82],
  ["Operational", 64],
  ["Intelligence", 41],
  ["Technical", 57],
  ["Admin", 23],
];

const DEMO_ROWS = [
  ["Fleet Maintenance Report", "DIV-A", "Financial", "OCR.OK", "Owner"],
  ["Northern Movement Plan", "DIV-A", "Operational", "OCR.OK", "Owner"],
  ["Radar Upgrade Specs", "DIV-B", "Technical", "OCR.OK", "Locked"],
  ["Q3 Budget Allocation", "HQ", "Financial", "OCR.OK", "Approved"],
];

/** A static copy of the dashboard, assembled from the same pieces the real app uses. */
function DashboardMockup() {
  return (
    <div className="overflow-hidden rounded-[22px] border border-line bg-white shadow-pop">
      <div className="flex items-center gap-3 border-b border-line px-4 py-3">
        <div className="flex gap-1.5" aria-hidden="true">
          <span className="size-2.5 rounded-full bg-line" />
          <span className="size-2.5 rounded-full bg-line" />
          <span className="size-2.5 rounded-full bg-line" />
        </div>
        <div className="mx-auto rounded-full bg-lavender px-4 py-1 font-mono text-[10.5px] text-muted">triad-dms / dashboard</div>
      </div>
      <div className="flex">
        <div className="hidden w-44 shrink-0 flex-col gap-1 bg-plum p-3 text-white md:flex">
          <Logo size="sm" className="mb-4 self-start" />
          <div className="label-mono mb-1 px-2 text-white/35">Workspace</div>
          {[
            [LayoutDashboard, "Dashboard", true],
            [Search, "Search"],
            [ShieldCheck, "Access requests"],
          ].map(([Icon, label, active]) => (
            <div
              key={label}
              className={cn("flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs", active ? "bg-white/10" : "text-white/60")}
            >
              <Icon className="size-3.5" aria-hidden="true" /> {label}
            </div>
          ))}
        </div>
        <div className="min-w-0 flex-1 bg-lavender p-4 sm:p-5">
          <div className="label-mono text-muted">[ HUB ] DIV-A</div>
          <div className="mt-1 mb-4 text-xl font-semibold tracking-[-0.03em] sm:text-2xl">Document Hub</div>
          <div className="grid gap-3 lg:grid-cols-12">
            <div className="grid grid-cols-2 gap-3 lg:col-span-7">
              {DEMO_STATS.map(({ code, value, label, Icon, dark }) => (
                <div key={code} className={cn(dark ? "card-dark" : "card", "p-3")}>
                  <div className="flex items-center justify-between">
                    <span className={cn("font-mono text-[9px] tracking-wider", dark ? "text-white/50" : "text-muted")}>{code}</span>
                    <Icon className={cn("size-3", dark ? "text-white/60" : "text-primary")} aria-hidden="true" />
                  </div>
                  <div className={cn("mt-3 text-xl font-semibold tracking-[-0.04em]", dark && "text-white")}>{value}</div>
                  <div className={cn("text-[11px]", dark ? "text-white/60" : "text-muted")}>{label}</div>
                </div>
              ))}
            </div>
            <div className="card hidden p-3 sm:block lg:col-span-5">
              <div className="mb-3 font-mono text-[9px] tracking-wider text-muted">DOCUMENTS BY REPORT TYPE</div>
              {DEMO_BARS.map(([label, width]) => (
                <div key={label} className="mb-2 flex items-center gap-2 last:mb-0">
                  <span className="w-20 shrink-0 text-[10.5px]">{label}</span>
                  <span className="h-3 rounded-r-md bg-primary" style={{ width: `${width}%` }} />
                </div>
              ))}
            </div>
          </div>
          <div className="card mt-3 overflow-hidden">
            {DEMO_ROWS.map(([title, division, type, ocr, access]) => (
              <div key={title} className="flex items-center gap-3 border-b border-line/70 px-3 py-2.5 last:border-0">
                <FileText className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate text-xs font-medium">{title}</span>
                <span className="hidden sm:inline-flex">
                  <Chip tone="outline" mono>
                    {division}
                  </Chip>
                </span>
                <span className="hidden md:inline-flex">
                  <Chip tone="outline">{type}</Chip>
                </span>
                <span className="hidden lg:inline-flex">
                  <Chip tone="primary" mono>
                    {ocr}
                  </Chip>
                </span>
                <Chip tone={access === "Locked" ? "plum" : "primary"} mono>
                  {access}
                </Chip>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** The mockup starts tilted back and straightens as the page scrolls; live cards float on its edges. */
function TiltedProduct() {
  const reduced = useReducedMotion();
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "start 25%"] });
  const rotateX = useTransform(scrollYProgress, [0, 1], [24, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [0.92, 1]);

  return (
    <div ref={ref} className="relative mx-auto mt-16 max-w-5xl [perspective:1600px] sm:mt-20" aria-hidden="true">
      <motion.div style={reduced ? undefined : { rotateX, scale, transformOrigin: "50% 0%" }}>
        <DashboardMockup />
      </motion.div>
      <Float className="absolute top-[62%] -left-14 z-10 hidden xl:block" duration={7} distance={7}>
        <OcrScanCard />
      </Float>
      <Float className="absolute top-[8%] -right-12 z-10 hidden xl:block" duration={8} distance={9} delay={0.8}>
        <AccessRequestCard />
      </Float>
      <Float className="absolute -bottom-8 right-[12%] z-10 hidden md:block" duration={6.5} distance={6} delay={0.4}>
        <div className="card w-96 px-4 py-2">
          <div className="label-mono flex items-center justify-between border-b border-line py-1.5 text-muted">
            <span>audit.log</span>
            <span className="flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-primary" /> LIVE
            </span>
          </div>
          <AuditTicker visible={2} intervalMs={2200} />
        </div>
      </Float>
    </div>
  );
}

export default function Hero() {
  const { user } = useAuth();
  return (
    <section id="top" className="dot-grid relative pt-36 pb-28 sm:pt-44 sm:pb-36">
      <div className={container}>
        <div className="mx-auto max-w-4xl text-center">
          <span className="label-mono inline-flex items-center gap-2 rounded-full border border-line bg-white px-3.5 py-1.5 text-muted">
            <span className="size-1.5 animate-pulse-soft rounded-full bg-primary" />
            SYS.ONLINE — Secure document management
          </span>
          <h1 className="mt-8 text-[clamp(3rem,8.4vw,6rem)] leading-[0.92] font-semibold tracking-[-0.045em]">
            Every document.
            <br />
            Right division.
            <br />
            <ScrambleText text="Zero leaks." className="text-primary" delay={350} />
          </h1>
          <p className="mx-auto mt-7 max-w-xl text-lg text-muted">
            Store, search and share files between defence divisions. Every request is approved by the owner; every action
            is logged.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link to={user ? "/dashboard" : "/signup"}>
                {user ? "Open dashboard" : "Get started"} <ButtonArrow />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href="#how-it-works">See how it works</a>
            </Button>
          </div>
        </div>
        <TiltedProduct />
      </div>
    </section>
  );
}
