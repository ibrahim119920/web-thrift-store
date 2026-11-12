const rupiah = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

export const formatRupiah = (value) => rupiah.format(value);

export const GRADE_LABEL = {
  A: "Seperti baru",
  B: "Bekas pakai ringan",
  C: "Ada minus",
};
