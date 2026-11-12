import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const links = [
  { href: "#koleksi", label: "Koleksi" },
  { href: "#cara-kerja", label: "Cara Belanja" },
  { href: "#kondisi", label: "Grade Kondisi" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="font-heading text-xl font-semibold tracking-tight">
          Want<span className="text-primary">To</span>Sell
        </Link>

        <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="transition-colors hover:text-foreground">
              {l.label}
            </a>
          ))}
        </nav>

        <a href="#koleksi" className={cn(buttonVariants({ size: "lg" }), "rounded-full px-4")}>
          Mulai Belanja
        </a>
      </div>
    </header>
  );
}
