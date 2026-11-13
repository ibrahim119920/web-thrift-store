import { Button } from "./Button";

export function LoadMore({
  hasMore,
  loading,
  onClick,
}: {
  hasMore: boolean;
  loading?: boolean;
  onClick: () => void;
}) {
  if (!hasMore) return null;
  return (
    <div className="mt-10 text-center">
      <Button onClick={onClick} disabled={loading}>
        {loading ? "Memuat..." : "Muat lebih banyak"}
      </Button>
    </div>
  );
}
