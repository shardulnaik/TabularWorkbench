import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, BarChart3, ClipboardList, LoaderCircle } from 'lucide-react';
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
  const [screen, setScreen] = useState('evaluation');
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
        setTrained(result); setTargetColumn(result.target_column); setScreen('evaluation');
        setInputs(Object.fromEntries((result.feature_schema || []).map(feature => [feature.name, ''])));
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load prediction options.');
    } finally { setLoading(false); }
  };
  useEffect(() => {
    if (trained?.model_run_id === runId) return;
    load();
  }, [datasetId, runId, trained?.model_run_id]);

  const eligibleTargets = profile?.columns.filter(column => column.target_eligibility?.classification?.applicable || column.target_eligibility?.regression?.applicable) || [];
  const startTraining = async () => {
    if (!targetColumn) return;
    setTraining(true); setError(''); setPrediction(null);
    try {
      const result = await trainModel(datasetId, targetColumn);
      setTrained(result); setScreen('evaluation');
      setInputs(Object.fromEntries(result.feature_schema.map(feature => [feature.name, ''])));
      setSearchParams({ runId: result.model_run_id }, { replace: true });
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Model training failed.'); }
    finally { setTraining(false); }
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
    setChart(null);
  };
  const generateChart = async () => {
    setCharting(true); setError('');
    try {
      const result = await createChart(datasetId, { chart_type: chartType, x_column: chartType === 'correlation_heatmap' ? undefined : xColumn, y_column: yColumn || undefined, aggregation });
      setChart(result);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Chart generation failed.'); }
    finally { setCharting(false); }
  };

  if (loading) return <LoadingState label="Preparing prediction options..."/>;
  if (error && !profile) return <ErrorState message={error} onRetry={load}/>;
  if (!profile) return null;
  const taskLabel = trained?.task_type === 'classification' ? 'Classification' : 'Regression';
  const busy = training || predicting || charting;

  return <div className={`page-stack predict-page predict-screen-${!trained ? 'setup' : screen}`}>
    {busy && <div className="processing-overlay" role="status" aria-live="polite"><div className="processing-card"><LoaderCircle className="processing-spinner" size={34}/><strong>{training ? 'Training model' : predicting ? 'Generating prediction' : 'Generating chart'}</strong><span>Please keep this page open.</span></div></div>}
    <PageHeader title="Predict"/>
    {!trained ? <section className="panel prediction-setup prediction-target-setup">
      <div><span className="predict-step-label">MODEL SETUP</span><h2>Choose what to predict</h2><p>Select a target column. We’ll train a model from the available features.</p></div>
      <label className="field"><span>Target column</span><select value={targetColumn} onChange={event => setTargetColumn(event.target.value)}><option value="">Choose a column</option>{eligibleTargets.map(column => <option key={column.name} value={column.name}>{column.name}</option>)}</select></label>
      <button className="button button-primary" onClick={startTraining} disabled={training || !targetColumn}>Continue <ArrowRight size={16}/></button>
      {!eligibleTargets.length && <p className="inline-error">No suitable target columns were found in this dataset.</p>}
    </section> : <>
      {screen === 'evaluation' && <section className="prediction-evaluation-view">
        <section className="panel prediction-overview">
          <div className="prediction-overview-heading"><div><span className="predict-step-label">MODEL EVALUATION</span><h2>{trained.target_column}</h2><p>{taskLabel} · {trained.model_label}</p></div></div>
          <div className="metrics-grid prediction-metrics">{Object.entries(trained.metrics || {}).filter(([key]) => key !== 'test_rows').map(([key,value]) => <div className="metric-card" key={key}><span>{metricLabels[key] || key.replaceAll('_',' ')}</span><strong>{formatMetric(key, value)}</strong></div>)}</div>
        </section>
        <div className="prediction-next-actions">
          <button className="button button-primary" onClick={() => { setPrediction(null); setScreen('record'); }}><ClipboardList size={16}/> Enter a record <ArrowRight size={16}/></button>
          <button className="button button-secondary" onClick={() => { setChart(null); setScreen('chart'); }}><BarChart3 size={16}/> Generate chart</button>
        </div>
      </section>}
      {screen === 'record' && <section className="prediction-work-view">
        <div className="prediction-work-heading"><button className="button button-secondary button-small" onClick={() => setScreen('evaluation')}><ArrowLeft size={15}/> Back to evaluation</button><div><span className="predict-step-label">NEW PREDICTION</span><h2>Enter one new record</h2></div></div>
        <div className="prediction-entry-layout">
          <form className="panel prediction-form" onSubmit={submitPrediction}>
            <div className="panel-heading"><div><h2>Record details</h2><p>Fill in the input features used by the model.</p></div></div>
            <div className="prediction-fields-scroll">{trained.feature_schema.map((feature, index) => <label className="field prediction-input-field" key={feature.name}>
              <span>{feature.name}</span>
              {feature.kind === 'numeric' ? <input required type="number" step="any" value={inputs[feature.name] ?? ''} onChange={event => setInputs(current => ({ ...current, [feature.name]: event.target.value }))} placeholder="Enter a number"/> : <><input required type="text" list={`feature-options-${index}`} value={inputs[feature.name] ?? ''} onChange={event => setInputs(current => ({ ...current, [feature.name]: event.target.value }))} placeholder="Choose or enter a category"/><datalist id={`feature-options-${index}`}>{feature.categories.map(category => <option key={category} value={category}/>)}</datalist></>}
            </label>)}</div>
            {!trained.feature_schema.length && <p className="inline-error">No suitable input features were found for this target.</p>}
            <button className="button button-primary prediction-submit" type="submit" disabled={predicting || !trained.feature_schema.length}>Generate prediction <ArrowRight size={16}/></button>
          </form>
          <section className="panel prediction-result-pane" aria-live="polite"><span className="predict-step-label">PREDICTION RESULT</span>{prediction ? <div className="prediction-result" role="status"><span>Predicted {trained.target_column}</span><strong>{formatPrediction(prediction.predicted_value, trained.task_type)}</strong>{trained.task_type === 'classification' && prediction.probabilities && <p>Estimated probability: {((prediction.probabilities[prediction.predicted_value] || 0) * 100).toFixed(1)}%</p>}{prediction.warnings?.map(warning => <small key={warning}>{warning}</small>)}</div> : <p>Your result will appear here after you enter the record details.</p>}</section>
        </div>
      </section>}
      {screen === 'chart' && <section className="prediction-work-view prediction-chart-view">
        <div className="prediction-work-heading"><button className="button button-secondary button-small" onClick={() => setScreen('evaluation')}><ArrowLeft size={15}/> Back to evaluation</button><div><span className="predict-step-label">DATA VISUALIZATION</span><h2>Generate a chart</h2></div></div>
        <div className={`prediction-chart-layout${chart ? ' has-chart' : ''}`}>
          <ChartBuilder columns={profile.columns} chartType={chartType} setChartType={changeChartType} xColumn={xColumn} setXColumn={setXColumn} yColumn={yColumn} setYColumn={setYColumn} aggregation={aggregation} setAggregation={setAggregation} onGenerate={generateChart} busy={charting}/>
          {chart && <ChartRenderer chart={chart} datasetId={datasetId}/>}
        </div>
      </section>}
    </>}
    {error && <ErrorState message={error}/>}
  </div>;
}

const metricLabels = { accuracy: 'Accuracy', balanced_accuracy: 'Balanced accuracy', precision_weighted: 'Precision', recall_weighted: 'Recall', f1_weighted: 'F1 score', mae: 'MAE', mse: 'MSE', rmse: 'RMSE', r2: 'R²' };
function formatMetric(key, value) {
  if (value == null) return '—';
  const numeric = Number(value);
  return ['accuracy', 'balanced_accuracy', 'precision_weighted', 'recall_weighted', 'f1_weighted'].includes(key) ? `${(numeric * 100).toFixed(1)}%` : numeric.toLocaleString(undefined, { maximumFractionDigits: 3 });
}
function formatPrediction(value, task) { return task === 'classification' ? String(value) : Number(value).toLocaleString(undefined, { maximumFractionDigits: 3 }); }
