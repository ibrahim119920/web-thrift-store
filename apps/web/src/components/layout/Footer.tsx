import { ArrowUp } from "lucide-react";
import { Link } from "react-router-dom";
import { STORE_LOCATION } from "../../lib/constants";
import { useToast } from "../ui/Toast";
import { Logo } from "./Logo";

const shop = [
  ["New arrivals", "/#latest-drop"],
  ["All products", "/shop"],
  ["How to buy", "/how-to-buy"],
  ["Size guide", "/size-guide"],
];
const help = [
  ["FAQ", "/faq"],
  ["Hubungi kami", "/contact"],
];

export function Footer() {
  const { showToast } = useToast();

  return (
    <footer id="footer" className="scroll-mt-20 border-t-2 border-ink bg-ink text-white">
      <div className="container-main grid gap-12 py-14 tablet:grid-cols-2 desktop:grid-cols-[1.5fr_0.7fr_0.7fr_1.2fr]">
        <div>
          <Logo light />
          <p className="mt-5 max-w-xs text-sm leading-relaxed text-[#aaa59c]">
            Etalase pakaian preloved terkurasi. Setiap pakaian punya cerita, dan satu pemilik
            berikutnya.
          </p>
          <p className="mt-5 text-sm text-[#aaa59c]">
            {STORE_LOCATION}
            <br />
            halo@wanttosell.id
            <br />
            +62 812 2026 1126
          </p>
        </div>
        <FooterColumn title="SHOP" links={shop} />
        <FooterColumn title="HELP" links={help} />
        <div>
          <h3 className="text-sm font-extrabold">JOIN THE NEXT DROP</h3>
          <p className="mt-4 text-xs leading-relaxed text-[#aaa59c]">
            Dapatkan kabar koleksi terbaru langsung ke emailmu.
          </p>
          <form
            className="mt-5 flex"
            onSubmit={(event) => {
              event.preventDefault();
              event.currentTarget.reset();
              showToast(
                "Berhasil bergabung. Kabar drop berikutnya akan dikirim ke emailmu.",
                "success",
              );
            }}
          >
            <input
              type="email"
              required
              aria-label="Alamat email newsletter"
              placeholder="Alamat email kamu"
              className="min-w-0 flex-1 border border-[#555] bg-transparent px-3 text-xs text-white"
            />
            <button className="bg-white px-4 py-3 text-xs font-extrabold text-ink">JOIN</button>
          </form>
        </div>
      </div>
      <div className="container-main flex flex-col gap-5 border-t border-[#333] py-6 text-xs text-[#898989] tablet:flex-row tablet:items-center">
        <span>© 2026 WantToSell</span>
        <Link to="/privacy">Privacy</Link>
        <Link to="/terms">Terms</Link>
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="ml-auto grid size-9 place-items-center rounded-full bg-lime text-ink"
          aria-label="Kembali ke atas"
        >
          <ArrowUp size={18} />
        </button>
      </div>
    </footer>
  );
}

function FooterColumn({ title, links }: { title: string; links: string[][] }) {
  return (
    <div>
      <h3 className="text-sm font-extrabold">{title}</h3>
      <ul className="mt-4 space-y-3 text-sm text-[#aaa59c]">
        {links.map(([label, to]) => (
          <li key={label}>
            <Link className="hover:text-white" to={to}>
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
