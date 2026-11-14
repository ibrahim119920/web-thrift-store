import { USE_MOCK } from "../lib/constants";
import type { User } from "../types";
import { ApiError, apiRequest, mockResponse } from "./api";
import { mockUsers } from "./mock/data";

type AuthResult = { token: string; user: User };

// Backend mengembalikan data flat: { ...user, token }. Frontend memakai { token, user }.
// Normalisasi di satu tempat agar kedua bentuk diterima.
const toAuthResult = (payload: unknown): AuthResult => {
  const data = payload as (Partial<AuthResult> & Partial<User>) | null;
  if (data?.user?.role && data.token) return { token: data.token, user: data.user as User };
  if (data?.token) {
    const { token, ...user } = data as unknown as User & { token: string };
    return { token, user: user as User };
  }
  throw new ApiError("Respons autentikasi tidak valid. Coba lagi.", 502);
};

export async function loginRequest(email: string, password: string) {
  if (!USE_MOCK)
    return apiRequest<User & { token: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }).then((response) => ({ ...response, data: toAuthResult(response.data) }));
  const user = mockUsers.find((item) => item.email === email);
  if (!user || password !== "password") throw new ApiError("Email atau kata sandi salah", 401);
  return mockResponse({ token: `mock-${user.role}-token`, user }, "Berhasil masuk");
}

export async function registerRequest(input: {
  name: string;
  email: string;
  phone: string;
  password: string;
}) {
  if (!USE_MOCK)
    return apiRequest<User & { token: string }>("/auth/register", {
      method: "POST",
      body: JSON.stringify(input),
    }).then((response) => ({ ...response, data: toAuthResult(response.data) }));
  if (mockUsers.some((user) => user.email === input.email))
    throw new ApiError("Email sudah terdaftar", 409, { email: "Email sudah terdaftar" });
  const user: User = {
    _id: `buyer-${Date.now()}`,
    name: input.name,
    email: input.email,
    phone: input.phone,
    role: "buyer",
  };
  return mockResponse({ token: "mock-buyer-token", user }, "Akun berhasil dibuat");
}

export const getMe = () => (USE_MOCK ? mockResponse(mockUsers[0]) : apiRequest<User>("/auth/me"));
