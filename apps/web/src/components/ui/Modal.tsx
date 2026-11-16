import { X } from "lucide-react";
import { useEffect } from "react";
import { IconButton } from "./IconButton";

interface Props {
  open: boolean;
  title: string;
  children: React.ReactNode;
  /** Area tombol yang menempel di bawah modal (tidak ikut ter-scroll). */
  footer?: React.ReactNode;
  onClose: () => void;
}

export function Modal({ open, title, children, footer, onClose }: Props) {
  // Kunci scroll halaman di belakang modal; scroll di dalam modal tetap jalan.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex overflow-y-auto overscroll-contain bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative z-10 my-auto flex max-h-[90dvh] w-full max-w-lg flex-col bg-white shadow-2xl mx-auto">
        <div className="flex shrink-0 items-center justify-between border-b border-[#e8e8e3] px-6 py-4">
          <h2 className="text-xl font-extrabold">{title}</h2>
          <IconButton onClick={onClose} aria-label="Tutup">
            <X size={20} />
          </IconButton>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-6 [-webkit-overflow-scrolling:touch]">
          {children}
        </div>
        {footer && <div className="shrink-0 border-t border-[#e8e8e3] px-6 py-4">{footer}</div>}
      </div>
    </div>
  );
}
