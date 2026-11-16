/** Title row at the top of every app page: mono code, big title, optional actions. */
export default function PageHeader({ code, title, subtitle, actions }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        {code && <div className="label-mono mb-2 text-muted">{code}</div>}
        <h1 className="text-[clamp(2rem,3.2vw,2.75rem)] leading-none font-semibold tracking-[-0.04em]">{title}</h1>
        {subtitle && <p className="mt-2 text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
