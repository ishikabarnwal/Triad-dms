import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import Frame from "@/components/dossier/Frame";
import { Button, ButtonArrow } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import usePublicConfig from "@/hooks/usePublicConfig";
import { fileTypeLabels } from "@/lib/limits";
import { HERO } from "./content";
import RedactedSheet from "./RedactedSheet";

const EASE = [0.22, 1, 0.36, 1];

/** Entrance for hero elements: rise 24px and fade, in reading order, all within 400ms of each other. */
function rise(step) {
  return {
    initial: { opacity: 0, y: 24 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.6, ease: EASE, delay: Math.min(step * 0.08, 0.4) },
  };
}

/** The three limits a visitor checks first, read live from the API. */
function ProofPlate() {
  const config = usePublicConfig();
  const rows = [
    ["Formats", fileTypeLabels(config.file_types).join(" ")],
    ["Largest file", `${config.max_upload_mb} MB`],
    ["OCR per upload", `${config.ocr.max_pages} scanned pages`],
  ];

  return (
    <dl className="grid border-t border-ink sm:grid-cols-4">
      {rows.map(([label, value]) => (
        <div
          key={label}
          className="flex items-baseline justify-between gap-4 border-b border-rule py-3 first:sm:col-span-2 sm:block sm:border-b-0 sm:py-4 sm:pr-4"
        >
          <dt className="label-mono text-muted">{label}</dt>
          <dd className="data-mono text-right sm:mt-1 sm:text-left">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Hero: the promise on the left, the redacted report proving it on the right. */
export default function Hero() {
  const { user } = useAuth();

  return (
    <Frame id="top" aria-labelledby="hero-title">
      <div className="grid gap-12 py-12 md:py-16 lg:grid-cols-12 lg:gap-6">
        <div className="flex flex-col lg:col-span-7 lg:pr-12">
          <motion.p {...rise(0)} className="label-mono text-muted">
            {HERO.label}
          </motion.p>

          <motion.h1 {...rise(1)} id="hero-title" className="display-xl mt-6">
            {HERO.headline[0]} <br className="hidden md:block" />
            {HERO.headline[1]}
          </motion.h1>

          <motion.p {...rise(2)} className="body-lead mt-6 text-muted">
            {HERO.subheadline}
          </motion.p>

          <motion.div {...rise(3)} className="mt-8 flex flex-wrap items-center gap-3">
            {user ? (
              <Button asChild>
                <Link to="/dashboard">
                  Open the hub <ButtonArrow />
                </Link>
              </Button>
            ) : (
              <>
                <Button asChild>
                  <Link to="/signup">
                    Create an account <ButtonArrow />
                  </Link>
                </Button>
                <Button asChild variant="ghost">
                  <Link to="/login">Sign in</Link>
                </Button>
              </>
            )}
          </motion.div>

          <motion.div {...rise(4)} className="mt-12 lg:mt-16">
            <ProofPlate />
          </motion.div>
        </div>

        <motion.div {...rise(3)} className="lg:col-span-5">
          <RedactedSheet />
        </motion.div>
      </div>
    </Frame>
  );
}
