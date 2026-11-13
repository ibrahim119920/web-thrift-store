import type { InputHTMLAttributes } from "react";

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  labelClassName?: string;
}

export function Input({ label, error, className = "", labelClassName = "", ...props }: Props) {
  return (
    <label className={`block w-full text-sm font-medium ${labelClassName}`}>
      {label && <span className="mb-2 block">{label}</span>}
      <input
        className={`min-h-12 w-full rounded-[10px] bg-[#f5f5f5] px-4 text-sm outline-none ring-pink focus:ring-2 ${error ? "ring-2 ring-red-600" : ""} ${className}`}
        {...props}
      />
      {error && <span className="mt-1.5 block text-xs text-red-600">{error}</span>}
    </label>
  );
}
