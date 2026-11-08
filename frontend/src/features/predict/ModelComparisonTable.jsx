const classificationMetrics = [['accuracy', 'Accuracy'], ['f1_weighted', 'F1'], ['precision_weighted', 'Precision'], ['recall_weighted', 'Recall']];
const regressionMetrics = [['mae', 'MAE'], ['mse', 'MSE'], ['rmse', 'RMSE'], ['r2', 'R²']];

export function ModelComparisonTable({ models, metric, selectedModel, recommendedModel, onSelect }) {
  const metrics = ['mae','mse','rmse','r2'].includes(metric) ? regressionMetrics : classificationMetrics;
  return <div className="model-options" role="radiogroup" aria-label="Choose a model">
    {models.map(row => <label key={row.model} className={`model-option ${row.model === selectedModel ? 'selected' : ''}`}>
      <input type="radio" name="model-choice" checked={row.model === selectedModel} onChange={() => onSelect(row.model)}/>
      <span className="model-option-name">{row.label}{row.model === recommendedModel && <small>Recommended</small>}</span>
      <strong>{formatScore(row.cv_metrics[metric], metric)}</strong>
    </label>)}
    <details className="details-panel model-details"><summary>See all comparison scores</summary>
      <div className="table-scroll"><table className="data-table"><thead><tr><th>Model</th>{metrics.map(([,label]) => <th key={label}>{label}</th>)}</tr></thead><tbody>{models.map(row => <tr key={row.model}><td>{row.label}</td>{metrics.map(([key]) => <td key={key}>{formatScore(row.cv_metrics[key], key)}</td>)}</tr>)}</tbody></table></div>
      <p className="table-footnote">Cross-validation scores; final testing uses separate rows.</p>
    </details>
  </div>;
}

function formatScore(value, metric) {
  if (value === null || value === undefined) return '—';
  return ['mae','mse','rmse','r2'].includes(metric) ? Number(value).toFixed(3) : `${(value * 100).toFixed(1)}%`;
}
