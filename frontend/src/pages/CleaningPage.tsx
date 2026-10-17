import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, ShieldCheck } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { applyCleaning, getCleaningPlan } from '../api/cleaning';
import { PageHeader } from '../components/layout/PageHeader';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';
import { CleaningPlan } from '../features/cleaning/CleaningPlan';
import { CleaningLog } from '../features/cleaning/CleaningLog';
import type { CleaningPlan as CleaningPlanType } from '../types/dataset';

export function CleaningPage() {
  const { datasetId = '' } = useParams();
  const navigate = useNavigate();
  const [plan, setPlan] = useState<CleaningPlanType | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ actions_applied: string[]; cleaning_log: { action_id?: string; title?: string; rows_affected?: number; details?: Record<string, unknown> }[] } | null>(null);

  const load = () => {
    setLoading(true); setError('');
    getCleaningPlan(datasetId).then((newPlan) => { setPlan(newPlan); setSelected(newPlan.recommended_action_ids); }).catch((reason) => setError(reason instanceof Error ? reason.message : 'Could not load the cleaning plan.')).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [datasetId]);

  const toggle = (id: string) => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const apply = async () => {
    setBusy(true); setError('');
    try {
      const response = await applyCleaning(datasetId, selected);
      setResult({ actions_applied: response.actions_applied, cleaning_log: response.cleaning_log as { action_id?: string; title?: string; rows_affected?: number; details?: Record<string, unknown> }[] });
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Cleaning failed.'); }
    finally { setBusy(false); }
  };

  if (loading) return <LoadingState label="Preparing your cleaning recommendations…" />;
  if (error && !plan) return <ErrorState message={error} onRetry={load} />;
  if (!plan) return null;

  return <div className="page-stack page-stack-narrow">
    <PageHeader eyebrow="STEP 02 · CLEANING" title="Clean carefully, with a record." description="Choose which recommended actions to apply. We keep the original upload separately and log every applied operation." />
    <div className="safety-callout"><ShieldCheck size={22} /><div><strong>Your original data is preserved.</strong><p>Cleaning creates a separate working version. You can download the change log and compare the profile before and after.</p></div></div>
    <section className="panel"><div className="panel-heading"><div><h2>Recommended cleaning</h2><p>Safe text normalization is selected by default. More consequential actions require your choice.</p></div></div><CleaningPlan plan={plan} selected={selected} onToggle={toggle} /><div className="panel-footer"><span className="muted-copy">{selected.length} action(s) selected</span><button className="button button-primary" onClick={apply} disabled={busy}>{busy ? 'Applying changes…' : 'Apply selected cleaning'} <ArrowRight size={16} /></button></div></section>
    {error && <ErrorState message={error} />}
    {result && <section className="panel success-panel"><div className="success-heading"><CheckCircle2 size={21} /><div><h2>Cleaning applied</h2><p>{result.actions_applied.length} action(s) processed. Review the log below.</p></div></div><CleaningLog items={result.cleaning_log} /><button className="button button-primary" onClick={() => navigate(`/datasets/${datasetId}`)}>Continue to analysis <ArrowRight size={16} /></button></section>}
    {!result && <div className="page-bottom-actions"><Link to={`/datasets/${datasetId}`} className="button button-ghost"><ArrowLeft size={16} /> Back to dataset health</Link><button className="button button-secondary" onClick={() => navigate(`/datasets/${datasetId}`)}>Skip cleaning</button></div>}
  </div>;
}
