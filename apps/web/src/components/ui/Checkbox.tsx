import type { InputHTMLAttributes } from "react";

export function Checkbox({ children, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex cursor-pointer items-start gap-3 text-sm">
      <input type="checkbox" className="mt-0.5 size-4 accent-pink" {...props} />
      <span>{children}</span>
    </label>
  );
}
