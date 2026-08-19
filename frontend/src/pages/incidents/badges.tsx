import type { IncidentStatus, Priority } from "../../types";

const PRIORITY_STYLES: Record<Priority, string> = {
  P1: "bg-error-container text-on-error-container",
  P2: "bg-secondary-container text-on-secondary-container",
  P3: "bg-surface-variant text-on-surface-variant",
};

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-sm font-label-md text-label-md ${PRIORITY_STYLES[priority]}`}
    >
      {priority}
    </span>
  );
}

const STATUS_DOT_STYLES: Record<IncidentStatus, string> = {
  "Bridge Active": "bg-error animate-pulse",
  "Pending Vendor": "bg-secondary",
  Investigating: "bg-outline",
};

const STATUS_TEXT_STYLES: Record<IncidentStatus, string> = {
  "Bridge Active": "text-on-background",
  "Pending Vendor": "text-on-surface-variant",
  Investigating: "text-on-surface-variant",
};

export function StatusIndicator({ status }: { status: IncidentStatus }) {
  return (
    <div className={`flex items-center gap-1.5 ${STATUS_TEXT_STYLES[status]}`}>
      <span className={`w-2 h-2 rounded-full ${STATUS_DOT_STYLES[status]}`} />
      {status}
    </div>
  );
}
