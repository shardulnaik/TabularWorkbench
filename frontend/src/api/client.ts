import type { ApiErrorShape } from '../types/common';

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api/v1').replace(/\/$/, '');

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, init);
  } catch {
    throw new ApiError('Could not reach the backend. Make sure FastAPI is running and the API URL is correct.', 0);
  }
  const contentType = response.headers.get('content-type') || '';
  const body = contentType.includes('application/json') ? await response.json().catch(() => ({})) : await response.text().catch(() => '');
  if (!response.ok) {
    const errorBody = (typeof body === 'object' && body !== null ? body : {}) as ApiErrorShape;
    throw new ApiError(errorBody.detail || errorBody.message || `Request failed (${response.status}).`, response.status);
  }
  return body as T;
}

export function downloadUrl(path: string): string {
  return `${API_BASE_URL}${path}`;
}
