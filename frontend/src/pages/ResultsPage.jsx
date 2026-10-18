import { useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, Download, FileArchive, Info } from 'lucide-react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { getModelRun } from '../api/ml';
import { getDataset } from '../api/datasets';
import { exportUrl } from '../api/exports';
import { PageHeader } from '../components/layout/PageHeader';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';
import { MetricsGrid } from '../features/predict/MetricsGrid';
import { ConfusionMatrix } from '../features/predict/ConfusionMatrix';
import { ExportCatalog } from '../features/results/ExportCatalog';
export function ResultsPage() {
    const { datasetId = '' } = useParams();
    const [params] = useSearchParams();
    const location = useLocation();
    const runId = params.get('runId') || undefined;
    const chartRunId = params.get('chartRunId') || undefined;
    const [details, setDetails] = useState(null);
    const [evaluation, setEvaluation] = useState(location.state?.evaluation || null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const load = () => {
        setLoading(true);
        setError('');
        const calls = [getDataset(datasetId).then((value) => setDetails(value))];
        if (runId && !evaluation)
            calls.push(getModelRun(datasetId, runId).then((value) => setEvaluation(value)));
        Promise.all(calls).catch((reason) => setError(reason instanceof Error ? reason.message : 'Could not load the result package.')).finally(() => setLoading(false));
    };
    useEffect(() => { load(); }, [datasetId, runId]);
    if (loading)
        return <LoadingState label="Gathering your analysis outputs…"/>;
    if (error)
        return <ErrorState message={error} onRetry={load}/>;
    if (!details)
        return null;
    const hasEvaluation = Boolean(runId && evaluation && evaluation.completed !== false && evaluation.metrics);
    return <div className="page-stack">
    <PageHeader eyebrow="RESULTS · DOWNLOADS" title="Your analysis, ready to take away." description={`Outputs for ${details.filename}. Download only what you need, or bundle the current analysis into a ZIP.`} action={<span className="result-status"><CheckCircle2 size={17}/> Ready to export</span>}/>
    {hasEvaluation && evaluation && <>
      <div className="selected-model-banner"><div><div className="eyebrow">SELECTED MODEL</div><h2>{evaluation.selected_model_label}</h2><p>Target column: <strong>{evaluation.target_column}</strong> · Evaluated on {evaluation.test_rows.toLocaleString()} held-out rows.</p></div><div className="model-run-id">Run {evaluation.model_run_id.slice(0, 8)}</div></div>
      <MetricsGrid evaluation={evaluation}/>
      <section className="panel"><div className="panel-heading"><div><h2>Confusion matrix</h2><p>Rows represent actual classes; columns represent predictions.</p></div></div><ConfusionMatrix labels={evaluation.confusion_matrix.labels} matrix={evaluation.confusion_matrix.matrix}/></section>
      <section className="panel"><div className="panel-heading"><div><h2>Model comparison</h2><p>Candidate scores from cross-validation on the training partition.</p></div></div><div className="table-scroll"><table className="data-table"><thead><tr><th>Model</th><th>CV accuracy</th><th>CV F1</th><th>CV recall</th><th>CV balanced accuracy</th></tr></thead><tbody>{evaluation.comparison.map((model) => <tr key={model.model} className={model.model === evaluation.selected_model ? 'selected-row' : ''}><td><strong>{model.label}</strong>{model.model === evaluation.selected_model && <small className="table-subtext">Selected</small>}</td><td>{formatPercent(model.cv_metrics.accuracy)}</td><td>{formatPercent(model.cv_metrics.f1_weighted)}</td><td>{formatPercent(model.cv_metrics.recall_weighted)}</td><td>{formatPercent(model.cv_metrics.balanced_accuracy)}</td></tr>)}</tbody></table></div></section>
      <section className="panel"><div className="panel-heading"><div><h2>Per-class evaluation</h2><p>Metrics can differ across target classes, especially with imbalanced data.</p></div></div><div className="table-scroll"><table className="data-table"><thead><tr><th>Class / average</th><th>Precision</th><th>Recall</th><th>F1 score</th><th>Support</th></tr></thead><tbody>{Object.entries(evaluation.classification_report).filter(([, value]) => typeof value === 'object' && value !== null).map(([label, value]) => { const row = value; return <tr key={label}><td><strong>{label}</strong></td><td>{formatScore(row.precision)}</td><td>{formatScore(row.recall)}</td><td>{formatScore(row['f1-score'])}</td><td>{Number.isFinite(row.support) ? row.support.toLocaleString() : '—'}</td></tr>; })}</tbody></table></div></section>
      <details className="details-panel"><summary>Selected model configuration and exclusions</summary><pre>{JSON.stringify(evaluation.model_configuration, null, 2)}</pre><p><strong>Excluded or transformed:</strong> {evaluation.excluded_columns.join(', ') || 'None'}</p></details>
      {evaluation.feature_signals.length > 0 && <section className="panel"><div className="panel-heading"><div><h2>Top signals used by the model</h2><p>These show model reliance, not cause-and-effect relationships.</p></div></div><div className="signal-list">{evaluation.feature_signals.map((signal) => <div className="signal-row" key={signal.feature}><span>{signal.feature}</span><div className="signal-track"><span style={{ width: `${Math.max(2, signal.importance / Math.max(...evaluation.feature_signals.map((item) => item.importance), 0.00001) * 100)}%` }}/></div><strong>{signal.importance.toFixed(3)}</strong></div>)}</div></section>}
      <div className="interpretation-note"><Info size={17}/><p>{evaluation.interpretation}</p></div>
    </>}
    {!hasEvaluation && <div className="panel empty-results"><div className="empty-results-icon"><FileArchive size={24}/></div><h2>Your result package</h2><p>The cleaned dataset, data-quality report and cleaning log are available now. Model-specific outputs appear here after a model has been evaluated.</p><Link className="button button-secondary" to={`/datasets/${datasetId}/predict`}>Go to prediction <ArrowRight size={16}/></Link></div>}
    <section className="panel"><div className="panel-heading"><div><h2>Download individual outputs</h2><p>Each file is generated from the current data revision and selected model run.</p></div></div><ExportCatalog datasetId={datasetId} runId={hasEvaluation ? runId : undefined} chartRunId={chartRunId}/></section>
    <div className="zip-banner"><div className="zip-icon"><FileArchive size={24}/></div><div><h2>Everything in one package</h2><p>Includes the original upload unchanged, cleaned CSV, data profile, cleaning log, chart data from this revision, and selected-model artifacts when available.</p></div><a className="button button-primary" href={exportUrl(datasetId, 'all.zip', { runId: hasEvaluation ? runId : undefined })}><Download size={16}/> Download ZIP</a></div>
  </div>;
}
function formatPercent(value) {
    return value === null || value === undefined || !Number.isFinite(value) ? '—' : `${(value * 100).toFixed(1)}%`;
}
function formatScore(value) {
    return value === null || value === undefined || !Number.isFinite(value) ? '—' : value.toLocaleString(undefined, { maximumFractionDigits: 3 });
}
