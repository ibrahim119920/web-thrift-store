import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatRupiah } from "@/lib/format";

const tilt = ["-rotate-6 translate-y-6", "rotate-2 z-10", "rotate-6 translate-y-10"];

export function Hero({ products }) {
  const showcase = (products ?? []).slice(0, 3);

  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 md:py-24 lg:grid-cols-2">
        <div>
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <span className="size-1.5 rounded-full bg-primary" />
            Thrift preloved · stok selalu 1
          </p>
          <h1 className="text-4xl font-semibold leading-[1.1] sm:text-5xl lg:text-6xl">
            Satu barang,
            <br />
            <span className="italic text-primary">satu pemilik.</span>
          </h1>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-muted-foreground">
            Pakaian bekas pilihan dengan ukuran presisi dalam cm dan kondisi yang
            didokumentasikan apa adanya. Kalau sudah kamu checkout, barangnya
            dikunci khusus untukmu.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="#koleksi"
              className={cn(buttonVariants({ size: "lg" }), "h-11 rounded-full px-6 text-base")}
            >
              Lihat koleksi <ArrowRight data-icon="inline-end" />
            </a>
            <a
              href="#cara-kerja"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "h-11 rounded-full px-6 text-base"
              )}
            >
              Cara belanja
            </a>
          </div>
        </div>

        <div className="relative mx-auto flex h-72 w-full max-w-md items-start justify-center sm:h-[26rem]">
          {showcase.length > 0 ? (
            showcase.map((p, i) => (
              <figure
                key={p._id}
                className={cn(
                  "relative -mx-5 w-32 shrink-0 rounded-2xl border bg-card p-2 shadow-xl shadow-foreground/10 sm:w-48",
                  tilt[i]
                )}
              >
                <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-muted">
                  <Image src={p.images[0]} alt={p.name} fill unoptimized sizes="12rem" className="object-cover" />
                </div>
                <figcaption className="px-1 pb-1 pt-2">
                  <p className="truncate text-xs font-medium">{p.name}</p>
                  <p className="text-sm font-bold text-primary">{formatRupiah(p.price)}</p>
                </figcaption>
              </figure>
            ))
          ) : (
            <div className="mt-8 flex aspect-[3/4] w-56 rotate-2 items-center justify-center rounded-2xl border-2 border-dashed bg-card p-6 text-center font-heading text-2xl italic text-muted-foreground">
              Koleksi segera hadir
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
