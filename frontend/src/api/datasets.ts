import { apiRequest } from './client';
import type { DatasetDetails, DatasetProfile, UploadResult } from '../types/dataset';

export async function uploadDataset(file: File, sheetName?: string): Promise<UploadResult> {
  const form = new FormData();
  form.append('file', file);
  if (sheetName) form.append('sheet_name', sheetName);
  return apiRequest<UploadResult>('/datasets/upload', { method: 'POST', body: form });
}

export async function getDataset(datasetId: string): Promise<DatasetDetails> {
  return apiRequest<DatasetDetails>(`/datasets/${encodeURIComponent(datasetId)}`);
}

export async function getProfile(datasetId: string): Promise<{ profile: DatasetProfile; data_revision: number }> {
  return apiRequest<{ profile: DatasetProfile; data_revision: number }>(`/datasets/${encodeURIComponent(datasetId)}/profile`);
}
