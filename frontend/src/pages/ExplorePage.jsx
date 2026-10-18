import { useEffect, useState } from 'react';
import { ArrowRight, Download, Info } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { getProfile } from '../api/datasets';
import { getEdaSummary } from '../api/eda';
import { createChart } from '../api/charts';
import { exportUrl } from '../api/exports';
import { PageHeader } from '../components/layout/PageHeader';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';
import { ChartBuilder } from '../features/explore/ChartBuilder';
import { ChartRenderer } from '../features/explore/ChartRenderer';
import { StatsTable } from '../features/explore/StatsTable';
export function ExplorePage() {
    const { datasetId = '' } = useParams();
    const navigate = useNavigate();
    const [profile, setProfile] = useState(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [summary, setSummary] = useState(null);
    const [chartType, setChartType] = useState('histogram');
    const [xColumn, setXColumn] = useState('');
    const [yColumn, setYColumn] = useState('');
    const [aggregation, setAggregation] = useState('mean');
    const [chart, setChart] = useState(null);
    const load = () => {
        setLoading(true);
        setError('');
        Promise.all([getProfile(datasetId), getEdaSummary(datasetId)])
            .then(([p, s]) => {
            setProfile(p.profile);
            setSummary(s);
            const numeric = p.profile.columns.find((column) => column.kind === 'numeric' && !column.is_constant);
            const any = p.profile.columns.find((column) => !column.is_constant);
            const first = numeric?.name || any?.name || '';
            setXColumn(first);
            setYColumn(p.profile.columns.find((column) => column.kind === 'numeric' && column.name !== first)?.name || '');
        })
            .catch((reason) => setError(reason instanceof Error ? reason.message : 'Could not load exploratory statistics.'))
            .finally(() => setLoading(false));
    };
    useEffect(() => { load(); }, [datasetId]);
    const changeType = (newType) => {
        setChartType(newType);
        if (!profile)
            return;
        const numeric = profile.columns.filter((column) => column.kind === 'numeric' && !column.is_constant);
        const categories = profile.columns.filter((column) => !column.is_constant);
        if (newType === 'histogram') {
            setXColumn(numeric[0]?.name || '');
            setYColumn('');
        }
        else if (newType === 'scatter') {
            setXColumn(numeric[0]?.name || '');
            setYColumn(numeric.find((column) => column.name !== numeric[0]?.name)?.name || '');
        }
        else if (newType === 'line') {
            const x = profile.columns.find((column) => ['numeric', 'datetime'].includes(column.kind));
            setXColumn(x?.name || '');
            setYColumn(numeric.find((column) => column.name !== x?.name)?.name || '');
        }
        else if (newType === 'bar') {
            setXColumn(categories[0]?.name || '');
            setYColumn('');
        }
    };
    const generate = async () => {
        setBusy(true);
        setError('');
        try {
            const generated = await createChart(datasetId, { chart_type: chartType, x_column: chartType === 'correlation_heatmap' ? undefined : xColumn, y_column: yColumn || undefined, aggregation });
            setChart(generated);
        }
        catch (reason) {
            setError(reason instanceof Error ? reason.message : 'Chart generation failed.');
        }
        finally {
            setBusy(false);
        }
    };
    if (loading)
        return <LoadingState label="Calculating summary statistics…"/>;
    if (error && !profile)
        return <ErrorState message={error} onRetry={load}/>;
    if (!profile)
        return null;
    return <div className="page-stack">
    <PageHeader eyebrow="EXPLORE · VISUALIZATION" title="Find the patterns in your data." description="Review the statistics first, then build a chart. Chart choices and column types are validated by the backend."/>
    <StatsTable profile={profile}/>
    <ChartBuilder columns={profile.columns} chartType={chartType} setChartType={changeType} xColumn={xColumn} setXColumn={setXColumn} yColumn={yColumn} setYColumn={setYColumn} aggregation={aggregation} setAggregation={setAggregation} onGenerate={generate} busy={busy}/>
    {error && <ErrorState message={error}/>}
    {chart && <><ChartRenderer chart={chart}/><div className="chart-actions"><a className="button button-secondary" href={exportUrl(datasetId, 'chart-data', { chartRunId: chart.chart_run_id })}><Download size={16}/> Download chart data</a><button className="button button-primary" onClick={() => navigate(`/datasets/${datasetId}/results?chartRunId=${chart.chart_run_id}`)}>Open results & downloads <ArrowRight size={16}/></button></div></>}
    <div className="quiet-note"><Info size={16}/><span>Charts describe your data; they do not automatically affect the separate machine-learning workflow.</span></div>
    {summary && <details className="details-panel"><summary>More about this dataset's numeric relationships</summary><pre>{JSON.stringify(summary.correlation || {}, null, 2)}</pre></details>}
  </div>;
}
