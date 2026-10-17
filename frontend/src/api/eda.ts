import { apiRequest } from './client';

export function getEdaSummary(datasetId: string): Promise<Record<string, unknown>> {
  return apiRequest<Record<string, unknown>>(`/datasets/${encodeURIComponent(datasetId)}/eda/summary`);
}
