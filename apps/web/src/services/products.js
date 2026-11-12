const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

/**
 * Mengambil produk terbaru yang masih tersedia.
 * Mengembalikan null bila API tidak bisa dihubungi, supaya halaman tetap tampil.
 * @param {number} limit
 */
export async function getLatestProducts(limit = 8) {
  try {
    const res = await fetch(`${API_URL}/products?limit=${limit}&sort=newest`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    const body = await res.json();
    return Array.isArray(body.data) ? body.data : null;
  } catch {
    return null;
  }
}
