import { useEffect, useState } from 'react';
import { ArrowRight, LoaderCircle } from 'lucide-react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { getProfile } from '../api/datasets';
import { compareModels, evaluateModel } from '../api/ml';
import { PageHeader } from '../components/layout/PageHeader';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';
import { ModelComparisonTable } from '../features/predict/ModelComparisonTable';
export function PredictPage() {
    const { datasetId = '' } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const [profile, setProfile] = useState(null);
    const [targetColumn, setTargetColumn] = useState(location.state?.targetColumn || '');
    const [comparison, setComparison] = useState(location.state?.comparisonResult || null);
    const [selectedModel, setSelectedModel] = useState(location.state?.selectedModel || 'logistic_regression');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const [comparing, setComparing] = useState(false);
    const [evaluating, setEvaluating] = useState(false);
    const [showComparison, setShowComparison] = useState(Boolean(location.state?.comparisonView && location.state?.comparisonResult));
    const load = () => {
        setLoading(true);
        setError('');
        getProfile(datasetId).then(({ profile: p }) => {
            setProfile(p);
            const preferred = p.columns.find((column) => /attrition|churn|outcome|target|status|class/i.test(column.name) && !column.is_id_like && column.unique_count >= 2 && column.unique_count <= 20)
                || p.columns.find((column) => column.kind === 'categorical' && !column.is_id_like && column.unique_count >= 2 && column.unique_count <= 20)
                || p.columns.find((column) => column.unique_count >= 2);
            setTargetColumn((current) => current || location.state?.targetColumn || preferred?.name || '');
        }).catch((reason) => setError(reason instanceof Error ? reason.message : 'Could not load the target-column options.')).finally(() => setLoading(false));
    };
    useEffect(() => { load(); }, [datasetId]);
    useEffect(() => {
        if (location.state?.targetColumn)
            setTargetColumn(location.state.targetColumn);
        if (location.state?.comparisonResult !== undefined)
            setComparison(location.state.comparisonResult);
        if (location.state?.selectedModel)
            setSelectedModel(location.state.selectedModel);
        setShowComparison(Boolean(location.state?.comparisonView && location.state?.comparisonResult));
    }, [location.state]);
    const compare = async () => {
        setComparing(true);
        setError('');
        setComparison(null);
        try {
            const result = await compareModels(datasetId, { target_column: targetColumn, scoring_metric: 'accuracy' });
            setComparison(result);
            setSelectedModel(result.recommended_model);
            setShowComparison(true);
            navigate(location.pathname, { replace: true, state: { ...location.state, comparisonView: true, comparisonResult: result, targetColumn, selectedModel: result.recommended_model } });
        }
        catch (reason) {
            setError(reason instanceof Error ? reason.message : 'Model comparison failed.');
        }
        finally {
            setComparing(false);
        }
    };
    const evaluate = async () => {
        if (!comparison)
            return;
        setEvaluating(true);
        setError('');
        try {
            const result = await evaluateModel(datasetId, comparison.model_run_id, selectedModel);
            navigate(`/datasets/${datasetId}/results?runId=${result.model_run_id}`, { state: { evaluation: result, comparisonResult: comparison, targetColumn, selectedModel, comparisonView: true } });
        }
        catch (reason) {
            setError(reason instanceof Error ? reason.message : 'Model evaluation failed.');
        }
        finally {
            setEvaluating(false);
        }
    };
    if (loading)
        return <LoadingState label="Preparing prediction options…"/>;
    if (error && !profile)
        return <ErrorState message={error} onRetry={load}/>;
    if (!profile)
        return null;
    const usableTargets = profile.columns.filter((column) => !column.is_constant && column.unique_count >= 2);
    return <div className="page-stack predict-page">
    {(comparing || evaluating) && <div className="processing-overlay" role="status" aria-live="polite" aria-busy="true"><div className="processing-card"><LoaderCircle className="processing-spinner" size={34}/><strong>{comparing ? 'Comparing models' : 'Evaluating selected model'}</strong><span>{comparing ? 'This can take a little while. Please keep this page open.' : 'Calculating the held-out results…'}</span></div></div>}
    <PageHeader title={showComparison && comparison ? "Compare models" : "Model prediction"}/>
    {!showComparison && <section className="panel prediction-setup">
      <div className="target-compare-row"><label className="field"><span>Prediction target</span><select value={targetColumn} onChange={(event) => { const value = event.target.value; setTargetColumn(value); setComparison(null); setShowComparison(false); navigate(location.pathname, { replace: true, state: { ...location.state, comparisonView: false, comparisonResult: null, targetColumn: value } }); }}><option value="">Choose a column</option>{usableTargets.map((column) => <option key={column.name} value={column.name}>{column.name}</option>)}</select></label>
      <button className="button button-primary compare-button" onClick={compare} disabled={comparing || !targetColumn}>{comparing ? 'Comparing models…' : 'Compare models'} <ArrowRight size={16}/></button></div>
      <p className="prediction-explainer">Choose the outcome column. The model learns from the other columns in each row; rows without an outcome are skipped.</p>
    </section>}
    {error && <ErrorState message={error}/>}
    {showComparison && comparison && <>
      <section className="panel comparison-view"><div className="panel-heading"><div><h2>Model scores</h2><p>Results for {targetColumn}</p></div></div>
        <ModelComparisonTable models={comparison.models} metric="accuracy" selectedModel={selectedModel} recommendedModel={comparison.recommended_model} onSelect={(model) => { setSelectedModel(model); navigate(location.pathname, { replace: true, state: { ...location.state, selectedModel: model } }); }}/>
        <div className="panel-footer comparison-actions"><button className="button button-secondary" onClick={() => { setShowComparison(false); navigate(location.pathname, { replace: true, state: { ...location.state, comparisonView: false, comparisonResult: comparison, targetColumn, selectedModel } }); }}>Back to target selection</button><button className="button button-primary" onClick={evaluate} disabled={evaluating}>{evaluating ? 'Evaluating model…' : 'Proceed with this model'} <ArrowRight size={16}/></button></div>
      </section>
    </>}
  </div>;
}
