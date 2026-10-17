import { apiRequest } from './client';
import type { Aggregation, ChartData, ChartType } from '../types/charts';

export function createChart(datasetId: string, config: { chart_type: ChartType; x_column?: string; y_column?: string; aggregation?: Aggregation }): Promise<ChartData> {
  return apiRequest<ChartData>(`/datasets/${encodeURIComponent(datasetId)}/charts/data`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(config) });
}
