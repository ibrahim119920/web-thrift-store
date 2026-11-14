import { USE_MOCK } from "../lib/constants";
import { ApiError, apiRequest } from "./api";

// Harus sama dengan ALLOWED_TYPES / MAX_IMAGE_BYTES di apps/api/src/services/storageService.js.
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
// Format object key S3 yang diterima API (products/<uuid>.<ext>).
export const isImageKey = (value: string) => /^products\/[0-9a-f-]{36}\.(jpg|png|webp)$/.test(value);

interface ProductImageUpload {
  key: string;
  uploadUrl: string;
  headers: Record<string, string>;
}

export function validateImageFile(file: File) {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) return "Foto harus berformat JPG, PNG, atau WebP.";
  if (file.size > MAX_IMAGE_BYTES) return "Ukuran foto maksimal 5 MB.";
  return "";
}

const readAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

// Upload foto produk: minta presigned URL ke API, lalu PUT file langsung ke S3.
// Mengembalikan object key yang dikirim di field `images` saat membuat/mengubah produk.
export async function uploadProductImage(file: File): Promise<string> {
  const invalid = validateImageFile(file);
  if (invalid) throw new ApiError(invalid, 400);
  if (USE_MOCK) return readAsDataUrl(file);

  const { data } = await apiRequest<ProductImageUpload>("/uploads/product-image", {
    method: "POST",
    body: JSON.stringify({ contentType: file.type, size: file.size }),
  });
  // Jangan kirim header Authorization ke S3; Content-Type wajib sama persis dengan yang ditandatangani.
  const response = await fetch(data.uploadUrl, { method: "PUT", headers: data.headers, body: file });
  if (!response.ok) throw new ApiError(`Upload foto ke S3 gagal (${response.status}).`, response.status);
  return data.key;
}
