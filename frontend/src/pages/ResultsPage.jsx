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
      <PageHeader title="Results"/>
      {!hasEvaluation && <p className="muted-copy">{chartRunId ? 'Your chart is ready to download.' : 'Your cleaned data and data profile are ready to download.'}</p>}
      {hasEvaluation && evaluation && <section className="panel result-model-panel">
        <div className="panel-heading"><div><h2>{evaluation.selected_model_label}</h2><p>Target: {evaluation.target_column}</p></div></div>
        <MetricsGrid evaluation={evaluation}/>
      </section>}
      <section className="panel result-download-panel">
        <div><h2>Download result</h2><p>Download your analysis as a ZIP file.</p></div>
        <a className="button button-primary" href={exportUrl(datasetId, 'all.zip', { runId: hasEvaluation ? runId : undefined, chartRunId })}><Download size={16}/> Download ZIP</a>
      </section>
      <section className="panel result-chart-panel">
        <div><h2>Charts</h2></div>
        <button className="button button-secondary" onClick={() => navigate(`/datasets/${datasetId}/explore`, { state: { returnTo: `${location.pathname}${location.search}`, evaluation } })}><ChartNoAxesCombined size={17}/> Open charts</button>
      </section>
    </div>;
}


