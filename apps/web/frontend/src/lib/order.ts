import type { OrderStatus } from "../types";

export const orderStatusOptions: { value: OrderStatus; label: string }[] = [
  { value: "waiting_payment", label: "Menunggu bayar" },
  { value: "paid", label: "Dibayar" },
  { value: "processing", label: "Diproses" },
  { value: "shipped", label: "Dikirim" },
  { value: "completed", label: "Selesai" },
  { value: "cancelled", label: "Dibatalkan" },
];

export const orderStatusLabel = (status: OrderStatus) =>
  orderStatusOptions.find((option) => option.value === status)?.label || status;

export const orderStatusClass = (status: OrderStatus) => {
  if (status === "cancelled") return "bg-[#f4dddd] text-[#7d2626]";
  if (status === "completed") return "bg-ink text-white";
  if (status === "waiting_payment") return "bg-[#fff1bd] text-[#6e5100]";
  return "bg-lime text-ink";
};
