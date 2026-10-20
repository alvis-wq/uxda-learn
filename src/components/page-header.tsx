export function PageHeader({
  title,
  leading,
  subtitle,
  description,
  children,
}: {
  title: React.ReactNode;
  /** Shown left of the title block (e.g. an avatar). */
  leading?: React.ReactNode;
  /** A small label right under the title (e.g. a job title). */
  subtitle?: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex min-w-0 items-center gap-4">
        {leading}
        <div className="min-w-0">
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
