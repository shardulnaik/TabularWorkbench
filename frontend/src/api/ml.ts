import { apiRequest } from './client';
import type { ModelComparison, ModelEvaluation, ModelName, ScoringMetric } from '../types/ml';

export function compareModels(datasetId: string, config: { target_column: string; scoring_metric: ScoringMetric }): Promise<ModelComparison> {
  return apiRequest<ModelComparison>(`/datasets/${encodeURIComponent(datasetId)}/ml/compare`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(config) });
}

export function evaluateModel(datasetId: string, modelRunId: string, selectedModel: ModelName): Promise<ModelEvaluation> {
  return apiRequest<ModelEvaluation>(`/datasets/${encodeURIComponent(datasetId)}/ml/evaluate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model_run_id: modelRunId, selected_model: selectedModel }) });
}

export function getModelRun(datasetId: string, runId: string): Promise<ModelEvaluation> {
  return apiRequest<ModelEvaluation>(`/datasets/${encodeURIComponent(datasetId)}/ml/runs/${encodeURIComponent(runId)}`);
}
