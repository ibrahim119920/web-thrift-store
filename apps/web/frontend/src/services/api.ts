import { API_BASE_URL, TOKEN_KEY, USE_MOCK } from "../lib/constants";
import type { ApiErrorBody, ApiResponse } from "../types";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public errors: Record<string, string> = {},
  ) {
    super(message);
  }
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<ApiResponse<T>> {
  if (USE_MOCK) throw new ApiError("Gunakan service mock untuk permintaan ini.", 501);
  const token = localStorage.getItem(TOKEN_KEY);
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  const body = (await response.json().catch(() => ({}))) as ApiResponse<T> & ApiErrorBody;
  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      window.dispatchEvent(new Event("auth:unauthorized"));
    }
    throw new ApiError(
      body.message || "Terjadi kesalahan. Coba lagi.",
      response.status,
      Object.fromEntries((body.errors || []).map((item) => [item.field, item.message])),
    );
  }
  return body;
}

export const mockResponse = <T>(data: T, message = "Berhasil"): Promise<ApiResponse<T>> =>
  Promise.resolve({ success: true, message, data });
