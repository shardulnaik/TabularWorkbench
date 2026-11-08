import { ArrowLeft, ArrowRight, BarChart3, CheckCheck, Download, FileSpreadsheet, Target } from 'lucide-react';

const stages = [
    { label: 'Your file', icon: FileSpreadsheet },
    { label: 'Data profile', icon: BarChart3 },
    { label: 'Choose target', icon: Target },
    { label: 'Predict or chart', icon: CheckCheck },
];

export function AboutPanel({ onBack }) {
    return <div className="about-overlay" role="dialog" aria-modal="true" aria-labelledby="about-title">
      <section className="about-content">
        <div className="about-heading">
          <div><h1 id="about-title">How this app works</h1><p>From your spreadsheet to model results and charts.</p></div>
          <button className="button button-secondary about-back" type="button" onClick={onBack}><ArrowLeft size={16}/> Back</button>
        </div>
        <div className="about-flow" aria-label="Workflow">
          {stages.map(({ label, icon: Icon }, index) => <div className="about-flow-part" key={label}>
            <div className="about-flow-step"><Icon size={20}/><strong>{label}</strong></div>
            {index < stages.length - 1 && <ArrowRight className="about-flow-arrow" size={17}/>}
          </div>)}
        </div>
        <ol className="about-steps">
          <li><strong>Upload a CSV or Excel file.</strong> The original upload is kept available in your results.</li>
          <li><strong>Review the data profile.</strong> See the row, column, and missing-cell summary after safe text cleanup.</li>
          <li><strong>Choose a target column.</strong> The app determines whether to use classification or regression.</li>
          <li><strong>Predict or chart.</strong> Enter one record in the generated form, or explore and download a chart from the same dataset.</li>
        </ol>
        <p className="about-note"><Download size={15}/> Charts describe the dataset and are available alongside predictions.</p>
      </section>
    </div>;
}
