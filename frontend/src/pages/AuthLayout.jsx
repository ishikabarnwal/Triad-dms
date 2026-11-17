import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import Logo from "@/components/Logo";
import { Reveal } from "@/components/motion";
import ScrambleText from "@/components/ScrambleText";

const FEATURES = [
  ["01", "DIVISION.ISOLATION", "Files stay in their division unless the owner approves."],
  ["02", "OCR.SEARCH", "Scanned PDFs and images are searchable by their text."],
  ["03", "AUDIT.TRAIL", "Uploads, downloads and decisions are all logged."],
];

/** Split screen for login and signup: plum panel with a dot grid on the left, the form on the right. */
export default function AuthLayout({ children }) {
  return (
    <div className="flex min-h-dvh bg-lavender">
      <section className="dot-grid-dark m-3 hidden w-[44%] flex-col justify-between rounded-[28px] p-10 text-white lg:flex xl:p-12">
        <div className="flex items-center justify-between">
          <Link to="/" aria-label="Triad DMS home">
            <Logo tone="dark" />
          </Link>
          <span className="label-mono flex items-center gap-2 text-white/55">
            <span className="size-1.5 rounded-full bg-primary" /> SYS.ONLINE
          </span>
        </div>

        <div>
          <div className="label-mono mb-5 text-white/45">Triad DMS · Classified: Restricted</div>
          <h1 className="text-[clamp(2.75rem,4.4vw,4.5rem)] leading-[0.95] font-semibold tracking-[-0.04em]">
            Every document.
            <br />
            Right{" "}
            <ScrambleText text="division." className="text-primary" delay={250} />
          </h1>
          <ul className="mt-12 space-y-4">
            {FEATURES.map(([number, code, text]) => (
              <li key={code} className="flex gap-4 border-t border-white/10 pt-4">
                <span className="label-mono text-white/35">[ {number} ]</span>
                <div>
                  <div className="label-mono text-white/90">{code}</div>
                  <p className="mt-1 text-sm text-white/55">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="label-mono text-white/35">Authorised personnel only · All activity is recorded</div>
      </section>

      <section className="flex flex-1 flex-col items-center justify-center px-4 py-10 sm:px-6">
        <div className="mb-6 flex w-full max-w-[420px] items-center justify-between">
          <Link to="/" className="lg:hidden" aria-label="Triad DMS home">
            <Logo />
          </Link>
          <Link to="/" className="label-mono ml-auto inline-flex items-center gap-1.5 text-muted hover:text-ink">
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            Home
          </Link>
        </div>
        <Reveal className="card w-full max-w-[420px] p-7 sm:p-9" y={12}>
          {children}
        </Reveal>
      </section>
    </div>
  );
}
