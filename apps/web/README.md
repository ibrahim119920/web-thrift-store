# WantToSell Web (Next.js)

Frontend WantToSell: Next.js 15 (App Router), JavaScript, Tailwind CSS v4, shadcn/ui.

## Menjalankan

Dari root repository:

```bash
cp apps/web/.env.example apps/web/.env.local   # sekali saja
npm run dev:api    # terminal 1: backend di http://localhost:5000
npm run dev:web    # terminal 2: frontend di http://localhost:3000
```

`NEXT_PUBLIC_API_URL` menentukan alamat backend. Variabel ini terlihat oleh browser, jadi jangan isi dengan rahasia.

## Struktur

- `src/app/` – halaman dan layout (routing berbasis folder)
- `src/features/` – UI per fitur (`landing/`, `products/`)
- `src/components/ui/` – komponen shadcn/ui
- `src/services/` – pemanggilan API backend
- `src/lib/` – utilitas (format rupiah, `cn`)
