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
  const contentType = response.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const body = (isJson ? await response.json().catch(() => ({})) : {}) as ApiResponse<T> & ApiErrorBody;

  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      window.dispatchEvent(new Event("auth:unauthorized"));
    }
    const issues = Array.isArray(body.errors) ? body.errors : [];
    throw new ApiError(
      body.message || `Permintaan gagal (${response.status}).`,
      response.status,
      Object.fromEntries(issues.map((item) => [item.field, item.message])),
    );
  }

  // Respons 200 tapi bukan JSON / tanpa `data` biasanya berarti request /api diarahkan ke
  // halaman frontend (SPA rewrite). Jangan dikembalikan, karena pemanggil akan crash saat `.map`.
  if (!isJson || !body || typeof body !== "object" || !("data" in body)) {
    throw new ApiError(
      body?.message ||
        `Respons API tidak valid (${response.status} ${contentType || "tanpa content-type"}) dari ${API_BASE_URL}. ` +
          `Pastikan VITE_API_BASE_URL mengarah ke backend (contoh https://<backend>.up.railway.app/api), bukan domain frontend.`,
      502,
    );
  }

  return body;
}

export const mockResponse = <T>(data: T, message = "Berhasil"): Promise<ApiResponse<T>> =>
  Promise.resolve({ success: true, message, data });
