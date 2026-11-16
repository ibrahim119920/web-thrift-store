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

export type MeasurementLabels = {
  first: { name: string; short: string };
  second: { name: string; short: string };
};

const TOP: MeasurementLabels = {
  first: { name: "Lebar dada", short: "LD" },
  second: { name: "Panjang badan", short: "PB" },
};
const BOTTOM: MeasurementLabels = {
  first: { name: "Lingkar pinggang", short: "LP" },
  second: { name: "Panjang celana", short: "PC" },
};

/** Label ukuran mengikuti jenis barang; nilainya tetap disimpan di size.chest / size.length. */
export const getMeasurementLabels = (category?: string): MeasurementLabels =>
  category?.toLowerCase() === "celana" ? BOTTOM : TOP;

export const formatSize = (chest: number, length?: number, category?: string) => {
  const labels = getMeasurementLabels(category);
  return `${labels.first.short} ${chest} cm${length ? ` · ${labels.second.short} ${length} cm` : ""}`;
};
