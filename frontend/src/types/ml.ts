export type ModelName = 'dummy_classifier' | 'logistic_regression' | 'random_forest';
export type ScoringMetric = 'accuracy' | 'f1_weighted' | 'recall_weighted' | 'balanced_accuracy' | 'precision_weighted';

export interface ModelComparisonRow {
  model: ModelName;
  label: string;
  cv_metrics: Record<string, number | null>;
  folds: number;
}

export interface ModelComparison {
  model_run_id: string;
  target_column: string;
  scoring_metric: ScoringMetric;
  models: ModelComparisonRow[];
  recommended_model: ModelName;
  excluded_columns: string[];
  target_class_counts: Record<string, number>;
  train_rows: number;
  test_rows: number;
  cv_folds: number;
  selection_note: string;
}

export interface ModelEvaluation {
  model_run_id: string;
  completed?: boolean;
  selected_model: ModelName;
  selected_model_label: string;
  target_column: string;
  scoring_metric: ScoringMetric;
  comparison: ModelComparisonRow[];
  recommended_model: ModelName;
  metrics: Record<string, number | null>;
  confusion_matrix: { labels: string[]; matrix: number[][] };
  classification_report: Record<string, Record<string, number> | number>;
  feature_signals: { feature: string; importance: number }[];
  prediction_preview: Record<string, string | number | boolean | null>[];
  prediction_count: number;
  excluded_columns: string[];
  train_rows: number;
  test_rows: number;
  cv_folds: number;
  model_configuration: Record<string, unknown>;
  interpretation: string;
  artifact_available: boolean;
}
