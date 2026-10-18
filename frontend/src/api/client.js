const API_ORIGIN = import.meta.env.VITE_API_URL?.trim();
if (!API_ORIGIN) {
    throw new Error('VITE_API_URL is not configured. Set it to the backend origin before starting the frontend.');
}
export const API_BASE_URL = `${API_ORIGIN.replace(/\/+$/, '')}/api/v1`;
export class ApiError extends Error {
    status;
    constructor(message, status) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
    }
}
export async function apiRequest(path, init) {
    let response;
    try {
        response = await fetch(`${API_BASE_URL}${path}`, init);
    }
    catch {
        throw new ApiError('Could not reach the backend. Make sure FastAPI is running and the API URL is correct.', 0);
    }
    const contentType = response.headers.get('content-type') || '';
    const body = contentType.includes('application/json') ? await response.json().catch(() => ({})) : await response.text().catch(() => '');
    if (!response.ok) {
        const errorBody = (typeof body === 'object' && body !== null ? body : {});
        throw new ApiError(errorBody.detail || errorBody.message || `Request failed (${response.status}).`, response.status);
    }
    return body;
}
export function downloadUrl(path) {
    return `${API_BASE_URL}${path}`;
}
