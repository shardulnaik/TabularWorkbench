import { useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, Sparkles } from 'lucide-react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { getDataset, getProfile } from '../api/datasets';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';

export function DatasetOverviewPage() {
    const { datasetId = '' } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const [details, setDetails] = useState(null);
    const [profile, setProfile] = useState(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);

    const load = () => {
        setLoading(true);
        setError('');
        Promise.all([getDataset(datasetId), getProfile(datasetId)])
            .then(([newDetails, profileResponse]) => {
            setDetails(newDetails);
            setProfile(profileResponse.profile);
        })
            .catch((reason) => setError(reason instanceof Error ? reason.message : 'Could not load the dataset.'))
            .finally(() => setLoading(false));
    };

    useEffect(() => { load(); }, [datasetId]);

    if (loading)
        return <LoadingState label="Getting your data ready…"/>;
    if (error)
        return <ErrorState message={error} onRetry={load}/>;
    if (!details || !profile)
        return null;

    const autoCleaned = location.state?.autoCleaned;
    return <div className="page-stack page-stack-narrow dataset-ready">
      <div className="ready-icon"><CheckCircle2 size={25}/></div>
      <div className="ready-heading">
        <div className="eyebrow"><Sparkles size={13}/> READY TO EXPLORE</div>
        <h1>Your data is ready.</h1>
        <p>{details.filename}</p>
      </div>
      <div className="compact-stats" aria-label="Dataset summary">
        <div><strong>{profile.row_count.toLocaleString()}</strong><span>rows</span></div>
        <div><strong>{profile.column_count.toLocaleString()}</strong><span>columns</span></div>
        <div><strong>{profile.missing_cells.toLocaleString()}</strong><span>missing cells</span></div>
      </div>
      <p className="auto-clean-summary">{autoCleaned > 0
          ? `${autoCleaned} safe cleaning step(s) applied automatically. Your original file is unchanged.`
          : 'Safe cleaning checks complete. Your original file is unchanged.'}</p>
      <button className="button button-primary ready-proceed" onClick={() => navigate(`/datasets/${datasetId}/predict`)}>Proceed <ArrowRight size={17}/></button>
    </div>;
}
