import { apiGet } from "./client";
import type {
  IncidentDetail,
  IncidentListResponse,
  Priority,
  IncidentStatus,
  SummaryResponse,
} from "../types";

export interface ListIncidentsParams {
  priority?: Priority;
  status?: IncidentStatus;
  page?: number;
  pageSize?: number;
}

export function listIncidents(params: ListIncidentsParams = {}): Promise<IncidentListResponse> {
  return apiGet<IncidentListResponse>("/api/incidents", {
    priority: params.priority,
    status: params.status,
    page: params.page?.toString(),
    page_size: params.pageSize?.toString(),
  });
}

export function getIncidentSummary(): Promise<SummaryResponse> {
  return apiGet<SummaryResponse>("/api/incidents/summary");
}

export function getIncidentDetail(incidentNumber: string): Promise<IncidentDetail> {
  return apiGet<IncidentDetail>(`/api/incidents/${encodeURIComponent(incidentNumber)}`);
}
