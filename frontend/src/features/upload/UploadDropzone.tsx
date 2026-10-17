import { useRef, useState } from 'react';
import { FileSpreadsheet, FolderUp } from 'lucide-react';

export function UploadDropzone({ onFile, disabled }: { onFile: (file: File) => void; disabled?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const acceptFile = (file?: File) => {
    if (!file) return;
    if (!/\.(csv|xlsx)$/i.test(file.name)) {
      window.alert('Please choose a .csv or .xlsx file.');
      return;
    }
    onFile(file);
  };
  return <div className={`upload-dropzone ${dragging ? 'dragging' : ''} ${disabled ? 'disabled' : ''}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); if (!disabled) acceptFile(event.dataTransfer.files[0]); }}>
    <input ref={inputRef} type="file" accept=".csv,.xlsx" hidden onChange={(event) => acceptFile(event.currentTarget.files?.[0])} />
    <div className="upload-icon"><FileSpreadsheet size={27} /></div>
    <h3>Drop your spreadsheet here</h3>
    <p>CSV or Excel (.xlsx), up to 20 MB</p>
    <button type="button" className="button button-primary" disabled={disabled} onClick={() => inputRef.current?.click()}><FolderUp size={17} /> Choose file</button>
    <span className="upload-footnote">Your original file is kept separately from any cleaned version.</span>
  </div>;
}
