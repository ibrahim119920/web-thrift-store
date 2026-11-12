import Image from "next/image";
import { formatRupiah, GRADE_LABEL } from "@/lib/format";
import { cn } from "@/lib/utils";

const gradeStyle = {
  A: "bg-accent text-accent-foreground",
  B: "bg-secondary text-secondary-foreground",
  C: "bg-primary/10 text-primary",
};

export function ProductCard({ product }) {
  const { name, brand, price, images, size, condition } = product;

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border bg-card transition-shadow hover:shadow-lg hover:shadow-foreground/5">
      <div className="relative aspect-[3/4] overflow-hidden bg-muted">
        {images?.[0] && (
          <Image
            src={images[0]}
            alt={name}
            fill
            unoptimized
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        )}
        <span
          className={cn(
            "absolute left-3 top-3 rounded-full px-2.5 py-1 text-xs font-semibold",
            gradeStyle[condition?.grade] ?? gradeStyle.B
          )}
        >
          Grade {condition?.grade} · {GRADE_LABEL[condition?.grade]}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-1 p-4">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {brand || "Tanpa merek"}
        </p>
        <h3 className="font-sans text-base font-semibold leading-snug">{name}</h3>
        <p className="text-sm text-muted-foreground">
          Size {size?.label} · LD {size?.chest} cm · P {size?.length} cm
        </p>
        {condition?.minusTags?.length > 0 && (
          <p className="text-xs text-primary">Minus: {condition.minusTags.join(", ")}</p>
        )}
        <p className="mt-auto pt-3 text-lg font-bold">{formatRupiah(price)}</p>
      </div>
    </article>
  );
}
