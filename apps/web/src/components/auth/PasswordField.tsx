import { useState } from "react";

interface Props {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  helper?: string;
  autoComplete: string;
}

export function PasswordField({ value, onChange, error, helper, autoComplete }: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <label className="block w-full text-[13px] font-medium">
      <span className="mb-2 block">Password</span>
      <span
        className={`flex min-h-12 items-center rounded-[10px] bg-[#f5f5f5] px-4 ring-pink focus-within:ring-2 ${
          error ? "ring-2 ring-red-600" : ""
        }`}
      >
        <input
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Enter your password"
          autoComplete={autoComplete}
          className="min-w-0 flex-1 bg-transparent text-[13px] outline-none"
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          className="ml-2 grid size-6 place-items-center"
          aria-label={visible ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
        >
          <img src="/assets/9ffd3.svg" alt="" />
        </button>
      </span>
      {helper && !error && (
        <span className="mt-2 block text-[13px] font-normal text-[#6b6b6b]">{helper}</span>
      )}
      {error && <span className="mt-2 block text-xs font-normal text-red-600">{error}</span>}
    </label>
  );
}
