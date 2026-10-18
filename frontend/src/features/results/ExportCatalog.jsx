import { Download, FileJson, FileSpreadsheet, Table2, Workflow, FileUp } from 'lucide-react';
import { exportUrl } from '../../api/exports';
const items = [
    { key: 'original-upload', title: 'Original uploaded file', description: 'Byte-for-byte original upload, retained separately from cleaned data.', icon: FileUp, needsRun: false },
    { key: 'cleaned-data', title: 'Cleaned dataset', description: 'Current cleaned rows as CSV.', icon: FileSpreadsheet, needsRun: false },
    { key: 'data-profile', title: 'Data-quality report', description: 'Column types, missingness, warnings and statistics as JSON.', icon: FileJson, needsRun: false },
    { key: 'cleaning-log', title: 'Cleaning log', description: 'Recorded actions and affected cells or rows.', icon: Table2, needsRun: false },
    { key: 'chart-data', title: 'Chart data', description: 'Download the data behind the current chart from the chart page.', icon: Table2, needsRun: false, chartOnly: true },
    { key: 'model-comparison', title: 'Model comparison', description: 'Cross-validation metrics for each candidate model.', icon: Table2, needsRun: true },
    { key: 'model-metrics', title: 'Selected model metrics', description: 'Evaluation metrics, class report and model configuration.', icon: FileJson, needsRun: true },
    { key: 'confusion-matrix', title: 'Confusion matrix', description: 'Actual versus predicted class counts.', icon: Table2, needsRun: true },
    { key: 'predictions', title: 'Test predictions', description: 'Actual labels, predicted labels and available probabilities.', icon: FileSpreadsheet, needsRun: true },
    { key: 'model-pipeline', title: 'Selected model pipeline', description: 'Fitted Scikit-learn pipeline; only load artifacts you trust.', icon: Workflow, needsRun: true },
];
export function ExportCatalog({ datasetId, runId, chartRunId }) {
    return <div className="export-list">{items.filter((item) => !item.needsRun || runId).filter((item) => !item.chartOnly || chartRunId).map((item) => {
            const Icon = item.icon;
            return <a className="export-row" href={exportUrl(datasetId, item.key, { runId, chartRunId })} key={item.key}><span className="export-icon"><Icon size={19}/></span><span className="export-copy"><strong>{item.title}</strong><small>{item.description}</small></span><Download size={17} className="export-download"/></a>;
        })}
  </div>;
}
