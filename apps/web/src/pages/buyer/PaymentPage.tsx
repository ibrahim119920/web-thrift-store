import { Check, Clock3, Copy, PackageCheck, QrCode } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { ErrorState } from "../../components/ui/ErrorState";
import { Skeleton } from "../../components/ui/Skeleton";
import { useToast } from "../../components/ui/Toast";
import { formatRupiah } from "../../lib/format";
import { USE_MOCK } from "../../lib/constants";
import { ordersService } from "../../services";
import type { Order, PaymentRecord } from "../../types";

type PaymentChoice = "qris" | "bank_transfer";

export function PaymentPage() {
  const { id = "" } = useParams();
  const { showToast } = useToast();
  const [order, setOrder] = useState<Order | null>(null);
  const [payment, setPayment] = useState<PaymentRecord | null>(null);
  const [choice, setChoice] = useState<PaymentChoice>("qris");
  const [bank, setBank] = useState("bca");
  const [now, setNow] = useState(Date.now());
  const [loading, setLoading] = useState(true);
  const [initiating, setInitiating] = useState(false);
  const [error, setError] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [snapLoading, setSnapLoading] = useState(false);

  useEffect(() => {
    let active = true;
    const initialize = async () => {
      setLoading(true);
      try {
        const [orderResponse, paymentResponse] = await Promise.all([
          ordersService.get(id),
          ordersService.payments(id),
        ]);
        if (!orderResponse.data) throw new Error("Pesanan tidak ditemukan");
        if (!active) return;
        setOrder(orderResponse.data);
        setPayment(paymentResponse.data.at(-1) || null);
      } catch {
        if (active) setError(true);
      } finally {
        if (active) setLoading(false);
      }
    };
    void initialize();
    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => {
    const countdown = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(countdown);
  }, []);

  useEffect(() => {
    if (!payment || payment.status !== "pending") return;
    const poll = async () => {
      try {
        const response = await ordersService.payments(id);
        const latest = response.data.at(-1);
        if (!latest) return;
        setPayment(latest);
        if (latest.status === "success") {
          setOrder((current) => (current ? { ...current, status: "paid" } : current));
          showToast("Pembayaran berhasil diverifikasi.", "success");
        }
      } catch {
        // Polling berikutnya akan mencoba kembali.
      }
    };
    const interval = window.setInterval(() => void poll(), 4000);
    return () => window.clearInterval(interval);
  }, [id, payment?.status]);

  const remaining = useMemo(
    () => Math.max(0, (order ? new Date(order.expiresAt).getTime() : now) - now),
    [order, now],
  );
  const expired = Boolean(order && remaining === 0 && payment?.status !== "success");

  const initiatePayment = async () => {
    setInitiating(true);
    try {
      const response =
        choice === "qris"
          ? await ordersService.payQris(id)
          : await ordersService.payBank(id, { bank });
      setPayment(response.data);
    } catch {
      showToast("Metode pembayaran belum dapat dibuat.", "error");
    } finally {
      setInitiating(false);
    }
  };

  const startMidtrans = async () => {
    setSnapLoading(true);
    try {
      const response = await ordersService.createSnap(id);
      const next = response.data;
      if (!next) throw new Error("Transaksi Midtrans tidak tersedia.");
      setPayment(next);
      if (next.redirectUrl) {
        window.location.href = next.redirectUrl;
        return;
      }
      showToast("Transaksi dibuat, tetapi tautan pembayaran tidak tersedia.", "error");
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Pembayaran Midtrans belum dapat dimulai.",
        "error",
      );
    } finally {
      setSnapLoading(false);
    }
  };

  const copyVirtualAccount = async () => {
    const value = payment?.paymentData.virtualAccount;
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      showToast("Nomor Virtual Account berhasil disalin.", "success");
    } catch {
      showToast("Nomor Virtual Account belum dapat disalin.", "error");
    }
  };

  const cancelOrder = async () => {
    if (!order || order.status !== "waiting_payment") return;
    setCancelling(true);
    try {
      const response = await ordersService.cancel(order._id);
      setOrder(response.data);
      showToast("Pesanan dibatalkan.", "success");
    } catch {
      showToast("Pesanan belum dapat dibatalkan.", "error");
    } finally {
      setCancelling(false);
    }
  };

  if (loading) return <PaymentSkeleton />;
  if (error || !order)
    return (
      <div className="container-main py-20">
        <ErrorState
          title="Pembayaran tidak ditemukan"
          description="Pesanan atau detail pembayaran belum tersedia."
        />
      </div>
    );

  if (payment?.status === "success" || order.status === "paid")
    return (
      <>
        <PaymentSuccess order={order} />
        <OrderStepper status="paid" paymentStarted />
      </>
    );

  const cancelled = order.status === "cancelled";

  return (
    <>
      <section className="bg-pink py-8 text-white">
        <div className="container-main grid gap-6 tablet:grid-cols-[1fr_auto_auto] tablet:items-center">
          <div className="flex items-center gap-4">
            <span className="grid size-12 place-items-center rounded-xl bg-ink">
              <Clock3 />
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider">
                {payment ? "Pembayaran dipicu · menunggu verifikasi" : "Pilih metode pembayaran"}
              </p>
              <h1 className="mt-1 text-3xl font-black uppercase tracking-[-0.04em]">
                Selesaikan{" "}
                <span className="font-display font-normal italic normal-case">pembayaranmu</span>
              </h1>
            </div>
          </div>
          <div>
            <p className="text-xs">Nomor pesanan</p>
            <p className="mt-1 font-extrabold">{order.orderNumber}</p>
            <p className="mt-1 text-sm font-bold">{formatRupiah(order.total)}</p>
          </div>
          <div className="tablet:text-right">
            <p className="text-xs">Bayar sebelum</p>
            <p className="mt-1 text-3xl font-black tabular-nums">{formatCountdown(remaining)}</p>
          </div>
        </div>
      </section>

      <main className="container-main py-10 tablet:py-14">
        {cancelled ? (
          <div className="border border-[#8b3a3a] bg-red-50 p-8 text-center">
            <h2 className="text-2xl font-extrabold text-red-800">Pesanan dibatalkan</h2>
            <p className="mt-3 text-sm text-red-700">Pesanan ini tidak lagi menunggu pembayaran.</p>
            <Link
              to="/shop"
              className="mt-6 inline-flex min-h-11 items-center rounded-[10px] bg-ink px-5 text-sm font-bold text-white"
            >
              Kembali ke katalog
            </Link>
          </div>
        ) : expired ? (
          <div className="border border-ink bg-canvas p-8 text-center">
            <h2 className="text-2xl font-extrabold">
              Pembayaran kedaluwarsa, barang dilepas kembali
            </h2>
            <Link
              to="/shop"
              className="mt-6 inline-flex min-h-11 items-center rounded-[10px] bg-ink px-5 text-sm font-bold text-white"
            >
              Kembali ke katalog
            </Link>
          </div>
        ) : !payment ? (
          USE_MOCK ? (
            <PaymentMethodPicker
              choice={choice}
              onChoice={setChoice}
              bank={bank}
              onBank={setBank}
              loading={initiating}
              onContinue={() => void initiatePayment()}
            />
          ) : (
            <MidtransPayment
              order={order}
              loading={snapLoading}
              onPay={() => void startMidtrans()}
            />
          )
        ) : payment.method === "qris" ? (
          <QrisPayment payment={payment} order={order} />
        ) : payment.method === "bank_transfer" ? (
          <BankPayment payment={payment} order={order} onCopy={() => void copyVirtualAccount()} />
        ) : (
          <MidtransPending
            payment={payment}
            order={order}
            loading={snapLoading}
            onPay={() => void startMidtrans()}
          />
        )}

        {!cancelled && !expired && order.status === "waiting_payment" && (
          <Button
            disabled={cancelling}
            onClick={() => void cancelOrder()}
            className="mt-6 rounded-[10px]"
          >
            {cancelling ? "Membatalkan..." : "Batalkan Pesanan"}
          </Button>
        )}
      </main>

      <OrderStepper status={order.status} paymentStarted={Boolean(payment)} />
    </>
  );
}

function MidtransPayment({
  order,
  loading,
  onPay,
}: {
  order: Order;
  loading: boolean;
  onPay: () => void;
}) {
  return (
    <section>
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-pink">Metode Pembayaran</p>
      <h2 className="display-title mt-2 text-3xl">Bayar dengan Midtrans</h2>
      <div className="mt-7 border border-[#deded9] bg-white p-6 tablet:p-8">
        <p className="text-sm leading-6 text-muted">
          Anda akan diarahkan ke halaman Midtrans untuk memilih metode pembayaran: QRIS, virtual
          account bank, e-wallet, atau kartu. Status pesanan diperbarui otomatis begitu pembayaran
          diterima.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-[#e8e9e5] pt-6">
          <div>
            <p className="text-xs text-muted">Total pembayaran</p>
            <p className="mt-1 text-2xl font-black">{formatRupiah(order.total)}</p>
          </div>
          <Button onClick={onPay} disabled={loading}>
            {loading ? "Menyiapkan..." : "Lanjutkan ke Midtrans"}
          </Button>
        </div>
        <p className="mt-5 text-xs text-muted">Pesanan {order.orderNumber}</p>
      </div>
    </section>
  );
}

function MidtransPending({
  payment,
  order,
  loading,
  onPay,
}: {
  payment: PaymentRecord;
  order: Order;
  loading: boolean;
  onPay: () => void;
}) {
  return (
    <section className="border border-[#4b4b4b] bg-white p-6 tablet:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e8e9e5] pb-5">
        <strong>Menunggu pembayaran Midtrans</strong>
        <span className="text-xs font-semibold uppercase text-muted">
          {payment.transactionStatus || payment.status}
        </span>
      </div>
      <p className="mt-6 text-sm leading-6 text-muted">
        Transaksi sudah dibuat. Jika halaman pembayaran Midtrans belum terbuka atau tertutup,
        tekan tombol di bawah untuk melanjutkan. Status akan diperbarui otomatis setelah pembayaran
        diverifikasi.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-[#e8e9e5] pt-6">
        <div>
          <p className="text-xs text-muted">Total pembayaran</p>
          <p className="mt-1 text-2xl font-black">{formatRupiah(payment.amount || order.total)}</p>
        </div>
        <Button onClick={onPay} disabled={loading}>
          {loading ? "Menyiapkan..." : "Buka halaman pembayaran"}
        </Button>
      </div>
    </section>
  );
}

function PaymentMethodPicker({
  choice,
  onChoice,
  bank,
  onBank,
  loading,
  onContinue,
}: {
  choice: PaymentChoice;
  onChoice: (choice: PaymentChoice) => void;
  bank: string;
  onBank: (bank: string) => void;
  loading: boolean;
  onContinue: () => void;
}) {
  return (
    <section>
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-pink">Metode Pembayaran</p>
      <h2 className="display-title mt-2 text-3xl">Pilih satu metode</h2>
      <div className="mt-7 grid gap-4 tablet:grid-cols-2">
        <PaymentChoiceButton
          selected={choice === "qris"}
          onClick={() => onChoice("qris")}
          icon={<QrCode />}
          title="QRIS"
          description="GoPay, OVO, DANA, ShopeePay, dan m-banking"
        />
        <PaymentChoiceButton
          selected={choice === "bank_transfer"}
          onClick={() => onChoice("bank_transfer")}
          icon={<span className="text-xs font-black">VA</span>}
          title="Transfer Bank"
          description="Virtual Account dengan verifikasi otomatis"
        />
      </div>
      {choice === "bank_transfer" && (
        <div className="mt-5">
          <p className="mb-3 text-sm font-semibold">Pilih bank</p>
          <div className="grid grid-cols-3 gap-3">
            {["bca", "mandiri", "bni"].map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => onBank(item)}
                className={`min-h-12 rounded-none border bg-white px-4 text-xs font-black uppercase ${
                  bank === item ? "border-[#4b4b4b]" : "border-[#deded9]"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      )}
      <Button onClick={onContinue} disabled={loading} className="mt-7 rounded-[10px]">
        {loading ? "Menyiapkan pembayaran..." : "Lanjutkan Pembayaran"}
      </Button>
    </section>
  );
}

function PaymentChoiceButton({
  selected,
  onClick,
  icon,
  title,
  description,
}: {
  selected: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`flex min-h-28 items-center gap-4 rounded-none border bg-white p-5 text-left transition ${
        selected ? "border-[#4b4b4b]" : "border-[#deded9] hover:border-[#9a9a94]"
      }`}
    >
      <span className="grid size-11 place-items-center border border-[#deded9]">{icon}</span>
      <span className="flex-1">
        <strong className="block">{title}</strong>
        <span className="mt-2 block text-xs leading-5 text-muted">{description}</span>
      </span>
      <span
        className={`size-4 rounded-full border ${selected ? "border-[5px] border-ink" : "border-[#bdbdbd]"}`}
      />
    </button>
  );
}

function QrisPayment({ payment, order }: { payment: PaymentRecord; order: Order }) {
  return (
    <section className="border border-[#4b4b4b] bg-white p-6 tablet:p-8">
      <div className="flex items-center justify-between gap-4 border-b border-[#e8e9e5] pb-5">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center border border-[#deded9]">
            <QrCode size={19} />
          </span>
          <strong>QRIS</strong>
        </div>
        <span className="text-xs font-semibold text-muted">Cek otomatis 1–5 menit</span>
      </div>
      <div className="mt-7 grid items-center gap-8 tablet:grid-cols-[260px_1fr]">
        <QrVisual value={payment.paymentData.qrString || order.orderNumber} />
        <div>
          <p className="text-xs text-muted">Total yang harus dibayar</p>
          <p className="mt-2 text-3xl font-black">{formatRupiah(order.total)}</p>
          <ol className="mt-6 list-decimal space-y-2 pl-5 text-sm leading-6 text-muted">
            <li>Buka aplikasi pembayaran atau m-banking.</li>
            <li>Pilih menu Scan QRIS dan arahkan kamera ke kode.</li>
            <li>Pastikan nominal sesuai lalu selesaikan pembayaran.</li>
            <li>Status diperbarui otomatis setelah pembayaran diterima.</li>
          </ol>
        </div>
      </div>
    </section>
  );
}

function BankPayment({
  payment,
  order,
  onCopy,
}: {
  payment: PaymentRecord;
  order: Order;
  onCopy: () => void;
}) {
  return (
    <section className="border border-[#4b4b4b] bg-white p-6 tablet:p-8">
      <div className="flex items-center justify-between gap-4 border-b border-[#e8e9e5] pb-5">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center border border-[#deded9] text-xs font-black">
            {payment.paymentData.bankName}
          </span>
          <strong>{payment.paymentData.bankName} Virtual Account</strong>
        </div>
        <span className="text-xs font-semibold text-muted">Cek otomatis 1–5 menit</span>
      </div>
      <div className="mt-7 grid gap-7 tablet:grid-cols-2">
        <div>
          <p className="text-xs text-muted">Nomor Virtual Account</p>
          <p className="mt-2 break-all text-2xl font-black tracking-wide tablet:text-3xl">
            {payment.paymentData.virtualAccount}
          </p>
          <button
            type="button"
            onClick={onCopy}
            className="mt-4 inline-flex items-center gap-2 rounded-full border border-ink px-4 py-2 text-xs font-bold"
          >
            <Copy size={14} /> Salin
          </button>
        </div>
        <div>
          <p className="text-xs text-muted">Total yang harus dibayar</p>
          <p className="mt-2 text-3xl font-black">{formatRupiah(order.total)}</p>
          <p className="mt-2 text-xs font-semibold text-pink">
            Transfer tepat sampai 3 digit terakhir
          </p>
        </div>
      </div>
      <div className="mx-auto mt-8 max-w-2xl bg-canvas p-5 text-sm leading-7">
        <h2 className="font-extrabold">Cara bayar Virtual Account</h2>
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-muted">
          <li>Buka aplikasi bank atau ATM pilihanmu.</li>
          <li>Pilih transfer Virtual Account lalu masukkan nomor VA.</li>
          <li>Pastikan nama penerima WANTTOSELL dan nominal sudah sesuai.</li>
          <li>Status diperbarui otomatis dalam 1–5 menit.</li>
        </ol>
      </div>
    </section>
  );
}

function QrVisual({ value }: { value: string }) {
  const cells = Array.from({ length: 21 * 21 }, (_, index) => {
    const code = value.charCodeAt(index % value.length) || 0;
    return (code + index * 7 + Math.floor(index / 21) * 11) % 3 !== 0;
  });
  return (
    <div className="mx-auto w-full max-w-[240px] border-8 border-white p-2 shadow-[0_0_0_1px_#deded9]">
      <div className="grid aspect-square grid-cols-[repeat(21,minmax(0,1fr))] bg-white">
        {cells.map((filled, index) => (
          <span key={index} className={filled ? "bg-ink" : "bg-white"} />
        ))}
      </div>
    </div>
  );
}

function OrderStepper({
  status,
  paymentStarted,
}: {
  status: Order["status"];
  paymentStarted: boolean;
}) {
  const paid = ["paid", "processing", "shipped", "completed"].includes(status);
  const processing = ["processing", "shipped", "completed"].includes(status);
  const steps = [
    {
      title: "Menunggu bayar",
      active: status === "waiting_payment",
      complete: paid,
      text: paymentStarted ? "Menunggu verifikasi" : "Pilih metode",
    },
    {
      title: "Dibayar",
      active: status === "paid",
      complete: processing,
      text: paid ? "Terverifikasi" : "—",
    },
    {
      title: "Diproses",
      active: processing,
      complete: false,
      text: processing ? "Dikemas penjual" : "—",
    },
  ];
  return (
    <section className="border-y border-[#e8e9e5] bg-canvas py-8">
      <div className="container-main">
        <h2 className="text-sm font-extrabold uppercase tracking-wider">Status Pesanan</h2>
        <div className="mt-7 grid gap-7 tablet:grid-cols-3">
          {steps.map((step, index) => (
            <div key={step.title} className="relative border-t border-[#cfcfc9] pt-5">
              <span
                className={`absolute -top-3 left-0 grid size-6 place-items-center rounded-full border ${step.active || step.complete ? "border-ink bg-lime" : "border-[#bdbdbd] bg-white"}`}
              >
                {step.complete ? <Check size={13} /> : index + 1}
              </span>
              <p className="text-sm font-bold">{step.title}</p>
              <p className="mt-1 text-xs text-muted">{step.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function PaymentSuccess({ order }: { order: Order }) {
  return (
    <section className="container-main py-20">
      <div className="mx-auto max-w-2xl border-2 border-ink bg-white p-8 text-center shadow-[8px_8px_0_#dffc01] tablet:p-12">
        <span className="mx-auto grid size-16 place-items-center rounded-full bg-lime">
          <Check size={30} strokeWidth={3} />
        </span>
        <p className="mt-7 text-xs font-bold uppercase tracking-[0.16em] text-pink">
          Pembayaran terverifikasi
        </p>
        <h1 className="display-title mt-3 text-4xl leading-[0.95] tablet:text-5xl">
          Pembayaran <span className="font-display font-normal italic text-pink">berhasil</span>
        </h1>
        <p className="mx-auto mt-5 max-w-lg text-sm leading-6 text-muted">
          Pesanan {order.orderNumber} sudah dibayar dan akan segera diproses.
        </p>
        <Link
          to={`/orders/${order._id}`}
          className="mt-8 inline-grid min-h-11 place-items-center rounded-[10px] bg-ink px-6 text-sm font-bold text-white"
        >
          Lihat detail pesanan
        </Link>
      </div>
    </section>
  );
}

function formatCountdown(milliseconds: number) {
  const seconds = Math.floor(milliseconds / 1000);
  return `${String(Math.floor(seconds / 3600)).padStart(2, "0")}:${String(Math.floor((seconds % 3600) / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function PaymentSkeleton() {
  return (
    <div>
      <Skeleton className="h-40 w-full bg-pink/30" />
      <div className="container-main py-12">
        <Skeleton className="h-80 w-full" />
      </div>
    </div>
  );
}
