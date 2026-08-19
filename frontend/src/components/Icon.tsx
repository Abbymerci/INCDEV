interface IconProps {
  name: string;
  className?: string;
  filled?: boolean;
}

/** Thin wrapper around the Material Symbols Outlined web font. */
export default function Icon({ name, className = "", filled = false }: IconProps) {
  return (
    <span
      className={`material-symbols-outlined ${className}`}
      style={{ fontVariationSettings: `'FILL' ${filled ? 1 : 0}` }}
      aria-hidden="true"
    >
      {name}
    </span>
  );
}
