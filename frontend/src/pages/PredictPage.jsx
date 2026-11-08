import { useEffect, useState } from 'react';
import { ArrowRight, LoaderCircle } from 'lucide-react';
import { useParams, useSearchParams } from 'react-router-dom';
import { getProfile } from '../api/datasets';
import { createChart } from '../api/charts';
import { getModelRun, predictRecord, trainModel } from '../api/ml';
import { PageHeader } from '../components/layout/PageHeader';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';
import { ChartBuilder } from '../features/explore/ChartBuilder';
import { ChartRenderer } from '../features/explore/ChartRenderer';

export function PredictPage() {
  const { datasetId = '' } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const runId = searchParams.get('runId');
  const [profile, setProfile] = useState(null);
  const [targetColumn, setTargetColumn] = useState('');
  const [trained, setTrained] = useState(null);
  const [inputs, setInputs] = useState({});
  const [prediction, setPrediction] = useState(null);
  const [chartType, setChartType] = useState('histogram');
  const [xColumn, setXColumn] = useState('');
  const [yColumn, setYColumn] = useState('');
  const [aggregation, setAggregation] = useState('mean');
  const [chart, setChart] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [training, setTraining] = useState(false);
  const [predicting, setPredicting] = useState(false);
  const [charting, setCharting] = useState(false);

  const load = async () => {
    setLoading(true); setError('');
    try {
      const { profile: nextProfile } = await getProfile(datasetId);
      setProfile(nextProfile);
      const numeric = nextProfile.columns.find(c => c.kind === 'numeric' && !c.is_constant);
      const any = nextProfile.columns.find(c => !c.is_constant);
      setXColumn(numeric?.name || any?.name || '');
      setYColumn(nextProfile.columns.find(c => c.kind === 'numeric' && c.name !== (numeric?.name || any?.name))?.name || '');
      if (runId) {
        const result = await getModelRun(datasetId, runId);
        setTrained(result); setTargetColumn(result.target_column);
        setInputs(Object.fromEntries((result.feature_schema || []).map(feature => [feature.name, ''])));
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load prediction options.');
    } finally { setLoading(false); }
  };
  useEffect(() => {
    // Training already produced this run in the current view; keep the entered
    // form state instead of reloading it just because the URL was updated.
    if (trained?.model_run_id === runId) return;
    load();
  }, [datasetId, runId, trained?.model_run_id]);

  const eligibleTargets = profile?.columns.filter(column => column.target_eligibility?.classification?.applicable || column.target_eligibility?.regression?.applicable) || [];

  const startTraining = async () => {
    if (!targetColumn) return;
    setTraining(true); setError(''); setPrediction(null);
    try {
      const result = await trainModel(datasetId, targetColumn);
      setTrained(result);
      setInputs(Object.fromEntries(result.feature_schema.map(feature => [feature.name, ''])));
      setSearchParams({ runId: result.model_run_id }, { replace: true });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Model training failed.');
    } finally { setTraining(false); }
  };

  const changeTarget = () => {
    setTrained(null); setPrediction(null); setInputs({}); setError('');
    setSearchParams({}, { replace: true });
  };

  const submitPrediction = async (event) => {
    event.preventDefault();
    if (!trained) return;
    setPredicting(true); setError(''); setPrediction(null);
    try { setPrediction(await predictRecord(datasetId, trained.model_run_id, inputs)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Prediction failed.'); }
    finally { setPredicting(false); }
  };

  const changeChartType = (nextType) => {
    setChartType(nextType);
    if (!profile) return;
    const numeric = profile.columns.filter(c => c.kind === 'numeric' && !c.is_constant);
    const categories = profile.columns.filter(c => !c.is_constant);
    if (nextType === 'histogram') { setXColumn(numeric[0]?.name || ''); setYColumn(''); }
    else if (nextType === 'scatter') { setXColumn(numeric[0]?.name || ''); setYColumn(numeric.find(c => c.name !== numeric[0]?.name)?.name || ''); }
    else if (nextType === 'line') { const x = profile.columns.find(c => ['numeric','datetime'].includes(c.kind)); setXColumn(x?.name || ''); setYColumn(numeric.find(c => c.name !== x?.name)?.name || ''); }
    else if (nextType === 'bar') { setXColumn(categories[0]?.name || ''); setYColumn(''); }
  };

  const generateChart = async () => {
    setCharting(true); setError('');
    try {
      const result = await createChart(datasetId, { chart_type: chartType, x_column: chartType === 'correlation_heatmap' ? undefined : xColumn, y_column: yColumn || undefined, aggregation });
      setChart(result);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Chart generation failed.'); }
    finally { setCharting(false); }
  };

  if (loading) return <LoadingState label="Preparing prediction options…"/>;
  if (error && !profile) return <ErrorState message={error} onRetry={load}/>;
  if (!profile) return null;
  const taskLabel = trained?.task_type === 'classification' ? 'Classification' : 'Regression';
  const busy = training || predicting || charting;

  return <div className="page-stack predict-page">
    {busy && <div className="processing-overlay" role="status" aria-live="polite"><div className="processing-card"><LoaderCircle className="processing-spinner" size={34}/><strong>{training ? 'Training model' : predicting ? 'Generating prediction' : 'Generating chart'}</strong><span>Please keep this page open.</span></div></div>}
    <PageHeader title="Predict"/>
    {!trained ? <section className="panel prediction-setup">
      <label className="field"><span>Target column</span><select value={targetColumn} onChange={event => setTargetColumn(event.target.value)}><option value="">Choose the value to predict</option>{eligibleTargets.map(column => <option key={column.name} value={column.name}>{column.name}</option>)}</select></label>
      <button className="button button-primary" onClick={startTraining} disabled={training || !targetColumn}>Continue <ArrowRight size={16}/></button>
      {!eligibleTargets.length && <p className="inline-error">No suitable target columns were found in this dataset.</p>}
    </section> : <>
      <section className="panel prediction-setup">
        <div className="panel-heading"><div><h2>{trained.target_column}</h2><p>{taskLabel} · {trained.model_label}</p></div><button className="button button-secondary button-small" onClick={changeTarget}>Choose another target</button></div>
        <div className="metrics-grid">{Object.entries(trained.metrics || {}).filter(([key]) => key !== 'test_rows').map(([key,value]) => <div className="metric-card" key={key}><span>{metricLabels[key] || key.replaceAll('_',' ')}</span><strong>{value == null ? '—' : Number(value).toFixed(3)}</strong></div>)}</div>
        {trained.warnings?.map(warning => <p className="quiet-note" key={warning}>{warning}</p>)}
        <p className="field-note">Evaluation uses {trained.test_rows} held-out labeled rows.</p>
      </section>
      <form className="panel prediction-form" onSubmit={submitPrediction}>
        <div className="panel-heading"><div><h2>Enter one new record</h2><p>Fill in the input features used by the model.</p></div></div>
        {trained.feature_schema.map((feature, index) => <label className="field prediction-input-field" key={feature.name}>
          <span>{feature.name}</span>
          {feature.kind === 'numeric' ? <input required type="number" step="any" value={inputs[feature.name] ?? ''} onChange={event => setInputs(current => ({ ...current, [feature.name]: event.target.value }))} placeholder="Enter a number"/> : <><input required type="text" list={`feature-options-${index}`} value={inputs[feature.name] ?? ''} onChange={event => setInputs(current => ({ ...current, [feature.name]: event.target.value }))} placeholder="Choose or enter a category"/><datalist id={`feature-options-${index}`}>{feature.categories.map(category => <option key={category} value={category}/>)}</datalist></>}
        </label>)}
        {!trained.feature_schema.length && <p className="inline-error">No suitable input features were found for this target.</p>}
        <button className="button button-primary" type="submit" disabled={predicting || !trained.feature_schema.length}>Generate prediction</button>
        {prediction && <div className="prediction-result" role="status"><span>Predicted {trained.target_column}</span><strong>{formatPrediction(prediction.predicted_value, trained.task_type)}</strong>{trained.task_type === 'classification' && prediction.probabilities && <p>Estimated probability: {((prediction.probabilities[prediction.predicted_value] || 0) * 100).toFixed(1)}%</p>}{prediction.warnings?.map(warning => <small key={warning}>{warning}</small>)}</div>}
      </form>
    </>}
    {error && <ErrorState message={error}/>}
    <details className="panel inline-chart-panel"><summary>Generate chart</summary><ChartBuilder columns={profile.columns} chartType={chartType} setChartType={changeChartType} xColumn={xColumn} setXColumn={setXColumn} yColumn={yColumn} setYColumn={setYColumn} aggregation={aggregation} setAggregation={setAggregation} onGenerate={generateChart} busy={charting}/></details>
    {chart && <ChartRenderer chart={chart} datasetId={datasetId}/>}
  </div>;
}

const metricLabels = { accuracy: 'Accuracy', balanced_accuracy: 'Balanced accuracy', precision_weighted: 'Precision', recall_weighted: 'Recall', f1_weighted: 'F1 score', mae: 'MAE', mse: 'MSE', rmse: 'RMSE', r2: 'R²' };
function formatPrediction(value, task) { return task === 'classification' ? String(value) : Number(value).toLocaleString(undefined, { maximumFractionDigits: 3 }); }
