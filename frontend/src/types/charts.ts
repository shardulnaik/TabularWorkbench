export type ChartType = 'histogram' | 'bar' | 'line' | 'scatter' | 'correlation_heatmap';
export type Aggregation = 'mean' | 'sum' | 'count' | 'median';

export interface ChartData {
  chart_run_id?: string;
  chart_type: ChartType;
  title: string;
  x_key?: string;
  y_key?: string;
  aggregation?: Aggregation;
  data?: Record<string, string | number | null>[];
  columns?: string[];
  matrix?: number[][];
  sample_count?: number;
  note?: string;
}
