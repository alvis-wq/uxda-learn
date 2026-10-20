export function PageHeader({
  title,
  leading,
  subtitle,
  description,
  children,
}: {
  title: React.ReactNode;
  /** Shown left of the title block (e.g. the profile's hero card); on phones it sits above it, both centred. */
  leading?: React.ReactNode;
  /** A small label right under the title (e.g. a job title). */
  subtitle?: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div
        className={
          leading ? "flex min-w-0 flex-col items-center gap-4 sm:flex-row sm:gap-6" : "flex min-w-0 items-center gap-4"
        }
      >
        {leading}
        {/* With a leading item, the name block is centred under it on phones (text-center here only, not on the card). */}
        <div className={leading ? "min-w-0 text-center sm:text-left" : "min-w-0"}>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle && (
            <p className="text-foreground/80 mt-0.5 text-sm" data-testid="page-subtitle">
              {subtitle}
            </p>
          )}
          {description && <p className="text-muted-foreground mt-1">{description}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}
