import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { UploadPage } from '../pages/UploadPage';
import { DatasetOverviewPage } from '../pages/DatasetOverviewPage';
import { CleaningPage } from '../pages/CleaningPage';
import { ExplorePage } from '../pages/ExplorePage';
import { PredictPage } from '../pages/PredictPage';
import { ResultsPage } from '../pages/ResultsPage';

export function AppRouter() {
  return <Routes><Route element={<AppShell />}>
    <Route path="/" element={<UploadPage />} />
    <Route path="/datasets/:datasetId" element={<DatasetOverviewPage />} />
    <Route path="/datasets/:datasetId/cleaning" element={<CleaningPage />} />
    <Route path="/datasets/:datasetId/explore" element={<ExplorePage />} />
    <Route path="/datasets/:datasetId/predict" element={<PredictPage />} />
    <Route path="/datasets/:datasetId/results" element={<ResultsPage />} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Route></Routes>;
}
