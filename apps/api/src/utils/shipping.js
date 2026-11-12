// Perhitungan ongkos kirim otomatis di backend (tarif simulasi, bukan API kurir asli).
// Asal pengiriman: DI Yogyakarta. Tarif = (tarif dasar + tarif/kg x berat dibulatkan ke atas) x pengali zona.
const ORIGIN_PROVINCE = 'DI Yogyakarta';
const JAVA = ['DKI Jakarta', 'Jawa Barat', 'Jawa Tengah', 'DI Yogyakarta', 'Jawa Timur', 'Banten'];

const RATES = {
  jne: { reg: { base: 9000, perKg: 2500 }, yes: { base: 16000, perKg: 5000 } },
  jnt: { reg: { base: 8500, perKg: 2500 }, express: { base: 14000, perKg: 4500 } },
  sicepat: { reg: { base: 8000, perKg: 2000 }, best: { base: 15000, perKg: 4000 } },
};

const normalize = (s) => String(s || '').trim().toLowerCase();

function zoneMultiplier(province) {
  const p = normalize(province);
  if (p === normalize(ORIGIN_PROVINCE)) return 1;
  if (JAVA.some((j) => normalize(j) === p)) return 1.5;
  return 2.5;
}

function calculateShipping({ courier, service, province, weightGram }) {
  const rate = RATES[normalize(courier)]?.[normalize(service)];
  if (!rate) return null;
  const kg = Math.max(1, Math.ceil(weightGram / 1000));
  const raw = (rate.base + rate.perKg * kg) * zoneMultiplier(province);
  return Math.ceil(raw / 500) * 500;
}

const COURIERS = Object.fromEntries(Object.entries(RATES).map(([c, s]) => [c, Object.keys(s)]));

module.exports = { calculateShipping, COURIERS, ORIGIN_PROVINCE };
