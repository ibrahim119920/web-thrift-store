import type { ButtonHTMLAttributes } from "react";

export function IconButton({
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`grid size-11 place-items-center rounded-full transition hover:bg-lime ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
