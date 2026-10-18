import { apiRequest } from './client';
export function createChart(datasetId, config) {
    return apiRequest(`/datasets/${encodeURIComponent(datasetId)}/charts/data`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(config) });
}
