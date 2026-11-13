import { Link } from "react-router-dom";

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link
      to="/"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className={`text-lg font-black tracking-[-0.075em] ${light ? "text-white" : "text-ink"}`}
    >
      WANT<span className="text-pink">TO</span>SELL
    </Link>
  );
}
