interface PlaceholderPageProps {
  title: string;
  description: string;
}

export default function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <div>
      <h2 className="font-headline-lg text-headline-lg text-on-background mb-2">{title}</h2>
      <p className="text-on-surface-variant font-body-lg text-body-lg mb-8">{description}</p>
      <div className="bg-surface rounded border border-outline-variant shadow-sm p-10 text-center text-on-surface-variant">
        This section hasn't been built out yet.
      </div>
    </div>
  );
}
