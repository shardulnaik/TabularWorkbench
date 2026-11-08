import { apiRequest } from './client';
export function compareModels(datasetId, config) {
    return apiRequest(`/datasets/${encodeURIComponent(datasetId)}/ml/compare`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(config) });
}
export function evaluateModel(datasetId, modelRunId, selectedModel) {
    return apiRequest(`/datasets/${encodeURIComponent(datasetId)}/ml/evaluate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model_run_id: modelRunId, selected_model: selectedModel }) });
}
export function getModelRun(datasetId, runId) {
    return apiRequest(`/datasets/${encodeURIComponent(datasetId)}/ml/runs/${encodeURIComponent(runId)}`);
}
