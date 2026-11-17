import { motion } from "framer-motion";
import { FileUp, ScanText, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import usePublicConfig from "@/hooks/usePublicConfig";
import { fileTypeLabels } from "@/lib/limits";
import { Float } from "../motion";
import { Button, ButtonArrow } from "../ui/button";
import IsoVault from "./IsoVault";
import { container } from "./shared";

const EASE = [0.22, 1, 0.36, 1];

/** Fade and rise on first load, one element after another. */
function enter(step) {
  return {
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.6, ease: EASE, delay: 0.08 * step },
  };
}

/** Three limits the API really enforces, read from GET /api/config/public. */
function Facts() {
  const config = usePublicConfig();
  const facts = [
    { value: `${config.max_upload_mb} MB`, label: "Largest upload" },
    { value: `${config.ocr.max_pages} pages`, label: "OCR per upload" },
    { value: `${config.file_types.length} formats`, label: fileTypeLabels(config.file_types).join(", ") },
  ];
  return (
    <dl className="grid grid-cols-3 divide-x divide-line border-t border-line pt-6">
      {facts.map(({ value, label }) => (
        // Reversed so the value reads first on screen while the term still comes first for screen readers.
        <div key={value} className="flex flex-col-reverse justify-end px-4 first:pl-0 last:pr-0">
          <dt className="mt-1 text-xs leading-5 text-muted sm:text-sm">{label}</dt>
          <dd className="text-xl font-bold tracking-[-0.03em] sm:text-2xl">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A small white card showing a real state from the app. Decorative, so screen readers skip it. */
function StatusCard({ Icon, title, detail }) {
  return (
    <div aria-hidden="true" className="flex items-center gap-3 rounded-2xl border border-line bg-white py-2.5 pr-5 pl-2.5 shadow-lift">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-lavender text-primary">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <div>
        <p className="text-sm leading-5 font-semibold">{title}</p>
        <p className="text-xs leading-4 text-muted">{detail}</p>
      </div>
    </div>
  );
}

const CARDS = [
  { Icon: FileUp, title: "Upload filed", detail: "to DIV-A", position: "top-[10%] left-0", duration: 7, delay: 0 },
  { Icon: ScanText, title: "OCR complete", detail: "4 pages", position: "top-[2%] right-[4%]", duration: 8, delay: 0.6 },
  { Icon: ShieldCheck, title: "Access approved", detail: "DIV-B, 7 days", position: "right-[2%] bottom-[8%]", duration: 7.5, delay: 1.2 },
];

/** The isometric vault with three floating app states around it. The illustration itself stays still. */
function Illustration() {
  return (
    <div className="relative mx-auto w-full max-w-[560px]">
      <IsoVault className="block h-auto w-full" />
      {CARDS.map(({ Icon, title, detail, position, duration, delay }) => (
        <Float key={title} className={`absolute hidden sm:block ${position}`} duration={duration} distance={6} delay={delay}>
          <StatusCard Icon={Icon} title={title} detail={detail} />
        </Float>
      ))}
    </div>
  );
}

export default function Hero() {
  const { user } = useAuth();
  return (
    <section id="top" className="relative pt-28 pb-16 sm:pt-32 lg:pt-36 lg:pb-20">
      <div className={`${container} grid items-center gap-14 lg:grid-cols-12 lg:gap-8`}>
        <div className="lg:col-span-6">
          <motion.h1
            {...enter(0)}
            className="text-[2.5rem] leading-[1.08] font-bold tracking-[-0.03em] sm:text-5xl lg:text-[3.5rem] xl:text-[4rem]"
          >
            Files stay with
            <br />
            your division
            <br />
            until you say yes.
          </motion.h1>
          <motion.p {...enter(1)} className="mt-6 max-w-[520px] text-lg leading-[1.6] text-pretty text-muted">
            Upload scans, search them by their text, and approve requests from other divisions.
          </motion.p>
          <motion.div {...enter(2)} className="mt-9 flex flex-wrap items-center gap-x-7 gap-y-4">
            <Button asChild size="lg">
              <Link to={user ? "/dashboard" : "/signup"}>
                {user ? "Open dashboard" : "Create an account"} <ButtonArrow />
              </Link>
            </Button>
            {!user && (
              <Link to="/login" className="text-base font-semibold text-ink transition-colors hover:text-primary">
                Sign in
              </Link>
            )}
          </motion.div>
          <motion.div {...enter(3)} className="mt-12 max-w-lg">
            <Facts />
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, ease: EASE, delay: 0.2 }}
          className="lg:col-span-6"
        >
          <Illustration />
        </motion.div>
      </div>
    </section>
  );
}
