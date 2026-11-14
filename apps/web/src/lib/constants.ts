export const CATEGORIES = [
  "semua",
  "kemeja",
  "kaos",
  "jaket",
  "celana",
  "hoodie",
  "blouse",
  "sweater",
];
export const TOKEN_KEY = "wanttosell_token";
export const USER_KEY = "wanttosell_user";
export const CART_KEY = "wanttosell_cart";
export const FAVORITES_KEY = "wanttosell_favorites";
export const CART_SELECTION_KEY = "wanttosell_cart_selection";
export const ADDRESSES_KEY = "wanttosell_addresses";
export const ORDERS_KEY = "wanttosell_orders";
export const PAYMENTS_KEY = "wanttosell_payments";
// Terima bentuk env yang lazim ditulis: "backend.up.railway.app", "https://backend", atau "/api".
// Tanpa normalisasi, nilai tanpa skema dianggap path relatif oleh fetch dan request masuk ke
// domain frontend sendiri (SPA) sehingga respons HTML diparse sebagai data kosong.
const normalizeApiBaseUrl = (value: string | undefined) => {
  const raw = (value || "").trim();
  if (!raw) return "/api";
  if (raw.startsWith("/")) return raw.replace(/\/+$/, "") || "/api";
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  const base = withScheme.replace(/\/+$/, "");
  return /\/api$/i.test(base) ? base : `${base}/api`;
};

export const API_BASE_URL = normalizeApiBaseUrl(import.meta.env.VITE_API_BASE_URL);
export const USE_MOCK = import.meta.env.VITE_USE_MOCK !== "false";
export const STORE_LOCATION = "Yogyakarta, Indonesia";
