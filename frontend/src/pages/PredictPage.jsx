import { useEffect, useState } from 'react';
import { ArrowRight, LoaderCircle, CheckCircle2, XCircle } from 'lucide-react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { getProfile } from '../api/datasets';
import { compareModels, evaluateModel, clusterModels } from '../api/ml';
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
  const [features, setFeatures] = useState([]);
  const [clusters, setClusters] = useState(3);
  const [clusterResult, setClusterResult] = useState(null);
  const [comparison, setComparison] = useState(location.state?.comparisonResult || null);
  const [selectedModel, setSelectedModel] = useState(location.state?.selectedModel || 'logistic_regression');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showComparison, setShowComparison] = useState(Boolean(location.state?.comparisonView && location.state?.comparisonResult));

  const load = () => { setLoading(true); setError(''); getProfile(datasetId).then(({ profile: p }) => {
    setProfile(p);
    const good = p.columns.filter(c => c.target_eligibility?.classification?.applicable || c.target_eligibility?.regression?.applicable);
    const preferred = good.find(c => /attrition|churn|outcome|target|status|class/i.test(c.name)) || good[0];
    setTargetColumn(current => current || location.state?.targetColumn || preferred?.name || '');
    setFeatures(current => current.length ? current : p.columns.filter(c => c.is_feature_eligible).slice(0, 2).map(c => c.name));
  }).catch(e => setError(e instanceof Error ? e.message : 'Could not load dataset profile.')).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, [datasetId]);
  const target = profile?.columns.find(c => c.name === targetColumn);
  const eligibility = task === 'classification' || task === 'regression' ? target?.target_eligibility?.[task] : { applicable: true, reason: 'Clustering does not use a target column.' };
  const featureOptions = profile?.columns.filter(c => c.is_feature_eligible) || [];

  const compare = async () => {
    setBusy(true); setError(''); setComparison(null);
    try { const result = await compareModels(datasetId, { target_column: targetColumn, task_type: task, scoring_metric: task === 'regression' ? 'mae' : 'accuracy' }); setComparison(result); setSelectedModel(result.recommended_model); setShowComparison(true); }
    catch (e) { setError(e instanceof Error ? e.message : 'Model comparison failed.'); } finally { setBusy(false); }
  };
  const cluster = async () => {
    setBusy(true); setError(''); setClusterResult(null);
    try { setClusterResult(await clusterModels(datasetId, { feature_columns: features, n_clusters: Number(clusters) })); }
    catch (e) { setError(e instanceof Error ? e.message : 'Clustering failed.'); } finally { setBusy(false); }
  };
  const evaluate = async () => {
    if (!comparison) return;
    setBusy(true); setError('');
    try { const result = await evaluateModel(datasetId, comparison.model_run_id, selectedModel); navigate(`/datasets/${datasetId}/results?runId=${result.model_run_id}`, { state: { evaluation: result, comparisonResult: comparison, targetColumn, selectedModel, comparisonView: true } }); }
    catch (e) { setError(e instanceof Error ? e.message : 'Model evaluation failed.'); } finally { setBusy(false); }
  };
  if (loading) return <LoadingState label="Preparing machine learning options…"/>;
  if (error && !profile) return <ErrorState message={error} onRetry={load}/>;
  if (!profile) return null;
  return <div className="page-stack predict-page">
    {busy && <div className="processing-overlay" role="status"><div className="processing-card"><LoaderCircle className="processing-spinner" size={34}/><strong>Running {task}</strong><span>Preparing data and evaluating the selected workflow…</span></div></div>}
    <PageHeader title="Machine learning"/>
    {!showComparison && <section className="panel prediction-setup">
      <div className="field"><span>ML workflow</span><div className="target-compare-row">{['classification','regression','clustering'].map(t => <button key={t} className={`button ${task === t ? 'button-primary' : 'button-secondary'}`} onClick={() => { setTask(t); setComparison(null); setClusterResult(null); }}>{t[0].toUpperCase()+t.slice(1)}</button>)}</div></div>
      {task !== 'clustering' ? <>
        <label className="field"><span>Target column</span><select value={targetColumn} onChange={e => { setTargetColumn(e.target.value); setComparison(null); }}><option value="">Choose an eligible column</option>{profile.columns.filter(c => c.target_eligibility?.[task]?.applicable).map(c => <option key={c.name} value={c.name}>{c.name}</option>)}</select></label>
        <div className={`eligibility-status ${eligibility?.applicable ? 'eligible' : 'ineligible'}`} role="status">{eligibility?.applicable ? <CheckCircle2 size={18}/> : <XCircle size={18}/>}<span><strong>{task[0].toUpperCase()+task.slice(1)} {eligibility?.applicable ? 'applicable' : 'not applicable'}</strong> — {eligibility?.reason || (targetColumn ? 'Choose an eligible target.' : 'Choose a target column to see available tasks.')}</span></div>
        {target && <div className="eligibility-list">{['classification','regression'].map(t => { const info=target.target_eligibility[t]; return <span key={t}>{info.applicable ? '✓' : '×'} {t}: {info.applicable ? 'Applicable' : 'Unavailable'} — {info.reason}</span>; })}</div>}
        <button className="button button-primary" onClick={compare} disabled={busy || !eligibility?.applicable}>Compare {task} models <ArrowRight size={16}/></button>
      </> : <>
        <div className="field"><span>Input features</span><div className="feature-checkboxes">{featureOptions.map(c => <label key={c.name}><input type="checkbox" checked={features.includes(c.name)} onChange={e => setFeatures(old => e.target.checked ? [...old,c.name] : old.filter(x => x !== c.name))}/>{c.name}</label>)}</div></div>
        <label className="field"><span>Number of clusters</span><input type="number" min="2" max="20" value={clusters} onChange={e => setClusters(e.target.value)}/></label>
        <button className="button button-primary" onClick={cluster} disabled={busy || features.length < 2}>Run K-Means <ArrowRight size={16}/></button>
      </>}
    </section>}
    {error && <ErrorState message={error}/>}
    {showComparison && comparison && <section className="panel comparison-view"><div className="panel-heading"><div><h2>{task === 'regression' ? 'Regression model scores' : 'Classification model scores'}</h2><p>Target: {targetColumn}</p></div></div><ModelComparisonTable models={comparison.models} metric={task === 'regression' ? 'mae' : 'accuracy'} selectedModel={selectedModel} recommendedModel={comparison.recommended_model} onSelect={setSelectedModel}/><div className="panel-footer comparison-actions"><button className="button button-primary" onClick={evaluate} disabled={busy}>Evaluate selected model <ArrowRight size={16}/></button><button className="button button-secondary" onClick={() => setShowComparison(false)}>Change workflow</button></div></section>}
    {clusterResult && <section className="panel"><h2>K-Means results</h2><p>Cluster assignments for {clusterResult.feature_columns.join(', ')} · {clusterResult.n_clusters} clusters</p><div className="metrics-grid">{Object.entries(clusterResult.metrics).map(([key,value])=><div className="metric-card" key={key}><span>{key.replaceAll('_',' ')}</span><strong>{Number(value).toFixed(4)}</strong></div>)}</div><p>Rows by cluster: {Object.entries(clusterResult.cluster_counts).map(([k,v])=>`Cluster ${k}: ${v}`).join(' · ')}</p><div className="table-scroll"><table className="data-table"><thead><tr><th>Row</th><th>Cluster</th></tr></thead><tbody>{clusterResult.assignments.slice(0,100).map(row=><tr key={row.row_number}><td>{row.row_number}</td><td>{row.cluster}</td></tr>)}</tbody></table></div><p className="table-footnote">Showing the first 100 row assignments.</p></section>}
  </div>;
}
