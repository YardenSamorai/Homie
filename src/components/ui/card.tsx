export function Card({
  title,
  action,
  children,
}: {
  title?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      {(title || action) && (
        <div className="flex items-baseline justify-between px-1">
          {title && <h2 className="text-xl font-semibold tracking-tight">{title}</h2>}
          {action}
        </div>
      )}
      <div className="rounded-card bg-surface shadow-card ring-1 ring-[light-dark(rgb(40_30_20/0.04),rgb(255_255_255/0.06))]">
        {children}
      </div>
    </section>
  );
}
