import { apiRequest } from './client';

export function trainModel(datasetId, targetColumn) {
    return apiRequest(`/datasets/${encodeURIComponent(datasetId)}/ml/train`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_column: targetColumn }),
    });
}

export function predictRecord(datasetId, modelRunId, inputs) {
    return apiRequest(`/datasets/${encodeURIComponent(datasetId)}/ml/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model_run_id: modelRunId, inputs }),
    });
}

export function getModelRun(datasetId, runId) {
    return apiRequest(`/datasets/${encodeURIComponent(datasetId)}/ml/runs/${encodeURIComponent(runId)}`);
}
