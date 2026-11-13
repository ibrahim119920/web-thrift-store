interface Props {
  tone: "pink" | "lime";
  children: React.ReactNode;
}

export function AuthShell({ tone, children }: Props) {
  return (
    <main className="flex min-h-dvh bg-white">
      <div
        className={`relative hidden min-w-0 flex-1 overflow-hidden desktop:block ${
          tone === "pink" ? "bg-pink" : "bg-lime"
        }`}
        aria-hidden="true"
      >
        <img
          src="/assets/ee652.png"
          alt=""
          className="absolute left-1/2 top-0 h-auto w-[772px] max-w-none -translate-x-1/2"
        />
      </div>
      <section className="flex w-full shrink-0 items-center justify-center overflow-y-auto px-6 py-12 desktop:w-[508px] desktop:px-[77px]">
        <div className="w-full max-w-[353px]">{children}</div>
      </section>
    </main>
  );
}
