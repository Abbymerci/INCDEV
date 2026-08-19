interface SummaryCardProps {
  label: string;
  value: string | number;
  accent?: "error" | "secondary" | "none";
  valueClassName?: string;
}

const ACCENT_BORDER: Record<NonNullable<SummaryCardProps["accent"]>, string> = {
  error: "border-t-4 border-t-error",
  secondary: "border-t-4 border-t-secondary-container",
  none: "",
};

export default function SummaryCard({ label, value, accent = "none", valueClassName = "" }: SummaryCardProps) {
  return (
    <div className={`bg-surface p-5 rounded border border-outline-variant shadow-sm ${ACCENT_BORDER[accent]}`}>
      <p className="font-label-md text-label-md text-on-surface-variant mb-1 uppercase tracking-wider">{label}</p>
      <p className={`font-display-lg text-display-lg text-on-background ${valueClassName}`}>{value}</p>
    </div>
  );
}
