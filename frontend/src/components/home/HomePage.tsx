"use client";

import Link from "next/link";
import Image from "next/image";
import Layout from "@/components/common/Layout";

const ROLES = [
  {
    title: "Borrow",
    description:
      "Deposit SUI as collateral, place a borrow order, and get filled by a lender. Repay to unlock your collateral.",
    href: "/vaults",
    cta: "Start Borrowing",
  },
  {
    title: "Lend",
    description:
      "Earn interest by filling borrow orders. Use direct fill from the order book or lock funds via escrow.",
    href: "/lend",
    cta: "Start Lending",
  },
  {
    title: "Liquidate",
    description:
      "Seize under-collateralised vaults and earn a liquidator bonus. Sell collateral on DeepBook to settle.",
    href: "/liquidate",
    cta: "Find Vaults",
  },
];

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
        <Image
          src="/rain-logo-hero.png"
          alt="Rain"
          width={280}
          height={120}
          className="h-20 w-auto sm:h-28"
          priority
        />
        <p className="max-w-xl text-xs leading-relaxed text-[var(--fg-dim)] sm:text-sm">
          Peer-to-peer lending on Sui. Rate discovery and liquidation execution
          both use DeepBook — no CEX dependency, no off-chain keepers.
        </p>

        {/* Role-based entry cards */}
        <div className="mx-auto grid w-full max-w-3xl gap-4 sm:grid-cols-3">
          {ROLES.map(({ title, description, href, cta }) => (
            <Link
              key={href}
              href={href}
              className="pixel-border group flex flex-col justify-between bg-[var(--panel)] p-5 text-left transition-colors hover:border-[var(--accent)]"
            >
              <div>
                <h2 className="mb-2 text-sm font-medium uppercase tracking-wider text-[var(--fg)] group-hover:text-[var(--accent)]">
                  {title}
                </h2>
                <p className="text-[0.65rem] leading-relaxed text-[var(--fg-dim)] sm:text-xs">
                  {description}
                </p>
              </div>
              <span className="mt-4 inline-block text-[0.6rem] uppercase tracking-wider text-[var(--accent)]">
                {cta} &rarr;
              </span>
            </Link>
          ))}
        </div>

        {/* Fill path explanation */}
        <div className="mx-auto max-w-2xl text-left">
          <h3 className="mb-3 text-center text-[0.65rem] uppercase tracking-wider text-[var(--fg-dim)] sm:text-xs">
            Two ways to fill orders
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="pixel-border bg-[var(--panel)] p-4">
              <p className="mb-1 text-[0.65rem] font-medium uppercase text-[var(--fg)] sm:text-xs">
                Direct Fill (Order Book)
              </p>
              <p className="text-[0.6rem] leading-relaxed text-[var(--fg-dim)] sm:text-[0.7rem]">
                The borrower signs the transaction with their vault. They must
                already hold the loan amount. One atomic transaction.
              </p>
              <Link
                href="/marketplace"
                className="mt-2 inline-block text-[0.55rem] uppercase text-[var(--accent)] sm:text-[0.65rem]"
              >
                Go to Order Book &rarr;
              </Link>
            </div>
            <div className="pixel-border bg-[var(--panel)] p-4">
              <p className="mb-1 text-[0.65rem] font-medium uppercase text-[var(--fg)] sm:text-xs">
                Escrow Fill
              </p>
              <p className="text-[0.6rem] leading-relaxed text-[var(--fg-dim)] sm:text-[0.7rem]">
                The lender locks funds on-chain first. The borrower completes
                the fill at their convenience — no coordination needed.
              </p>
              <Link
                href="/escrow"
                className="mt-2 inline-block text-[0.55rem] uppercase text-[var(--accent)] sm:text-[0.65rem]"
              >
                Go to Escrow &rarr;
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Feature grid */}
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
