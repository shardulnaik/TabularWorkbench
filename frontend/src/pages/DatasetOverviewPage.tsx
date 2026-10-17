import { useEffect, useState } from 'react';
import { ArrowRight, BarChart3, BrainCircuit, ClipboardCheck, Download, Sparkles } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { getDataset, getProfile } from '../api/datasets';
import { getCleaningPlan } from '../api/cleaning';
import { PageHeader } from '../components/layout/PageHeader';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';
import { StatusPill } from '../components/common/StatusPill';
import { ProfileSummary } from '../features/overview/ProfileSummary';
import { DatasetPreview } from '../features/overview/DatasetPreview';
import type { DatasetDetails, DatasetProfile, CleaningPlan } from '../types/dataset';

export function DatasetOverviewPage() {
  const { datasetId = '' } = useParams();
  const navigate = useNavigate();
  const [details, setDetails] = useState<DatasetDetails | null>(null);
  const [profile, setProfile] = useState<DatasetProfile | null>(null);
  const [plan, setPlan] = useState<CleaningPlan | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const load = () => {
    setLoading(true); setError('');
    Promise.all([getDataset(datasetId), getProfile(datasetId), getCleaningPlan(datasetId)])
      .then(([newDetails, profileResponse, newPlan]) => { setDetails(newDetails); setProfile(profileResponse.profile); setPlan(newPlan); })
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Could not load the dataset profile.'))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [datasetId]);

  if (loading) return <LoadingState label="Analyzing your dataset health…" />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!details || !profile || !plan) return null;

  const recommendationCount = plan.actions.filter((action) => action.available).length;
  return <div className="page-stack">
    <PageHeader eyebrow="STEP 01 · DATASET HEALTH" title="Here's what we found." description={`A first look at ${details.filename}. Review data-quality issues before exploring or training a model.`} action={<StatusPill tone="info">{details.row_count.toLocaleString()} rows</StatusPill>} />
    <ProfileSummary profile={profile} />
    <section className="panel quality-panel"><div className="panel-heading"><div><div className="eyebrow">RECOMMENDED NEXT STEP</div><h2>Review data cleaning</h2><p>{recommendationCount ? `${recommendationCount} cleaning option(s) are available for review.` : 'No obvious cleaning changes are currently recommended.'}</p></div><span className="panel-icon"><ClipboardCheck size={23} /></span></div>
      <div className="recommendation-chips">{plan.actions.filter((action) => action.available).slice(0, 4).map((action) => <div className="recommendation-chip" key={action.id}><span className={action.recommended ? 'chip-dot dot-green' : 'chip-dot dot-amber'} />{action.title}<small>{action.estimated_cells_or_rows.toLocaleString()}</small></div>)}{!recommendationCount && <p className="muted-copy">The dataset looks ready to explore. You can still review the profile or continue directly.</p>}</div>
      <div className="panel-actions"><button className="button button-primary" onClick={() => navigate(`/datasets/${datasetId}/cleaning`)}>Review cleaning plan <ArrowRight size={16} /></button><a className="button button-secondary" href={`/api/v1/datasets/${datasetId}/exports/data-profile`} onClick={(event) => { event.preventDefault(); window.open(`${import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api/v1'}/datasets/${datasetId}/exports/data-profile`, '_blank', 'noopener,noreferrer'); }}><Download size={16} /> Download profile</a></div>
    </section>
    <DatasetPreview profile={profile} />
    <div className="section-title-row"><div><div className="eyebrow">YOUR NEXT MOVE</div><h2>Choose how to continue</h2><p>The chart and prediction workflows use the same cleaned dataset, independently.</p></div><Sparkles size={21} className="subtle-icon" /></div>
    <div className="branch-grid"><button className="branch-card" onClick={() => navigate(`/datasets/${datasetId}/explore`)}><span className="branch-icon branch-blue"><BarChart3 size={23} /></span><span className="branch-copy"><strong>Explore statistics & charts</strong><small>Inspect distributions, compare columns and create downloadable charts.</small></span><ArrowRight size={18} /></button><button className="branch-card" onClick={() => navigate(`/datasets/${datasetId}/predict`)}><span className="branch-icon branch-purple"><BrainCircuit size={23} /></span><span className="branch-copy"><strong>Build a prediction model</strong><small>Choose a target, compare classifiers and evaluate the model you select.</small></span><ArrowRight size={18} /></button></div>
    <div className="quiet-note"><Sparkles size={16} /><span>Only selected cleaning actions will be applied. Your original upload remains separate and is never overwritten.</span></div>
  </div>;
}
