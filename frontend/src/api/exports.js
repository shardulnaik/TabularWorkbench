import { downloadUrl } from './client';
export function exportUrl(datasetId, exportType, options) {
    const params = new URLSearchParams();
    if (options?.runId)
        params.set('run_id', options.runId);
    if (options?.chartRunId)
        params.set('chart_run_id', options.chartRunId);
    const query = params.toString();
    return downloadUrl(`/datasets/${encodeURIComponent(datasetId)}/exports/${encodeURIComponent(exportType)}${query ? `?${query}` : ''}`);
}
