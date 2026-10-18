import { useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { getDataset, getProfile } from '../api/datasets';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';

export function DatasetOverviewPage() {
    const { datasetId = '' } = useParams();
    const navigate = useNavigate();
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

    return <div className="page-stack page-stack-narrow dataset-ready">
      <div className="ready-icon"><CheckCircle2 size={25}/></div>
      <div className="ready-heading">
        <h1>Data ready</h1>
        <p>{details.filename}</p>
      </div>
      <div className="compact-stats" aria-label="Dataset summary">
        <div><strong>{profile.row_count.toLocaleString()}</strong><span>rows</span></div>
        <div><strong>{profile.column_count.toLocaleString()}</strong><span>columns</span></div>
        <div><strong>{profile.missing_cells.toLocaleString()}</strong><span>missing cells</span></div>
      </div>
      <button className="button button-primary ready-proceed" onClick={() => navigate(`/datasets/${datasetId}/predict`)}>Continue <ArrowRight size={17}/></button>
    </div>;
}
