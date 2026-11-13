export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-[#ecece8] ${className}`} aria-hidden="true" />;
}
