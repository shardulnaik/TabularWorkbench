import { useEffect, useState } from 'react';
import { ChartNoAxesCombined, Download } from 'lucide-react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
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
    const navigate = useNavigate();
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
        Promise.all(calls)
            .catch((reason) => setError(reason instanceof Error ? reason.message : 'Could not load the results.'))
            .finally(() => setLoading(false));
    };

    useEffect(() => { load(); }, [datasetId, runId]);

    if (loading)
        return <LoadingState label="Preparing your results…"/>;
    if (error)
        return <ErrorState message={error} onRetry={load}/>;
    if (!details)
        return null;

    const hasEvaluation = Boolean(runId && evaluation && evaluation.completed !== false && evaluation.metrics);
    return <div className="page-stack results-page">
      <PageHeader eyebrow="COMPLETE" title="Your results are ready." description={details.filename}/>
      {hasEvaluation && evaluation && <section className="compact-result">
        <div><span>Model</span><strong>{evaluation.selected_model_label}</strong></div>
        <div><span>Target</span><strong>{evaluation.target_column}</strong></div>
        <div><span>Accuracy</span><strong>{formatPercent(evaluation.metrics.accuracy)}</strong></div>
      </section>}
      {!hasEvaluation && <p className="muted-copy">{chartRunId ? 'Your chart is ready to download.' : 'Your cleaned data and data profile are ready to download.'}</p>}
      <section className="panel result-download-panel">
        <div><h2>Download your work</h2><p>Get the current analysis and its outputs in one file.</p></div>
        <a className="button button-primary" href={exportUrl(datasetId, 'all.zip', { runId: hasEvaluation ? runId : undefined, chartRunId })}><Download size={16}/> Download all</a>
      </section>
      <section className="panel result-chart-panel">
        <div><h2>Need a chart?</h2><p>Create a chart, download it as an image, then return here to your results.</p></div>
        <button className="button button-secondary" onClick={() => navigate(`/datasets/${datasetId}/explore`, { state: { returnTo: `${location.pathname}${location.search}`, evaluation } })}><ChartNoAxesCombined size={17}/> Create or download a chart</button>
      </section>
      {chartRunId && <a className="text-button" href={exportUrl(datasetId, 'chart-data', { chartRunId })}><Download size={15}/> Download chart data</a>}
      {hasEvaluation && evaluation && <details className="details-panel result-details">
        <summary>View detailed model results</summary>
        <div className="page-stack">
          <MetricsGrid evaluation={evaluation}/>
          <section className="panel"><div className="panel-heading"><div><h2>Confusion matrix</h2><p>Actual versus predicted classes.</p></div></div><ConfusionMatrix labels={evaluation.confusion_matrix.labels} matrix={evaluation.confusion_matrix.matrix}/></section>
          <section className="panel"><div className="panel-heading"><div><h2>Model comparison</h2><p>Cross-validation scores for each candidate.</p></div></div><div className="table-scroll"><table className="data-table"><thead><tr><th>Model</th><th>Accuracy</th><th>F1</th><th>Recall</th><th>Balanced accuracy</th></tr></thead><tbody>{evaluation.comparison.map((model) => <tr key={model.model}><td><strong>{model.label}</strong></td><td>{formatPercent(model.cv_metrics.accuracy)}</td><td>{formatPercent(model.cv_metrics.f1_weighted)}</td><td>{formatPercent(model.cv_metrics.recall_weighted)}</td><td>{formatPercent(model.cv_metrics.balanced_accuracy)}</td></tr>)}</tbody></table></div></section>
          <details className="details-panel"><summary>Per-class evaluation and model configuration</summary><pre>{JSON.stringify({ classification_report: evaluation.classification_report, configuration: evaluation.model_configuration, excluded_columns: evaluation.excluded_columns }, null, 2)}</pre></details>
          {evaluation.feature_signals.length > 0 && <section className="panel"><div className="panel-heading"><div><h2>Top model signals</h2><p>Model reliance is not the same as cause and effect.</p></div></div><div className="signal-list">{evaluation.feature_signals.map((signal) => <div className="signal-row" key={signal.feature}><span>{signal.feature}</span><div className="signal-track"><span style={{ width: `${Math.max(2, signal.importance / Math.max(...evaluation.feature_signals.map((item) => item.importance), 0.00001) * 100)}%` }}/></div><strong>{signal.importance.toFixed(3)}</strong></div>)}</div></section>}
        </div>
      </details>}
      <details className="details-panel result-details"><summary>Download individual files</summary><ExportCatalog datasetId={datasetId} runId={hasEvaluation ? runId : undefined} chartRunId={chartRunId}/></details>
    </div>;
}

function formatPercent(value) {
    return value === null || value === undefined || !Number.isFinite(value) ? '—' : `${(value * 100).toFixed(1)}%`;
}
