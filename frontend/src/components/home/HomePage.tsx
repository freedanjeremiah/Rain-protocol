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

export default function HomePage() {
  return (
    <Layout activePage="home">
      {/* Hero */}
      <section className="flex flex-col items-center justify-center gap-8 px-6 py-16 text-center">
        <span className="flex h-40 w-72 items-center justify-center overflow-hidden sm:h-52 sm:w-96">
          <Image
            src="/images/rain-logo-hero.png"
            alt="Rain"
            width={560}
            height={240}
            className="h-full w-auto scale-110 object-contain object-center"
            priority
            unoptimized
          />
        </span>
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
          <p className="mb-3 text-center text-[0.6rem] leading-relaxed text-[var(--fg-dim)] sm:text-[0.7rem]">
            Partial fills are supported: orders can be filled in multiple chunks by one or more lenders — you don’t need to match a single counterparty for the full size.
          </p>
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

        {/* High level Rain — Architecture (left) & Oracle updates (right), both enlarged */}
        <div className="mx-auto mt-12 w-full max-w-[128rem] px-2">
          <h3 className="mb-4 text-center text-xs font-medium uppercase tracking-wider text-[var(--fg)] sm:text-sm">
            High level Rain
          </h3>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-[2fr_1fr]">
            <figure className="flex flex-col items-center">
              <Image
                src="/images/archi.jpeg"
                alt="Rain architecture"
                width={1600}
                height={1120}
                className="w-full max-w-full rounded border-2 border-[var(--border)] object-contain"
                unoptimized
              />
              <figcaption className="mt-2 text-center text-[0.65rem] uppercase tracking-wider text-[var(--fg-dim)] sm:text-xs">
                Architecture
              </figcaption>
            </figure>
            <figure className="flex flex-col items-center">
              <Image
                src="/images/oracle-updates.jpeg"
                alt="Rain oracle updates"
                width={1200}
                height={800}
                className="w-full max-w-full rounded border-2 border-[var(--border)] object-contain"
                unoptimized
              />
              <figcaption className="mt-2 text-center text-[0.65rem] uppercase tracking-wider text-[var(--fg-dim)] sm:text-xs">
                Oracle updates
              </figcaption>
            </figure>
          </div>
        </div>
      </section>

      {/* Rain vs other Sui lending protocols */}
      <section className="px-6 pb-16">
        <h2 className="mb-4 text-center text-xs uppercase tracking-wider text-[var(--fg-dim)] sm:text-sm">
          Rain vs other lending protocols on Sui
        </h2>
        <p className="mx-auto mb-6 max-w-2xl text-center text-[0.6rem] leading-relaxed text-[var(--fg-dim)] sm:text-[0.7rem]">
          How Rain’s P2P, orderbook-based design differs from pooled money markets.
        </p>
        <div className="mx-auto w-full max-w-[128rem] overflow-x-auto px-2">
          <table className="w-full min-w-[800px] border-collapse pixel-border bg-[var(--panel)] text-left">
            <thead>
              <tr className="border-b-2 border-[var(--border)]">
                <th className="p-3 text-[0.65rem] font-medium uppercase tracking-wider text-[var(--fg)] sm:text-xs">
                  Aspect
                </th>
                <th className="p-3 text-[0.65rem] font-medium uppercase tracking-wider text-[var(--accent)] sm:text-xs">
                  Rain
                </th>
                <th className="p-3 text-[0.65rem] font-medium uppercase tracking-wider text-[var(--fg)] sm:text-xs">
                  How Rain benefits Sui
                </th>
                <th className="p-3 text-[0.65rem] font-medium uppercase tracking-wider text-[var(--fg)] sm:text-xs">
                  Suilend
                </th>
                <th className="p-3 text-[0.65rem] font-medium uppercase tracking-wider text-[var(--fg)] sm:text-xs">
                  NAVI
                </th>
                <th className="p-3 text-[0.65rem] font-medium uppercase tracking-wider text-[var(--fg)] sm:text-xs">
                  Scallop
                </th>
                <th className="p-3 text-[0.65rem] font-medium uppercase tracking-wider text-[var(--fg)] sm:text-xs">
                  Bucket
                </th>
              </tr>
            </thead>
            <tbody className="text-[0.6rem] sm:text-[0.7rem]">
              <tr className="border-b border-[var(--border)]">
                <td className="p-3 font-medium text-[var(--fg)]">Liquidity model</td>
                <td className="p-3 text-[var(--accent)]">True P2P, no pools</td>
                <td className="p-3 text-[var(--fg-dim)]">Adds P2P option; diversifies DeFi, no pool concentration</td>
                <td className="p-3 text-[var(--fg-dim)]">Pooled (isolated pools)</td>
                <td className="p-3 text-[var(--fg-dim)]">Pooled, LSD-focused</td>
                <td className="p-3 text-[var(--fg-dim)]">Pooled money market</td>
                <td className="p-3 text-[var(--fg-dim)]">Pooled, object-centric</td>
              </tr>
              <tr className="border-b border-[var(--border)]">
                <td className="p-3 font-medium text-[var(--fg)]">Rate discovery</td>
                <td className="p-3 text-[var(--accent)]">DeepBook orderbook</td>
                <td className="p-3 text-[var(--fg-dim)]">Drives DeepBook usage; on-chain rate discovery on Sui</td>
                <td className="p-3 text-[var(--fg-dim)]">Supply/demand in pools</td>
                <td className="p-3 text-[var(--fg-dim)]">Pool-based rates</td>
                <td className="p-3 text-[var(--fg-dim)]">Algorithmic / pool-based</td>
                <td className="p-3 text-[var(--fg-dim)]">Pool-based</td>
              </tr>
              <tr className="border-b border-[var(--border)]">
                <td className="p-3 font-medium text-[var(--fg)]">Custody</td>
                <td className="p-3 text-[var(--accent)]">User-owned vaults, custody contract</td>
                <td className="p-3 text-[var(--fg-dim)]">Strengthens self-custody and user control on Sui</td>
                <td className="p-3 text-[var(--fg-dim)]">Protocol-controlled pools</td>
                <td className="p-3 text-[var(--fg-dim)]">Protocol pools</td>
                <td className="p-3 text-[var(--fg-dim)]">Protocol pools</td>
                <td className="p-3 text-[var(--fg-dim)]">Protocol pools</td>
              </tr>
              <tr className="border-b border-[var(--border)]">
                <td className="p-3 font-medium text-[var(--fg)]">Liquidations</td>
                <td className="p-3 text-[var(--accent)]">On-chain via DeepBook</td>
                <td className="p-3 text-[var(--fg-dim)]">More DeepBook volume; liquidations fully on Sui</td>
                <td className="p-3 text-[var(--fg-dim)]">Keeper / auction style</td>
                <td className="p-3 text-[var(--fg-dim)]">Keeper / protocol</td>
                <td className="p-3 text-[var(--fg-dim)]">Protocol / keeper</td>
                <td className="p-3 text-[var(--fg-dim)]">Protocol-based</td>
              </tr>
              <tr className="border-b border-[var(--border)]">
                <td className="p-3 font-medium text-[var(--fg)]">CEX / off-chain</td>
                <td className="p-3 text-[var(--accent)]">None; no CEX, no keepers</td>
                <td className="p-3 text-[var(--fg-dim)]">Shows Sui can do full lending stack without CEX or keepers</td>
                <td className="p-3 text-[var(--fg-dim)]">May use oracles / keepers</td>
                <td className="p-3 text-[var(--fg-dim)]">Oracle + execution infra</td>
                <td className="p-3 text-[var(--fg-dim)]">Security-focused, may use keepers</td>
                <td className="p-3 text-[var(--fg-dim)]">On-chain object model</td>
              </tr>
              <tr>
                <td className="p-3 font-medium text-[var(--fg)]">Focus</td>
                <td className="p-3 text-[var(--accent)]">Censorship-resistant P2P</td>
                <td className="p-3 text-[var(--fg-dim)]">Censorship-resistant lending; complements pooled protocols</td>
                <td className="p-3 text-[var(--fg-dim)]">Lending + liquid staking (SpringSui)</td>
                <td className="p-3 text-[var(--fg-dim)]">Liquidity + LSD integration</td>
                <td className="p-3 text-[var(--fg-dim)]">High TVL, user-friendly money market</td>
                <td className="p-3 text-[var(--fg-dim)]">Object-centric efficiency</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Go-to-market */}
      <section className="px-6 pb-16">
        <h2 className="mb-2 text-center text-xs uppercase tracking-wider text-[var(--fg-dim)] sm:text-sm">
          The Playbook
        </h2>
        <p className="mx-auto mb-6 max-w-xl text-center text-[0.6rem] leading-relaxed text-[var(--fg-dim)] sm:text-[0.7rem]">
          Ship lean, capture value at every layer, scale with the chain.
        </p>
        <div className="mx-auto grid w-full max-w-3xl gap-4 sm:grid-cols-3">
          <div className="pixel-border bg-[var(--panel)] p-5">
            <p className="mb-2 text-[0.65rem] font-medium uppercase tracking-wider text-[var(--accent)] sm:text-xs">
              Phase 1 &mdash; Ignite
            </p>
            <ul className="list-inside list-disc space-y-1.5 text-[0.6rem] leading-relaxed text-[var(--fg-dim)] sm:text-[0.7rem]">
              <li>Launch with SUI collateral &amp; one loan asset</li>
              <li>Target liquidators &amp; power users first</li>
              <li>Bootstrap with time-bound lender/borrower incentives</li>
            </ul>
          </div>
          <div className="pixel-border bg-[var(--panel)] p-5">
            <p className="mb-2 text-[0.65rem] font-medium uppercase tracking-wider text-[var(--accent)] sm:text-xs">
              Phase 2 &mdash; Scale
            </p>
            <ul className="list-inside list-disc space-y-1.5 text-[0.6rem] leading-relaxed text-[var(--fg-dim)] sm:text-[0.7rem]">
              <li>Expand collateral pairs as TVL grows</li>
              <li>Integrate Sui wallets &amp; DeFi dashboards</li>
              <li>Drive DeepBook volume &mdash; every fill is on-chain liquidity</li>
            </ul>
          </div>
          <div className="pixel-border bg-[var(--panel)] p-5">
            <p className="mb-2 text-[0.65rem] font-medium uppercase tracking-wider text-[var(--accent)] sm:text-xs">
              Phase 3 &mdash; Sustain
            </p>
            <ul className="list-inside list-disc space-y-1.5 text-[0.6rem] leading-relaxed text-[var(--fg-dim)] sm:text-[0.7rem]">
              <li>Protocol fee on fills (bps) + liquidator fee share</li>
              <li>Taper incentives &mdash; fees carry the protocol</li>
              <li>Broaden to retail with simple UX &amp; clear rate display</li>
            </ul>
          </div>
        </div>
      </section>

      <footer className="border-t-4 border-[var(--border)] bg-[var(--panel)] px-6 py-4 text-center text-[0.65rem] text-[var(--fg-dim)] sm:text-xs">
        Rain · No admin keys. No trusted relayers. No off-chain keepers.
      </footer>
    </Layout>
  );
}
