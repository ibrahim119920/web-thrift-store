import { Link } from "react-router-dom";
import { Button } from "../components/ui/Button";

function ErrorPage({
  code,
  title,
  description,
}: {
  code: string;
  title: string;
  description: string;
}) {
  return (
    <main className="grid min-h-screen place-items-center bg-lime p-6 text-center">
      <div>
        <p className="font-display text-8xl italic text-pink">{code}</p>
        <h1 className="display-title mt-3 text-4xl">{title}</h1>
        <p className="mt-4 text-sm">{description}</p>
        <Button className="mt-7">
          <Link to="/">Ke Home</Link>
        </Button>
      </div>
    </main>
  );
}
export function ForbiddenPage() {
  return (
    <ErrorPage
      code="403"
      title="Tidak punya akses"
      description="Kamu tidak punya akses ke halaman ini."
    />
  );
}
export function NotFoundPage() {
  return (
    <ErrorPage
      code="404"
      title="Halaman tidak ditemukan"
      description="Halaman yang kamu cari tidak tersedia atau sudah dipindahkan."
    />
  );
}
