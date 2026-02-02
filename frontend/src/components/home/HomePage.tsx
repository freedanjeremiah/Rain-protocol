"use client";

import Link from "next/link";
import Layout from "@/components/common/Layout";

const FEATURES = [
  {
    title: "No pooled liquidity",
    description: "True P2P, no protocol-controlled pools.",
  },
  {
    title: "User-owned vaults",
    description: "Non-custodial; users keep control.",
  },
  {
    title: "Orderbook rate discovery",
    description: "Rates from DeepBook, not CEX or algo.",
  },
  {
    title: "Oracle risk checks",
    description: "Pyth for LTV/liquidation, not centralized feeds.",
  },
  {
    title: "On-chain liquidation",
    description: "Via DeepBook; no keeper bots or off-chain logic.",
  },
  {
    title: "Composable & censorship-resistant",
    description: "No single point of failure.",
  },
];

export default function HomePage() {
  return (
    <Layout activePage="home">
      {/* Hero */}
      <section className="flex flex-col items-center justify-center gap-8 px-6 py-16 text-center">
        <h1 className="text-3xl uppercase tracking-wider sm:text-4xl">
          Rain
        </h1>
        <p className="max-w-xl text-xs leading-relaxed text-[var(--fg-dim)] sm:text-sm">
          We fix fake P2P: rate discovery and liquidation execution both use
          Sui’s DeepBook — no CEX dependency, no off-chain keepers.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            href="/borrow"
            className="pixel-btn pixel-btn-accent border-4 px-4 py-2 text-xs uppercase"
          >
            Borrow
          </Link>
          <Link
            href="/lend"
            className="pixel-btn border-4 px-4 py-2 text-xs uppercase"
          >
            Lend
          </Link>
          <Link
            href="/vaults"
            className="pixel-btn border-4 px-4 py-2 text-xs uppercase"
          >
            Vaults
          </Link>
          <Link
            href="/liquidate"
            className="pixel-btn border-4 px-4 py-2 text-xs uppercase"
          >
            Liquidate
          </Link>
        </div>
      </section>

      {/* Feature grid from readme principles */}
      <section className="px-6 pb-16">
        <h2 className="mb-6 text-center text-xs uppercase tracking-wider text-[var(--fg-dim)] sm:text-sm">
          How Rain fixes fake P2P
        </h2>
        <div className="mx-auto grid max-w-4xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ title, description }) => (
            <div
              key={title}
              className="pixel-border bg-[var(--panel)] p-4 text-left"
            >
              <h3 className="mb-2 text-xs font-medium uppercase text-[var(--fg)]">
                {title}
              </h3>
              <p className="text-[0.65rem] leading-relaxed text-[var(--fg-dim)] sm:text-xs">
                {description}
              </p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t-4 border-[var(--border)] bg-[var(--panel)] px-6 py-4 text-center text-[0.65rem] text-[var(--fg-dim)] sm:text-xs">
        Rain · No admin keys. No trusted relayers. No off-chain keepers.
      </footer>
    </Layout>
  );
}
