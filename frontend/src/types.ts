export type Priority = "P1" | "P2" | "P3";

export type IncidentStatus = "Bridge Active" | "Pending Vendor" | "Investigating";

export interface Incident {
  incident_number: string;
  priority: Priority;
  mim: boolean;
  opened_at: string;
  duration_minutes: number;
  status: IncidentStatus;
  causal_cio: string;
  impacted_biz: string;
}

export interface TimelineEntry {
  timestamp: string;
  author: string;
  note: string;
}

export interface IncidentDetail extends Incident {
  description: string;
  incident_commander: string;
  bridge_url: string | null;
  updates: TimelineEntry[];
}

export interface IncidentListResponse {
  items: Incident[];
  total: number;
  page: number;
  page_size: number;
}

export interface SummaryResponse {
  critical_count: number;
  high_count: number;
  active_bridges: number;
  avg_resolution_minutes: number;
}
