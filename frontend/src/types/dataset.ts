export interface ColumnProfile {
  name: string;
  kind: 'numeric' | 'categorical' | 'datetime' | 'boolean' | string;
  dtype: string;
  missing_count: number;
  missing_pct: number;
  unique_count: number;
  is_constant: boolean;
  is_id_like: boolean;
  sample_values: string[];
}

export interface DataWarning {
  level: 'warning' | 'info' | string;
  code: string;
  column?: string | null;
  count?: number;
  message: string;
}

export interface DatasetProfile {
  row_count: number;
  column_count: number;
  missing_cells: number;
  missing_percentage: number;
  duplicate_rows: number;
  numeric_columns: number;
  categorical_columns: number;
  datetime_columns: number;
  boolean_columns: number;
  health_status: string;
  warnings: DataWarning[];
  columns: ColumnProfile[];
  numeric_summary: Record<string, Record<string, number | null>>;
  category_summary: Record<string, { value: string; count: number }[]>;
  preview: Record<string, unknown>[];
}

export interface CleaningAction {
  id: string;
  title: string;
  description: string;
  recommended: boolean;
  estimated_cells_or_rows: number;
  available: boolean;
}

export interface CleaningPlan {
  actions: CleaningAction[];
  recommended_action_ids: string[];
  note: string;
}

export interface UploadResult {
  requires_sheet_selection: boolean;
  available_sheets?: string[];
  message?: string;
  session_id?: string;
  filename?: string;
  selected_sheet?: string | null;
  row_count?: number;
  column_count?: number;
  data_revision?: number;
  expires_at?: string;
  profile?: DatasetProfile;
  cleaning_plan?: CleaningPlan;
}

export interface DatasetDetails {
  session_id: string;
  filename: string;
  selected_sheet?: string | null;
  row_count: number;
  column_count: number;
  data_revision: number;
  cleaning_applied: boolean;
  expires_at: string;
}
