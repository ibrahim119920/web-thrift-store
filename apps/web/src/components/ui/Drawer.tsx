import { X } from "lucide-react";
import { IconButton } from "./IconButton";

interface Props {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}

export function Drawer({ open, title, children, onClose }: Props) {
  return (
    <div
      className={`fixed inset-0 z-50 transition ${open ? "visible bg-black/40" : "invisible"}`}
      onClick={onClose}
    >
      <aside
        className={`ml-auto h-full w-[min(88vw,380px)] bg-white p-6 shadow-xl transition-transform ${open ? "translate-x-0" : "translate-x-full"}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-black uppercase">{title}</h2>
          <IconButton onClick={onClose} aria-label="Tutup">
            <X size={20} />
          </IconButton>
        </div>
        {children}
      </aside>
    </div>
  );
}
