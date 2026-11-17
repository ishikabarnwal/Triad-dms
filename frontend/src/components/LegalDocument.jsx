import { container } from "./landing/shared";

/** A long-form page in a white card: title, date, then numbered sections of plain paragraphs. */
export default function LegalDocument({ eyebrow, title, updated, intro, sections }) {
  return (
    <div className={container}>
      <article className="card mx-auto max-w-3xl px-6 py-12 sm:px-12 sm:py-16">
        <p className="text-sm font-semibold text-primary">{eyebrow}</p>
        <h1 className="mt-3 text-4xl font-bold tracking-[-0.03em] text-balance sm:text-5xl">{title}</h1>
        <p className="mt-3 text-sm text-muted">Last updated {updated}</p>
        <p className="mt-8 text-lg leading-[1.7] text-pretty">{intro}</p>
        {sections.map((section, index) => (
          <section key={section.heading} className="mt-10">
            <h2 className="text-xl font-bold tracking-[-0.02em]">
              {index + 1}. {section.heading}
            </h2>
            {section.body.map((paragraph) => (
              <p key={paragraph} className="mt-3 leading-[1.7] text-pretty text-muted">
                {paragraph}
              </p>
            ))}
          </section>
        ))}
      </article>
    </div>
  );
}
