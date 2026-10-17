import { apiRequest } from './client';
import type { CleaningPlan, DatasetProfile } from '../types/dataset';

export function getCleaningPlan(datasetId: string): Promise<CleaningPlan> {
  return apiRequest<CleaningPlan>(`/datasets/${encodeURIComponent(datasetId)}/cleaning/plan`);
}

export function applyCleaning(datasetId: string, actions: string[]): Promise<{ profile: DatasetProfile; cleaning_log: unknown[]; data_revision: number; actions_applied: string[] }> {
  return apiRequest(`/datasets/${encodeURIComponent(datasetId)}/cleaning/apply`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actions }) });
}

export function getCleaningLog(datasetId: string): Promise<{ items: unknown[] }> {
  return apiRequest<{ items: unknown[] }>(`/datasets/${encodeURIComponent(datasetId)}/cleaning/log`);
}
