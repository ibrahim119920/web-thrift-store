import { Button } from "../ui/Button";
import { Select } from "../ui/Select";

export interface CatalogFilters {
  brand: string;
  minPrice: string;
  maxPrice: string;
  minChest: string;
  maxChest: string;
  minLength: string;
  maxLength: string;
}

export const defaultFilters: CatalogFilters = {
  brand: "",
  minPrice: "",
  maxPrice: "",
  minChest: "",
  maxChest: "",
  minLength: "",
  maxLength: "",
};

interface Props {
  value: CatalogFilters;
  brands: string[];
  onChange: (value: CatalogFilters) => void;
  onApply: () => void;
  onReset: () => void;
}

export function FilterPanel({ value, brands, onChange, onApply, onReset }: Props) {
  const update = (key: keyof CatalogFilters, next: string) => onChange({ ...value, [key]: next });

  return (
    <div className="space-y-5">
      <Select
        label="Brand"
        value={value.brand}
        onChange={(event) => update("brand", event.target.value)}
        options={[
          { label: "Semua brand", value: "" },
          ...brands.map((brand) => ({ label: brand, value: brand })),
        ]}
      />
      <RangeFields
        label="Rentang harga (Rp)"
        min={value.minPrice}
        max={value.maxPrice}
        onMin={(next) => update("minPrice", next)}
        onMax={(next) => update("maxPrice", next)}
      />
      <RangeFields
        label="Lebar dada (cm)"
        min={value.minChest}
        max={value.maxChest}
        onMin={(next) => update("minChest", next)}
        onMax={(next) => update("maxChest", next)}
      />
      <RangeFields
        label="Panjang badan (cm)"
        min={value.minLength}
        max={value.maxLength}
        onMin={(next) => update("minLength", next)}
        onMax={(next) => update("maxLength", next)}
      />
      <div className="grid grid-cols-2 gap-2">
        <Button onClick={onApply}>Terapkan</Button>
        <button
          type="button"
          onClick={onReset}
          className="min-h-11 border-2 border-ink px-4 text-sm font-bold"
        >
          Reset
        </button>
      </div>
      <div className="rounded-lg bg-lime p-3 text-xs leading-relaxed">
        <strong className="block">Stok tunggal.</strong>
        Setiap item hanya tersedia satu.
      </div>
    </div>
  );
}

function RangeFields({
  label,
  min,
  max,
  onMin,
  onMax,
}: {
  label: string;
  min: string;
  max: string;
  onMin: (value: string) => void;
  onMax: (value: string) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium">{label}</legend>
      <div className="grid grid-cols-2 gap-2">
        <input
          type="number"
          min="0"
          value={min}
          onChange={(event) => onMin(event.target.value)}
          placeholder="Min"
          className="min-h-11 min-w-0 border border-[#deded9] px-3 text-sm"
          aria-label={`${label} minimum`}
        />
        <input
          type="number"
          min="0"
          value={max}
          onChange={(event) => onMax(event.target.value)}
          placeholder="Max"
          className="min-h-11 min-w-0 border border-[#deded9] px-3 text-sm"
          aria-label={`${label} maksimum`}
        />
      </div>
    </fieldset>
  );
}
