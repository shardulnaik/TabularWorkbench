import { Navigate, useParams } from 'react-router-dom';

export function CleaningPage() {
    const { datasetId = '' } = useParams();
    return <Navigate to={`/datasets/${datasetId}`} replace/>;
}
