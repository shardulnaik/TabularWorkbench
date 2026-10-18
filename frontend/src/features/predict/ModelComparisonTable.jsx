const metrics = [
    ['accuracy', 'Accuracy'],
    ['f1_weighted', 'F1'],
    ['recall_weighted', 'Recall'],
    ['balanced_accuracy', 'Balanced accuracy'],
];

export function ModelComparisonTable({ models, metric, selectedModel, recommendedModel, onSelect }) {
    return <div className="model-options" role="radiogroup" aria-label="Choose a model">
      {models.map((row) => <label key={row.model} className={`model-option ${row.model === selectedModel ? 'selected' : ''}`}>
        <input type="radio" name="model-choice" checked={row.model === selectedModel} onChange={() => onSelect(row.model)}/>
        <span className="model-option-name">{row.label}{row.model === recommendedModel && <small>Recommended</small>}</span>
        <strong>{formatScore(row.cv_metrics[metric])}</strong>
      </label>)}
      <details className="details-panel model-details">
        <summary>See all comparison scores</summary>
        <div className="table-scroll"><table className="data-table"><thead><tr><th>Model</th>{metrics.map(([, label]) => <th key={label}>{label}</th>)}</tr></thead><tbody>{models.map((row) => <tr key={row.model}><td>{row.label}</td>{metrics.map(([key]) => <td key={key}>{formatScore(row.cv_metrics[key])}</td>)}</tr>)}</tbody></table></div>
        <p className="table-footnote">Scores use cross-validation on training data. The held-out test set is used only after you choose a model.</p>
      </details>
    </div>;
}

function formatScore(value) {
    return value === null || value === undefined ? '—' : `${(value * 100).toFixed(1)}%`;
}
