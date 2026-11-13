import type { SelectHTMLAttributes } from "react";

interface Props extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: { label: string; value: string }[];
}

export function Select({ label, options, className = "", ...props }: Props) {
  return (
    <label className="block w-full text-sm font-medium">
      {label && <span className="mb-2 block">{label}</span>}
      <select
        className={`min-h-12 w-full border border-[#deded9] bg-white px-4 ${className}`}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
