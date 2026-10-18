import { apiRequest } from './client';
export function getEdaSummary(datasetId) {
    return apiRequest(`/datasets/${encodeURIComponent(datasetId)}/eda/summary`);
}
