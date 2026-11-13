export const formatRupiah = (value: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);

export const formatTanggal = (value: string | Date) =>
  new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" }).format(
    new Date(value),
  );

export const formatSize = (chest: number, length?: number) =>
  `LD ${chest} cm${length ? ` · PB ${length} cm` : ""}`;
