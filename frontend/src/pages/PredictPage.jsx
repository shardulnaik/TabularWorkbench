import { useEffect, useState } from 'react';
import { ArrowRight, BrainCircuit, Info, ShieldCheck } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { getProfile } from '../api/datasets';
import { compareModels, evaluateModel } from '../api/ml';
import { PageHeader } from '../components/layout/PageHeader';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';
import { ModelComparisonTable } from '../features/predict/ModelComparisonTable';
import { StatusPill } from '../components/common/StatusPill';
export function PredictPage() {
    const { datasetId = '' } = useParams();
    const navigate = useNavigate();
    const [profile, setProfile] = useState(null);
    const [targetColumn, setTargetColumn] = useState('');
    const [metric, setMetric] = useState('accuracy');
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
            const result = await compareModels(datasetId, { target_column: targetColumn, scoring_metric: metric });
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
    return <div className="page-stack">
    <PageHeader eyebrow="PREDICT · MACHINE LEARNING" title="Compare models, then choose." description="Choose the column to predict. We'll compare a simple baseline with Logistic Regression and Random Forest using the same training split."/>
    <div className="safety-callout"><ShieldCheck size={22}/><div><strong>The test set is kept separate during model selection.</strong><p>Models are ranked using cross-validation on the training data. The final test metrics are generated only after you select a model.</p></div></div>
    <section className="panel"><div className="panel-heading"><div><h2>Set up your prediction</h2><p>This first release supports classification, such as predicting Attrition: Yes or No.</p></div><span className="panel-icon"><BrainCircuit size={23}/></span></div>
      <div className="form-grid"><label className="field"><span>What should the model predict?</span><select value={targetColumn} onChange={(event) => { setTargetColumn(event.target.value); setComparison(null); }}><option value="">Choose a target column</option>{usableTargets.map((column) => <option key={column.name} value={column.name}>{column.name} · {column.unique_count} unique values</option>)}</select></label><label className="field"><span>Rank models by</span><select value={metric} onChange={(event) => { setMetric(event.target.value); setComparison(null); }}><option value="accuracy">Accuracy</option><option value="f1_weighted">F1 score (weighted)</option><option value="recall_weighted">Recall (weighted)</option><option value="balanced_accuracy">Balanced accuracy</option><option value="precision_weighted">Precision (weighted)</option></select></label></div>
      <button className="button button-primary" onClick={compare} disabled={comparing || !targetColumn}>{comparing ? 'Comparing models…' : 'Train and compare models'} <ArrowRight size={16}/></button>
    </section>
    {error && <ErrorState message={error}/>}
    {comparison && <>
      <section className="panel"><div className="panel-heading"><div><div className="eyebrow">MODEL COMPARISON</div><h2>Choose the model you prefer</h2><p>{comparison.cv_folds}-fold cross-validation · {comparison.train_rows.toLocaleString()} training rows · {comparison.test_rows.toLocaleString()} held-out test rows</p></div><StatusPill tone="info">3 candidates</StatusPill></div>
        <div className="recommendation-callout"><span className="recommendation-check"><ShieldCheck size={18}/></span><div><strong>Top-ranked on {metric.replaceAll('_', ' ')}</strong><p>{comparison.models.find((row) => row.model === comparison.recommended_model)?.label || comparison.recommended_model} ranked highest using the selected cross-validation metric. You can choose another candidate below.</p></div></div>
        <ModelComparisonTable models={comparison.models} metric={metric} selectedModel={selectedModel} onSelect={(model) => setSelectedModel(model)}/>
        <div className="quiet-note"><Info size={16}/><span>Accuracy can be misleading when one class is much more common. Review recall, F1 and balanced accuracy too.</span></div>
        {comparison.excluded_columns.length > 0 && <details className="details-panel"><summary>Features automatically excluded or transformed ({comparison.excluded_columns.length})</summary><p>{comparison.excluded_columns.join(', ')}</p><small>ID-like, empty and constant columns are excluded by default; datetime columns may be converted into calendar parts.</small></details>}
        <div className="panel-footer"><span className="muted-copy">Selected model: {comparison.models.find((row) => row.model === selectedModel)?.label || selectedModel}</span><button className="button button-primary" onClick={evaluate} disabled={evaluating}>{evaluating ? 'Evaluating on test data…' : 'Evaluate selected model'} <ArrowRight size={16}/></button></div>
      </section>
    </>}
  </div>;
}
