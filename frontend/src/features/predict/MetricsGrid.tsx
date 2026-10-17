import { MetricCard } from '../../components/common/MetricCard';
import type { ModelEvaluation } from '../../types/ml';

export function MetricsGrid({ evaluation }: { evaluation: ModelEvaluation }) {
  const fields: [string, string][] = [['Accuracy', 'accuracy'], ['Balanced accuracy', 'balanced_accuracy'], ['Precision (weighted)', 'precision_weighted'], ['Recall (weighted)', 'recall_weighted'], ['F1 (weighted)', 'f1_weighted'], ['ROC-AUC', 'roc_auc']];
  return <div className="metrics-grid metrics-grid-results">{fields.map(([label, key]) => <MetricCard key={key} label={label} value={format(evaluation.metrics[key])} hint={key === 'roc_auc' && evaluation.metrics[key] == null ? 'Not available for this split' : 'Held-out test set'} />)}</div>;
}

function format(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${(value * 100).toFixed(1)}%`;
}
