import { useState } from 'react';
import { ArrowRight, Database, ShieldCheck, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/layout/PageHeader';
import { UploadDropzone } from '../features/upload/UploadDropzone';
import { ErrorState } from '../components/common/ErrorState';
import { uploadDataset } from '../api/datasets';
import type { UploadResult } from '../types/dataset';

const sampleCsv = `EmployeeID,Age,MonthlyIncome,YearsAtCompany,OverTime,Department,Attrition
E001,24,32000,1,Yes,Sales,Yes
E002,31,52000,6,No,Research,No
E003,28,41000,3,Yes,Sales,Yes
E004,45,78000,15,No,Research,No
E005,36,61000,9,No,Operations,No
E006,26,35000,2,Yes,Sales,Yes
E007,41,72000,12,No,Research,No
E008,29,44000,4,Yes,Operations,Yes
E009,33,56000,7,No,Research,No
E010,38,66000,11,No,Sales,No
E011,25,33000,1,Yes,Operations,Yes
E012,47,81000,18,No,Research,No
E013,30,47000,5,Yes,Sales,Yes
E014,42,75000,14,No,Operations,No
E015,27,39000,2,Yes,Research,Yes
E016,39,69000,10,No,Sales,No
E017,34,58000,8,No,Operations,No
E018,23,30000,1,Yes,Sales,Yes
E019,46,80000,16,No,Research,No
E020,32,50000,6,Yes,Operations,Yes
E021,37,64000,9,No,Research,No
E022,29,43000,4,Yes,Sales,Yes
E023,44,76000,13,No,Operations,No
E024,35,59000,7,No,Research,No
E025,26,36000,2,Yes,Sales,Yes
E026,40,71000,12,No,Operations,No
E027,31,49000,5,Yes,Research,Yes
E028,43,77000,14,No,Sales,No
E029,28,42000,3,Yes,Operations,Yes
E030,48,84000,19,No,Research,No`;

export function UploadPage() {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [sheetName, setSheetName] = useState('');
  const [sheets, setSheets] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const processFile = async (chosenFile: File, selectedSheet?: string) => {
    setBusy(true); setError('');
    try {
      const result: UploadResult = await uploadDataset(chosenFile, selectedSheet);
      if (result.requires_sheet_selection) {
        setFile(chosenFile); setSheets(result.available_sheets || []); setSheetName(result.available_sheets?.[0] || '');
        return;
      }
      if (!result.session_id) throw new Error('The backend did not return a dataset session.');
      navigate(`/datasets/${result.session_id}`);
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Upload failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const onFile = (chosenFile: File) => {
    setFile(chosenFile); setSheets([]); setSheetName('');
    void processFile(chosenFile);
  };

  const trySample = () => {
    const sample = new File([sampleCsv], 'employee-attrition-sample.csv', { type: 'text/csv' });
    setFile(sample); setSheets([]); setSheetName('');
    void processFile(sample);
  };

  return <div className="upload-page">
    <div className="hero-copy"><div className="eyebrow"><Sparkles size={14} /> YOUR DATA, MADE CLEAR</div><h1>From spreadsheet<br /><span>to understanding.</span></h1><p>Profile your data, make careful cleaning decisions, explore useful charts, and compare prediction models—all in one guided workflow.</p>
      <div className="hero-points"><span><ShieldCheck size={16} /> Original data preserved</span><span><Database size={16} /> Reproducible results</span></div>
    </div>
    <div className="upload-card"><PageHeader eyebrow="START AN ANALYSIS" title="Analyze your spreadsheet" description="Upload a CSV or Excel file to begin. No code or configuration required." />
      <UploadDropzone onFile={onFile} disabled={busy} />
      {busy && <div className="upload-status"><span className="spinner-dot" /> {file ? `Preparing ${file.name}…` : 'Preparing dataset…'}</div>}
      {error && <ErrorState message={error} onRetry={() => file && void processFile(file, sheetName || undefined)} />}
      {sheets.length > 0 && file && <div className="sheet-select-panel"><label className="field"><span>This workbook has multiple sheets. Choose one to analyze.</span><select value={sheetName} onChange={(event) => setSheetName(event.target.value)}>{sheets.map((sheet) => <option value={sheet} key={sheet}>{sheet}</option>)}</select></label><button className="button button-primary" disabled={busy || !sheetName} onClick={() => void processFile(file, sheetName)}>Analyze selected sheet <ArrowRight size={16} /></button></div>}
      <div className="upload-card-footer"><span>Supported: .csv, .xlsx</span><button className="text-button" onClick={trySample} disabled={busy}>Try a sample dataset <ArrowRight size={14} /></button></div>
    </div>
    <div className="feature-strip"><div><span className="feature-number">01</span><strong>Understand data quality</strong><p>Find missing values, duplicates and potential problems before analysis.</p></div><div><span className="feature-number">02</span><strong>Explore without code</strong><p>Build charts using only columns compatible with the selected chart type.</p></div><div><span className="feature-number">03</span><strong>Compare, don't guess</strong><p>Evaluate a simple baseline beside two practical classification models.</p></div></div>
  </div>;
}
