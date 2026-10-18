import { apiRequest } from './client';
export async function uploadDataset(file, sheetName) {
    const form = new FormData();
    form.append('file', file);
    if (sheetName)
        form.append('sheet_name', sheetName);
    return apiRequest('/datasets/upload', { method: 'POST', body: form });
}
export async function getDataset(datasetId) {
    return apiRequest(`/datasets/${encodeURIComponent(datasetId)}`);
}
export async function getProfile(datasetId) {
    return apiRequest(`/datasets/${encodeURIComponent(datasetId)}/profile`);
}
