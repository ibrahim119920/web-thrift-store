import { PackageOpen } from "lucide-react";

export function EmptyState({
  title = "Belum ada data",
  description,
  action,
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="grid min-h-64 place-items-center border border-dashed border-[#bebeb8] p-8 text-center">
      <div>
        <PackageOpen className="mx-auto mb-4" size={36} />
        <h2 className="font-extrabold">{title}</h2>
        {description && <p className="mt-2 text-sm text-muted">{description}</p>}
        {action && <div className="mt-5">{action}</div>}
      </div>
    </div>
  );
}
