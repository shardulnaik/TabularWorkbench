import { apiRequest } from './client';
export function getCleaningPlan(datasetId) {
    return apiRequest(`/datasets/${encodeURIComponent(datasetId)}/cleaning/plan`);
}
export function applyCleaning(datasetId, actions) {
    return apiRequest(`/datasets/${encodeURIComponent(datasetId)}/cleaning/apply`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actions }) });
}
export function getCleaningLog(datasetId) {
    return apiRequest(`/datasets/${encodeURIComponent(datasetId)}/cleaning/log`);
}
