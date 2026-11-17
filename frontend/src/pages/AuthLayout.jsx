import { ArrowLeft, ListChecks, Lock, ScanText } from "lucide-react";
import { Link } from "react-router-dom";
import IsoVault from "@/components/landing/IsoVault";
import Logo from "@/components/Logo";
import { Reveal } from "@/components/motion";

const POINTS = [
  { Icon: Lock, text: "Files stay in their division until the owners approve a request." },
  { Icon: ScanText, text: "Scanned pages can be searched by the words on them." },
  { Icon: ListChecks, text: "Every upload, download and decision is logged." },
];

/** Split screen for sign in and sign up: a plum panel with the promise on the left, the form on the right. */
export default function AuthLayout({ children }) {
  return (
    <div className="flex min-h-dvh bg-lavender">
      <section aria-label="About Triad DMS" className="m-3 hidden w-[44%] flex-col rounded-[24px] bg-plum p-10 text-white lg:flex xl:p-12">
        <Link to="/" aria-label="Triad DMS home" className="self-start">
          <Logo />
        </Link>

        <div className="mt-14">
          <p className="max-w-md text-[2.5rem] leading-[1.1] font-bold tracking-[-0.03em] text-balance xl:text-5xl">
            Files stay with your division until you say yes.
          </p>
          <ul className="mt-10 space-y-5">
            {POINTS.map(({ Icon, text }) => (
              <li key={text} className="flex items-center gap-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white/10">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <span className="text-[15px] leading-6 text-white/75">{text}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-auto flex justify-center pt-10">
          <IsoVault onDark className="h-auto w-full max-w-[340px]" />
        </div>
      </section>

      <section className="flex flex-1 flex-col items-center justify-center px-4 py-10 sm:px-6">
        <div className="mb-6 flex w-full max-w-[440px] items-center justify-between">
          <Link to="/" className="lg:hidden" aria-label="Triad DMS home">
            <Logo bare />
          </Link>
          <Link to="/" className="ml-auto inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-ink">
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to home
          </Link>
        </div>
        <Reveal className="card w-full max-w-[440px] p-7 sm:p-9" y={12}>
          {children}
        </Reveal>
      </section>
    </div>
  );
}
