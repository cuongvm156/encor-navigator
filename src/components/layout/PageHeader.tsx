export function PageHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
}) {
  return (
    <header className="mb-6">
      {eyebrow ? (
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          {eyebrow}
        </p>
      ) : null}
      <h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>
      {description ? (
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      ) : null}
    </header>
  );
}
