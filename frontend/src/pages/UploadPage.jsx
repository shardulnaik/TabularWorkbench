import { useState } from 'react';
import { FileSpreadsheet } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { UploadDropzone } from '../features/upload/UploadDropzone';
import { ErrorState } from '../components/common/ErrorState';
import { uploadDataset } from '../api/datasets';
import { applyCleaning, getCleaningPlan } from '../api/cleaning';

export function UploadPage() {
    const navigate = useNavigate();
    const [file, setFile] = useState(null);
    const [sheetName, setSheetName] = useState('');
    const [sheets, setSheets] = useState([]);
    const [uploadedDatasetId, setUploadedDatasetId] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [busyLabel, setBusyLabel] = useState('');

    const finishDataset = async (datasetId) => {
        setBusy(true);
        setBusyLabel('Cleaning safe issues automatically…');
        setError('');
        try {
            const plan = await getCleaningPlan(datasetId);
            const result = plan.recommended_action_ids.length
                ? await applyCleaning(datasetId, plan.recommended_action_ids)
                : { actions_applied: [] };
            navigate(`/datasets/${datasetId}`, {
                state: { autoCleaned: result.actions_applied.length },
            });
        }
        catch (reason) {
            setError(reason instanceof Error ? reason.message : 'Automatic cleaning failed.');
        }
        finally {
            setBusy(false);
            setBusyLabel('');
        }
    };

    const processFile = async (chosenFile, selectedSheet) => {
        setBusy(true);
        setBusyLabel('Uploading your file…');
        setError('');
        setUploadedDatasetId('');
        try {
            const result = await uploadDataset(chosenFile, selectedSheet);
            if (result.requires_sheet_selection) {
                setFile(chosenFile);
                setSheets(result.available_sheets || []);
                setSheetName(result.available_sheets?.[0] || '');
                return;
            }
            if (!result.session_id)
                throw new Error('The backend did not return a dataset session.');
            setUploadedDatasetId(result.session_id);
            await finishDataset(result.session_id);
        }
        catch (reason) {
            setError(reason instanceof Error ? reason.message : 'Upload failed. Please try again.');
        }
        finally {
            setBusy(false);
            setBusyLabel('');
        }
    };

    const onFile = (chosenFile) => {
        setFile(chosenFile);
        setSheets([]);
        setSheetName('');
        void processFile(chosenFile);
    };

    const retry = () => {
        if (uploadedDatasetId)
            void finishDataset(uploadedDatasetId);
        else if (file)
            void processFile(file, sheetName || undefined);
    };

    return <div className="upload-page upload-page-simple">
      <section className="upload-intro">
        <div className="upload-symbol" aria-hidden="true"><FileSpreadsheet size={56} strokeWidth={1.35}/></div>
      </section>

      <section className="upload-card">
        <div className="upload-card-heading"><h2>Upload your data</h2></div>
        <UploadDropzone onFile={onFile} disabled={busy}/>
        {busy && <div className="upload-status"><span className="spinner-dot"/> {busyLabel}</div>}
        {error && <ErrorState message={error} onRetry={retry}/>}
        {sheets.length > 0 && file && <div className="sheet-select-panel"><label className="field"><span>Choose a sheet</span><select value={sheetName} onChange={(event) => setSheetName(event.target.value)}>{sheets.map((sheet) => <option value={sheet} key={sheet}>{sheet}</option>)}</select></label><button className="button button-primary" disabled={busy || !sheetName} onClick={() => void processFile(file, sheetName)}>Continue</button></div>}
        <div className="upload-card-footer"><span>Your original file is never changed.</span></div>
      </section>
    </div>;
}
