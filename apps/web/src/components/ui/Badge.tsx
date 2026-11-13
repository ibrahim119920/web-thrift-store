import type { OrderStatus, PaymentStatus, ProductStatus } from "../../types";

const labels: Record<ProductStatus | OrderStatus | PaymentStatus, string> = {
  available: "Tersedia",
  reserved: "Sedang diproses pembeli lain",
  sold: "Terjual",
  waiting_payment: "Menunggu pembayaran",
  paid: "Dibayar",
  processing: "Diproses",
  shipped: "Dikirim",
  completed: "Selesai",
  cancelled: "Dibatalkan",
  pending: "Menunggu",
  success: "Berhasil",
  failed: "Gagal",
  expired: "Kedaluwarsa",
};

export function Badge({ status }: { status: keyof typeof labels }) {
  const tone = ["available", "paid", "success", "completed"].includes(status)
    ? "bg-lime"
    : ["sold", "failed", "cancelled", "expired"].includes(status)
      ? "bg-red-100 text-red-700"
      : "bg-amber-100 text-amber-800";
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${tone}`}>
      {labels[status]}
    </span>
  );
}
