import { createContext, useContext, useState } from "react";

type ToastTone = "success" | "error" | "info";
interface ToastContextValue {
  showToast: (message: string, tone?: ToastTone) => void;
}
const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<{ message: string; tone: ToastTone } | null>(null);
  const showToast = (message: string, tone: ToastTone = "info") => {
    setToast({ message, tone });
    window.setTimeout(() => setToast(null), 3500);
  };
  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <div
          role="status"
          className={`fixed bottom-5 right-5 z-[70] max-w-sm border-2 border-ink px-5 py-4 text-sm font-semibold shadow-[5px_5px_0_#121212] ${toast.tone === "error" ? "bg-pink text-white" : toast.tone === "success" ? "bg-lime" : "bg-white"}`}
        >
          {toast.message}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export const useToast = () => {
  const value = useContext(ToastContext);
  if (!value) throw new Error("useToast harus digunakan dalam ToastProvider");
  return value;
};
