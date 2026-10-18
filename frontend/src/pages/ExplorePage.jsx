import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { getProfile } from '../api/datasets';
import { createChart } from '../api/charts';
import { PageHeader } from '../components/layout/PageHeader';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';
import { ChartBuilder } from '../features/explore/ChartBuilder';
import { ChartRenderer } from '../features/explore/ChartRenderer';
export function ExplorePage() {
    const { datasetId = '' } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const returnTo = location.state?.returnTo || `/datasets/${datasetId}/predict`;
    const [profile, setProfile] = useState(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [chartType, setChartType] = useState('histogram');
    const [xColumn, setXColumn] = useState('');
    const [yColumn, setYColumn] = useState('');
    const [aggregation, setAggregation] = useState('mean');
    const [chart, setChart] = useState(null);
    const load = () => {
        setLoading(true);
        setError('');
        getProfile(datasetId)
            .then((p) => {
            setProfile(p.profile);
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
    return <div className="page-stack explore-page">
    <PageHeader eyebrow="CHARTS" title="Explore your data." description="Build a chart and download it as an image."/>
    <ChartBuilder columns={profile.columns} chartType={chartType} setChartType={changeType} xColumn={xColumn} setXColumn={setXColumn} yColumn={yColumn} setYColumn={setYColumn} aggregation={aggregation} setAggregation={setAggregation} onGenerate={generate} busy={busy}/>
    {error && <ErrorState message={error}/>}
    {chart && <ChartRenderer chart={chart}/>}
    <div className="chart-actions"><button className="button button-secondary" onClick={() => navigate(returnTo, { replace: true })}><ArrowLeft size={16}/> Return to results</button></div>
  </div>;
}
