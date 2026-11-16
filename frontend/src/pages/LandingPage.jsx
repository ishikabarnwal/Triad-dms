import { useReducedMotion } from "framer-motion";
import Lenis from "lenis";
import { ArrowRight, Check } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
import { Accordion, Col, Row } from "react-bootstrap";
import CountUp from "react-countup";
import { Link } from "react-router-dom";
import AuditFeed from "../components/landing/AuditFeed";
import { FAQS, FEATURES, NUMBERS, SECURITY_POINTS, STEPS } from "../components/landing/content";
import HeroVisual from "../components/landing/HeroVisual";
import LandingNav, { SECTIONS } from "../components/landing/LandingNav";
import Logo from "../components/Logo";
import { LiftCard, Reveal } from "../components/motion";
import { useAuth } from "../context/AuthContext";

const NAV_OFFSET = -96;

/** Smooth scrolling for this page only. Off when the user prefers reduced motion. */
function useSmoothScroll(reduced) {
  const lenisRef = useRef(null);

  useEffect(() => {
    if (reduced) {
      return undefined;
    }
    const lenis = new Lenis({ duration: 1.1 });
    lenisRef.current = lenis;
    let frame = requestAnimationFrame(function loop(time) {
      lenis.raf(time);
      frame = requestAnimationFrame(loop);
    });
    return () => {
      cancelAnimationFrame(frame);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, [reduced]);

  return useCallback(
    (id) => {
      const target = id === "top" ? 0 : document.getElementById(id);
      if (target === null) {
        return;
      }
      if (lenisRef.current) {
        lenisRef.current.scrollTo(target, { offset: id === "top" ? 0 : NAV_OFFSET });
      } else if (id === "top") {
        window.scrollTo(0, 0);
      } else {
        target.scrollIntoView();
      }
    },
    [],
  );
}

function SectionHeading({ label, title, lead, center = false, id }) {
  return (
    <Reveal className={`mb-5 ${center ? "text-center mx-auto" : ""}`} style={{ maxWidth: center ? 760 : undefined }}>
      <span className="section-label mb-3">{label}</span>
      <h2 className="landing-heading mt-3 mb-3" id={id}>
        {title}
      </h2>
      {lead && <p className={`landing-lead mb-0 ${center ? "mx-auto" : ""}`}>{lead}</p>}
    </Reveal>
  );
}

function Hero({ onNavigate }) {
  const { user } = useAuth();
  return (
    <section className="hero" id="top">
      <div className="landing-container">
        <Row className="align-items-center g-5">
          <Col lg={6}>
            <Reveal>
              <span className="section-label">Secure document management</span>
              <h1 className="display-tight mt-4 mb-4">
                Every document.
                <br />
                Right division.
                <br />
                <span className="text-primary">No leaks.</span>
              </h1>
              <p className="landing-lead mb-4">
                Store, search and share files between defence divisions, with every request approved by the owner and
                every action logged.
              </p>
              <div className="d-flex flex-wrap gap-2 mb-4">
                <Link to={user ? "/dashboard" : "/signup"} className="btn btn-primary btn-lg">
                  {user ? "Open dashboard" : "Get started"}
                  <ArrowRight size={18} className="btn-arrow" aria-hidden="true" />
                </Link>
                <button type="button" className="btn btn-light btn-lg" onClick={() => onNavigate("how-it-works")}>
                  See how it works
                </button>
              </div>
              <div className="d-flex flex-wrap gap-3">
                {["Division isolation", "OCR search", "Full audit trail"].map((item) => (
                  <span className="check-item" key={item}>
                    <span className="check-dot">
                      <Check size={13} strokeWidth={3} aria-hidden="true" />
                    </span>
                    {item}
                  </span>
                ))}
              </div>
            </Reveal>
          </Col>
          <Col lg={6}>
            <Reveal delay={0.15}>
              <HeroVisual />
            </Reveal>
          </Col>
        </Row>
      </div>
    </section>
  );
}

function Features() {
  return (
    <section className="landing-section" id="features" aria-labelledby="features-title">
      <div className="landing-container">
        <SectionHeading
          id="features-title"
          label="Features"
          title="Built around who is allowed to see what."
          lead="Six parts that work together, from the upload form to the audit log."
        />
        <Row className="g-4">
          {FEATURES.map(({ Icon, title, text, stat, dark }, index) => (
            <Col md={6} lg={4} key={title}>
              <Reveal delay={(index % 3) * 0.08} className="h-100">
                <LiftCard className={`${dark ? "surface-dark" : "surface"} feature-card`}>
                  <span className={`icon-tile ${dark ? "on-dark" : ""}`}>
                    <Icon size={22} aria-hidden="true" />
                  </span>
                  <h3 className="heading-tight">{title}</h3>
                  <p>{text}</p>
                  <span className={`pill feature-stat ${dark ? "pill-on-dark" : "pill-primary"}`}>{stat}</span>
                </LiftCard>
              </Reveal>
            </Col>
          ))}
        </Row>
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section className="landing-section pt-0" id="how-it-works" aria-labelledby="how-title">
      <div className="landing-container">
        <SectionHeading
          id="how-title"
          label="How it works"
          title="From upload to approved download in four steps."
          center
        />
        <div className="steps">
          <div className="steps-line" aria-hidden="true" />
          <Row className="g-4" as="ol" style={{ listStyle: "none", paddingLeft: 0 }}>
            {STEPS.map((step, index) => (
              <Col md={6} lg={3} as="li" key={step.title}>
                <Reveal delay={index * 0.1} className="h-100">
                  <div className="surface step-card text-center">
                    <span className="step-number" aria-hidden="true">
                      {index + 1}
                    </span>
                    <h3 className="heading-tight">
                      <span className="visually-hidden">Step {index + 1}: </span>
                      {step.title}
                    </h3>
                    <p>{step.text}</p>
                  </div>
                </Reveal>
              </Col>
            ))}
          </Row>
        </div>
      </div>
    </section>
  );
}

function Security() {
  return (
    <section className="landing-section pt-0" id="security" aria-labelledby="security-title">
      <div className="landing-container">
        <Row className="g-5 align-items-center">
          <Col lg={6}>
            <SectionHeading
              id="security-title"
              label="Security"
              title="Locked down by default. Opened on purpose."
              lead="Access is decided by the division that owns the file, never by whoever finds it."
            />
            <Reveal delay={0.1}>
              <ul className="list-unstyled d-grid gap-3 mb-0">
                {SECURITY_POINTS.map((point) => (
                  <li className="d-flex gap-3" key={point.title}>
                    <span className="check-item">
                      <span className="check-dot">
                        <Check size={13} strokeWidth={3} aria-hidden="true" />
                      </span>
                    </span>
                    <div>
                      <div className="fw-semibold">{point.title}</div>
                      <div className="text-muted-soft">{point.text}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </Reveal>
          </Col>
          <Col lg={6}>
            <Reveal delay={0.15}>
              <AuditFeed />
            </Reveal>
          </Col>
        </Row>
      </div>
    </section>
  );
}

function Numbers() {
  const reduced = useReducedMotion();
  return (
    <section className="pb-5" aria-label="System limits">
      <div className="landing-container">
        <div className="surface p-4 p-lg-5">
          <Row className="g-4">
            {NUMBERS.map((number, index) => (
              <Col xs={6} lg={3} key={number.label}>
                <Reveal delay={index * 0.08}>
                  <div className="number-value">
                    <CountUp end={number.value} suffix={number.suffix || ""} duration={reduced ? 0 : 1.6} enableScrollSpy scrollSpyOnce />
                  </div>
                  <div className="fw-semibold mt-2">{number.label}</div>
                  <div className="small text-muted-soft">{number.detail}</div>
                </Reveal>
              </Col>
            ))}
          </Row>
        </div>
      </div>
    </section>
  );
}

function Faq() {
  return (
    <section className="landing-section" id="faq" aria-labelledby="faq-title">
      <div className="landing-container" style={{ maxWidth: 860 }}>
        <SectionHeading id="faq-title" label="FAQ" title="Questions people actually ask." center />
        <Reveal>
          <Accordion className="faq" defaultActiveKey="0">
            {FAQS.map((item, index) => (
              <Accordion.Item eventKey={String(index)} key={item.question}>
                <Accordion.Header as="h3">{item.question}</Accordion.Header>
                <Accordion.Body>{item.answer}</Accordion.Body>
              </Accordion.Item>
            ))}
          </Accordion>
        </Reveal>
      </div>
    </section>
  );
}

function CallToAction() {
  const { user } = useAuth();
  return (
    <section aria-labelledby="cta-title">
      <div className="landing-container">
        <Reveal className="cta-band text-center">
          <h2 className="display-tight mb-3" id="cta-title">
            Put every file in the right hands.
          </h2>
          <p className="mb-4 mx-auto" style={{ maxWidth: 520, color: "rgba(255,255,255,0.72)" }}>
            Create an account in your division and upload your first document in under a minute.
          </p>
          <div className="d-flex flex-wrap justify-content-center gap-2">
            <Link to={user ? "/dashboard" : "/signup"} className="btn btn-primary btn-lg">
              {user ? "Open dashboard" : "Create your account"}
              <ArrowRight size={18} className="btn-arrow" aria-hidden="true" />
            </Link>
            {!user && (
              <Link to="/login" className="btn btn-on-dark btn-lg">
                Sign in
              </Link>
            )}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Footer({ onNavigate }) {
  return (
    <footer className="landing-footer">
      <div className="landing-container">
        <Row className="g-4">
          <Col lg={5}>
            <Logo />
            <p className="mt-3 mb-0" style={{ maxWidth: 340 }}>
              Secure document management for defence divisions.
            </p>
          </Col>
          <Col xs={6} md={4} lg={2}>
            <h3>Product</h3>
            <ul className="list-unstyled mb-0">
              {SECTIONS.slice(0, 3).map((section) => (
                <li key={section.id}>
                  <button type="button" className="link" onClick={() => onNavigate(section.id)}>
                    {section.label}
                  </button>
                </li>
              ))}
            </ul>
          </Col>
          <Col xs={6} md={4} lg={2}>
            <h3>Resources</h3>
            <ul className="list-unstyled mb-0">
              <li>
                <button type="button" className="link" onClick={() => onNavigate("faq")}>
                  FAQ
                </button>
              </li>
              <li>
                <Link to="/login">Sign in</Link>
              </li>
              <li>
                <Link to="/signup">Create account</Link>
              </li>
            </ul>
          </Col>
          <Col md={4} lg={3}>
            <h3>Company</h3>
            <p className="mb-1 text-white">Triad AI Pvt. Ltd.</p>
            <address className="mb-0">Hyderabad, Telangana, India</address>
          </Col>
        </Row>
        <div className="footer-bottom d-flex flex-wrap justify-content-between gap-2">
          <span>© 2026 Triad AI Pvt. Ltd.</span>
          <span>Authorised personnel only. All activity is recorded.</span>
        </div>
      </div>
    </footer>
  );
}

export default function LandingPage() {
  const reduced = useReducedMotion();
  const scrollTo = useSmoothScroll(reduced);

  return (
    <div className="landing">
      <a href="#features" className="visually-hidden-focusable btn btn-primary position-absolute m-2" style={{ zIndex: 2000 }}>
        Skip to content
      </a>
      <LandingNav onNavigate={scrollTo} />
      <main>
        <Hero onNavigate={scrollTo} />
        <Features />
        <HowItWorks />
        <Security />
        <Numbers />
        <Faq />
        <CallToAction />
      </main>
      <Footer onNavigate={scrollTo} />
    </div>
  );
}
