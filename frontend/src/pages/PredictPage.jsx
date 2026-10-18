import { useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { getProfile } from '../api/datasets';
import { compareModels, evaluateModel } from '../api/ml';
import { PageHeader } from '../components/layout/PageHeader';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';
import { ModelComparisonTable } from '../features/predict/ModelComparisonTable';
export function PredictPage() {
    const { datasetId = '' } = useParams();
    const navigate = useNavigate();
    const [profile, setProfile] = useState(null);
    const [targetColumn, setTargetColumn] = useState('');
    const [comparison, setComparison] = useState(null);
    const [selectedModel, setSelectedModel] = useState('logistic_regression');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const [comparing, setComparing] = useState(false);
    const [evaluating, setEvaluating] = useState(false);
    const load = () => {
        setLoading(true);
        setError('');
        getProfile(datasetId).then(({ profile: p }) => {
            setProfile(p);
            const preferred = p.columns.find((column) => /attrition|churn|outcome|target|status|class/i.test(column.name) && !column.is_id_like && column.unique_count >= 2 && column.unique_count <= 20)
                || p.columns.find((column) => column.kind === 'categorical' && !column.is_id_like && column.unique_count >= 2 && column.unique_count <= 20)
                || p.columns.find((column) => column.unique_count >= 2);
            setTargetColumn(preferred?.name || '');
        }).catch((reason) => setError(reason instanceof Error ? reason.message : 'Could not load the target-column options.')).finally(() => setLoading(false));
    };
    useEffect(() => { load(); }, [datasetId]);
    const compare = async () => {
        setComparing(true);
        setError('');
        setComparison(null);
        try {
            const result = await compareModels(datasetId, { target_column: targetColumn, scoring_metric: 'accuracy' });
            setComparison(result);
            setSelectedModel(result.recommended_model);
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
            navigate(`/datasets/${datasetId}/results?runId=${result.model_run_id}`, { state: { evaluation: result } });
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
    <PageHeader eyebrow="MODEL TUNING" title="What do you want to predict?" description="Choose an outcome. We’ll compare five classification models and recommend a good starting point."/>
    <section className="panel prediction-setup">
      <div className="target-compare-row"><label className="field"><span>Prediction target</span><select value={targetColumn} onChange={(event) => { setTargetColumn(event.target.value); setComparison(null); }}><option value="">Choose a column</option>{usableTargets.map((column) => <option key={column.name} value={column.name}>{column.name}</option>)}</select></label>
      <button className="button button-primary compare-button" onClick={compare} disabled={comparing || !targetColumn}>{comparing ? 'Comparing models…' : 'Compare models'} <ArrowRight size={16}/></button></div>
      <p className="prediction-explainer">Choose the column you want the model to predict. Each row is one example; the selected column is the outcome, and the other usable columns are the inputs. The app trains and cross-validates each model on part of the rows, ranks their scores, then evaluates your chosen model on a held-out set of rows.</p>
    </section>
    {error && <ErrorState message={error}/>}
    {comparison && <>
      <section className="panel"><div className="panel-heading"><div><h2>Choose a model</h2><p>{comparison.train_rows.toLocaleString()} rows used for comparison</p></div></div>
        <ModelComparisonTable models={comparison.models} metric="accuracy" selectedModel={selectedModel} recommendedModel={comparison.recommended_model} onSelect={(model) => setSelectedModel(model)}/>
        <div className="panel-footer"><button className="button button-primary" onClick={evaluate} disabled={evaluating}>{evaluating ? 'Evaluating model…' : 'Proceed with this model'} <ArrowRight size={16}/></button></div>
      </section>
    </>}
  </div>;
}
