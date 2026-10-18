export function PageHeader({
  title,
  subtitle,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
}) {
  return (
    <header className="flex flex-col gap-1 pb-6 pt-4 md:pt-10">
      {subtitle && (
        <p className="text-[13px] font-semibold uppercase tracking-wide text-label-secondary">{subtitle}</p>
      )}
      <h1 className="text-[34px] font-bold leading-tight tracking-tight">{title}</h1>
    </header>
  );
}
