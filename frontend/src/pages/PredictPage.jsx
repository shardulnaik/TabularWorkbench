import { useEffect, useState } from 'react';
import { ArrowRight, LoaderCircle, CheckCircle2, XCircle } from 'lucide-react';
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
  const [task, setTask] = useState('classification');
  const [targetColumn, setTargetColumn] = useState('');
  const [comparison, setComparison] = useState(location.state?.comparisonResult || null);
  const [selectedModel, setSelectedModel] = useState(location.state?.selectedModel || 'logistic_regression');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showComparison, setShowComparison] = useState(Boolean(location.state?.comparisonView && location.state?.comparisonResult));

  const load = () => {
    setLoading(true);
    setError('');
    getProfile(datasetId).then(({ profile: p }) => {
      setProfile(p);
      const eligible = p.columns.filter(c => c.target_eligibility?.classification?.applicable || c.target_eligibility?.regression?.applicable);
      const preferred = eligible.find(c => /attrition|churn|outcome|target|status|class/i.test(c.name)) || eligible[0];
      setTargetColumn(current => current || location.state?.targetColumn || preferred?.name || '');
    }).catch(e => setError(e instanceof Error ? e.message : 'Could not load dataset profile.')).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [datasetId]);

  const target = profile?.columns.find(c => c.name === targetColumn);
  const eligibility = target?.target_eligibility?.[task];
  const compare = async () => {
    setBusy(true); setError(''); setComparison(null);
    try {
      const result = await compareModels(datasetId, { target_column: targetColumn, task_type: task, scoring_metric: task === 'regression' ? 'mae' : 'accuracy' });
      setComparison(result); setSelectedModel(result.recommended_model); setShowComparison(true);
    } catch (e) { setError(e instanceof Error ? e.message : 'Model comparison failed.'); }
    finally { setBusy(false); }
  };
  const evaluate = async () => {
    if (!comparison) return;
    setBusy(true); setError('');
    try {
      const result = await evaluateModel(datasetId, comparison.model_run_id, selectedModel);
      navigate(`/datasets/${datasetId}/results?runId=${result.model_run_id}`, { state: { evaluation: result, comparisonResult: comparison, targetColumn, selectedModel, comparisonView: true } });
    } catch (e) { setError(e instanceof Error ? e.message : 'Model evaluation failed.'); }
    finally { setBusy(false); }
  };

  if (loading) return <LoadingState label="Preparing model options…"/>;
  if (error && !profile) return <ErrorState message={error} onRetry={load}/>;
  if (!profile) return null;
  return <div className="page-stack predict-page">
    {busy && <div className="processing-overlay" role="status"><div className="processing-card"><LoaderCircle className="processing-spinner" size={34}/><strong>{showComparison ? 'Evaluating selected model' : 'Comparing models'}</strong><span>{showComparison ? 'Calculating the held-out results…' : 'This can take a little while. Please keep this page open.'}</span></div></div>}
    <PageHeader title={showComparison ? 'Compare models' : 'Model prediction'}/>
    {!showComparison && <section className="panel prediction-setup">
      <div className="field"><span>ML workflow</span><div className="target-compare-row">{['classification','regression'].map(t => <button key={t} className={`button ${task === t ? 'button-primary' : 'button-secondary'}`} onClick={() => { setTask(t); setComparison(null); setShowComparison(false); }}>{t[0].toUpperCase()+t.slice(1)}</button>)}</div></div>
      <label className="field"><span>Prediction target</span><select value={targetColumn} onChange={e => { setTargetColumn(e.target.value); setComparison(null); }}><option value="">Choose an eligible column</option>{profile.columns.filter(c => c.target_eligibility?.[task]?.applicable).map(c => <option key={c.name} value={c.name}>{c.name}</option>)}</select></label>
      <div className={`eligibility-status ${eligibility?.applicable ? 'eligible' : 'ineligible'}`} role="status">{eligibility?.applicable ? <CheckCircle2 size={18}/> : <XCircle size={18}/>}<span><strong>{task === 'classification' ? 'Classification' : 'Regression'} {eligibility?.applicable ? 'applicable' : 'not applicable'}</strong> — {eligibility?.reason || (targetColumn ? 'Choose an eligible target.' : 'Choose a target column to see which task applies.')}</span></div>
      {target && <div className="eligibility-list">{['classification','regression'].map(t => { const info = target.target_eligibility[t]; return <span key={t}>{info.applicable ? '✓' : '×'} {t}: {info.applicable ? 'Applicable' : 'Unavailable'} — {info.reason}</span>; })}</div>}
      <button className="button button-primary" onClick={compare} disabled={busy || !eligibility?.applicable}>Compare models <ArrowRight size={16}/></button>
    </section>}
    {error && <ErrorState message={error}/>}
    {showComparison && comparison && <section className="panel comparison-view"><div className="panel-heading"><div><h2>{task === 'regression' ? 'Regression model scores' : 'Classification model scores'}</h2><p>Results for {targetColumn}</p></div></div><ModelComparisonTable models={comparison.models} metric={task === 'regression' ? 'mae' : 'accuracy'} selectedModel={selectedModel} recommendedModel={comparison.recommended_model} onSelect={setSelectedModel}/><div className="panel-footer comparison-actions"><button className="button button-primary" onClick={evaluate} disabled={busy}>Proceed with this model <ArrowRight size={16}/></button></div></section>}
  </div>;
}
