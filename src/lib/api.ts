const API_URL = process.env.EXPO_PUBLIC_API_URL?.replace(/\/+$/, '');

export const getApiBaseUrl = () => API_URL;

export const getSocketServerUrl = () => {
  if (!API_URL) return '';
  const url = new URL(API_URL);
  url.pathname = url.pathname.replace(/\/api\/?$/, '').replace(/\/$/, '');
  return url.toString().replace(/\/$/, '');
};

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

type RequestOptions = Omit<RequestInit, 'headers'> & {
  token?: string | null;
  headers?: Record<string, string>;
  timeoutMs?: number;
};

export const apiRequest = async <T>(path: string, options: RequestOptions = {}): Promise<T> => {
  if (!API_URL) throw new Error('Set EXPO_PUBLIC_API_URL in mobile/.env before starting the app.');

  const { token, headers: extraHeaders, timeoutMs = 15000, ...requestOptions } = options;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const headers: Record<string, string> = { Accept: 'application/json', ...extraHeaders };
  if (requestOptions.body && !(requestOptions.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    const response = await fetch(`${API_URL}${path}`, {
      ...requestOptions,
      headers,
      signal: controller.signal
    });
    const responseText = await response.text();
    let payload: unknown = {};
    if (responseText) {
      try {
        payload = JSON.parse(responseText);
      } catch {
        throw new ApiError('The server returned an unreadable response.', response.status);
      }
    }
    if (!response.ok) {
      const message = typeof payload === 'object' && payload !== null && 'message' in payload && typeof payload.message === 'string'
        ? payload.message
        : 'The request could not be completed.';
      throw new ApiError(message, response.status);
    }
    return payload as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (controller.signal.aborted) throw new Error('The server request timed out. Check your connection and try again.');
    throw new Error('Could not reach the server. Check the API URL and network connection.');
  } finally {
    clearTimeout(timeout);
  }
};