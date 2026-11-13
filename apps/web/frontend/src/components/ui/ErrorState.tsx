import { CircleAlert } from "lucide-react";
import { Button } from "./Button";

export function ErrorState({
  title = "Terjadi kesalahan",
  description = "Data belum dapat dimuat.",
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="grid min-h-64 place-items-center border-2 border-ink bg-canvas p-8 text-center">
      <div>
        <CircleAlert className="mx-auto mb-4 text-pink" size={38} />
        <h2 className="font-extrabold">{title}</h2>
        <p className="mt-2 text-sm text-muted">{description}</p>
        {onRetry && (
          <Button className="mt-5" onClick={onRetry}>
            Coba lagi
          </Button>
        )}
      </div>
    </div>
  );
}
