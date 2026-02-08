"use client";

import Link from "next/link";
import Layout from "@/components/common/Layout";
import { WalletGate } from "@/components/shared/WalletGate";
import { useOwnedVaults } from "@/hooks/useOwnedVaults";
import { useOwnedLoanPositions } from "@/hooks/useOwnedLoanPositions";
import { useMarketplaceOrders } from "@/hooks/useMarketplaceOrders";
import {
  useActiveFillRequests,
  FillRequestData,
} from "@/hooks/useActiveFillRequests";
import { useCurrentAccount } from "@mysten/dapp-kit";

function isExpired(req: FillRequestData): boolean {
  return Date.now() >= Number(req.expiryMs);
}

export default function DashboardPage() {
  const account = useCurrentAccount();
  const myAddr = account?.address ?? "";

  const { vaults, isPending: vaultsLoading } = useOwnedVaults();
  const { positions, isPending: positionsLoading } = useOwnedLoanPositions();
  const { borrowOrders, lendOrders, isPending: ordersLoading } =
    useMarketplaceOrders();
  const { requests, isPending: fillsLoading } = useActiveFillRequests();

  const myBorrowOrders = borrowOrders.filter((o) => o.borrower === myAddr);
  const myLendOrders = lendOrders.filter((o) => o.lender === myAddr);

  const borrowerPositions = positions.filter((p) => p.borrower === myAddr);
  const lenderPositions = positions.filter((p) => p.lender === myAddr);

  const pendingFills = requests.filter((r) => r.status === 0);

  return (
    <Layout activePage="dashboard">
      <WalletGate>
        <div className="mx-auto max-w-3xl px-6 py-10">
          <h1 className="mb-8 text-2xl uppercase tracking-wider sm:text-3xl">
            Dashboard
          </h1>

          {/* My Vaults */}
          <section className="mb-8">
            <h2 className="mb-3 text-sm uppercase tracking-wider text-[var(--fg-dim)]">
              My Vaults
            </h2>
            {vaultsLoading ? (
              <p className="text-xs text-[var(--fg-dim)]">Loading...</p>
            ) : vaults.length === 0 ? (
              <div className="pixel-border bg-[var(--panel)] p-4 text-xs">
                <p className="text-[var(--fg-dim)]">No vaults yet.</p>
                <Link
                  href="/vaults"
                  className="mt-2 inline-block text-[var(--accent)]"
                >
                  Create a vault &rarr;
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {vaults.map((v) => {
                  const hasCollateral = Number(v.balance) > 0;
                  const hasDebt = v.debt !== "0";
                  let action: { label: string; href: string } | null = null;
                  if (!hasCollateral && !hasDebt)
                    action = { label: "Deposit", href: "/deposit" };
                  else if (hasCollateral && !hasDebt)
                    action = { label: "Borrow", href: "/borrow" };
                  else if (hasDebt)
                    action = { label: "Repay", href: "/repay" };

                  return (
                    <div
                      key={v.objectId}
                      className="pixel-border flex flex-wrap items-center justify-between gap-2 bg-[var(--panel)] p-3 text-xs"
                    >
                      <div className="space-y-0.5">
                        <p>
                          <span className="text-[var(--fg-dim)]">Vault:</span>{" "}
                          {v.objectId.slice(0, 12)}...
                        </p>
                        <p>
                          <span className="text-[var(--fg-dim)]">
                            Collateral:
                          </span>{" "}
                          {v.balance} MIST
                        </p>
                        <p>
                          <span className="text-[var(--fg-dim)]">Debt:</span>{" "}
                          {v.debt}
                        </p>
                      </div>
                      {action && (
                        <Link
                          href={action.href}
                          className="pixel-btn pixel-btn-accent"
                        >
                          {action.label}
                        </Link>
                      )}
                      {!hasDebt && hasCollateral && (
                        <Link href="/withdraw" className="pixel-btn">
                          Withdraw
                        </Link>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* My Orders */}
          <section className="mb-8">
            <h2 className="mb-3 text-sm uppercase tracking-wider text-[var(--fg-dim)]">
              My Orders
            </h2>
            {ordersLoading ? (
              <p className="text-xs text-[var(--fg-dim)]">Loading...</p>
            ) : myBorrowOrders.length === 0 && myLendOrders.length === 0 ? (
              <div className="pixel-border bg-[var(--panel)] p-4 text-xs">
                <p className="text-[var(--fg-dim)]">No open orders.</p>
                <div className="mt-2 flex gap-2">
                  <Link
                    href="/borrow"
                    className="text-[var(--accent)]"
                  >
                    Place borrow order &rarr;
                  </Link>
                  <Link
                    href="/lend"
                    className="text-[var(--accent)]"
                  >
                    Place lend order &rarr;
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {myBorrowOrders.map((o) => (
                  <div
                    key={o.objectId}
                    className="pixel-border flex flex-wrap items-center justify-between gap-2 bg-[var(--panel)] p-3 text-xs"
                  >
                    <div className="space-y-0.5">
                      <p>
                        <span className="text-[var(--fg-dim)]">Borrow:</span>{" "}
                        {o.objectId.slice(0, 10)}...
                      </p>
                      <p>
                        <span className="text-[var(--fg-dim)]">
                          Remaining:
                        </span>{" "}
                        {o.remaining} |{" "}
                        {(Number(o.maxInterestBps) / 100).toFixed(1)}% max |{" "}
                        {Math.floor(Number(o.durationSecs) / 86400)}d
                      </p>
                    </div>
                    <Link href="/marketplace" className="pixel-btn">
                      View
                    </Link>
                  </div>
                ))}
                {myLendOrders.map((o) => (
                  <div
                    key={o.objectId}
                    className="pixel-border flex flex-wrap items-center justify-between gap-2 bg-[var(--panel)] p-3 text-xs"
                  >
                    <div className="space-y-0.5">
                      <p>
                        <span className="text-[var(--fg-dim)]">Lend:</span>{" "}
                        {o.objectId.slice(0, 10)}...
                      </p>
                      <p>
                        <span className="text-[var(--fg-dim)]">
                          Remaining:
                        </span>{" "}
                        {o.remaining} |{" "}
                        {(Number(o.minInterestBps) / 100).toFixed(1)}% min |{" "}
                        {Math.floor(Number(o.durationSecs) / 86400)}d
                      </p>
                    </div>
                    <Link href="/marketplace" className="pixel-btn">
                      View
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* My Loan Positions */}
          <section className="mb-8">
            <h2 className="mb-3 text-sm uppercase tracking-wider text-[var(--fg-dim)]">
              My Loan Positions
            </h2>
            {positionsLoading ? (
              <p className="text-xs text-[var(--fg-dim)]">Loading...</p>
            ) : borrowerPositions.length === 0 &&
              lenderPositions.length === 0 ? (
              <p className="text-xs text-[var(--fg-dim)]">
                No loan positions.
              </p>
            ) : (
              <div className="space-y-2">
                {borrowerPositions.map((p) => (
                  <div
                    key={p.objectId}
                    className="pixel-border flex flex-wrap items-center justify-between gap-2 bg-[var(--panel)] p-3 text-xs"
                  >
                    <div className="space-y-0.5">
                      <p>
                        <span className="text-[var(--fg-dim)]">
                          Loan (borrower):
                        </span>{" "}
                        {p.objectId.slice(0, 10)}...
                      </p>
                      <p>
                        <span className="text-[var(--fg-dim)]">
                          Principal:
                        </span>{" "}
                        {p.principal} |{" "}
                        {p.rateBps} bps |{" "}
                        {Math.floor(Number(p.termSecs) / 86400)}d
                      </p>
                    </div>
                    <Link href="/repay" className="pixel-btn pixel-btn-accent">
                      Repay
                    </Link>
                  </div>
                ))}
                {lenderPositions.map((p) => (
                  <div
                    key={p.objectId}
                    className="pixel-border flex flex-wrap items-center justify-between gap-2 bg-[var(--panel)] p-3 text-xs"
                  >
                    <div className="space-y-0.5">
                      <p>
                        <span className="text-[var(--fg-dim)]">
                          Loan (lender):
                        </span>{" "}
                        {p.objectId.slice(0, 10)}...
                      </p>
                      <p>
                        <span className="text-[var(--fg-dim)]">
                          Principal:
                        </span>{" "}
                        {p.principal} |{" "}
                        {p.rateBps} bps |{" "}
                        Borrower: {p.borrower.slice(0, 8)}...
                      </p>
                    </div>
                    <Link href="/repay" className="pixel-btn pixel-btn-accent">
                      Transfer
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Pending Escrow */}
          <section>
            <h2 className="mb-3 text-sm uppercase tracking-wider text-[var(--fg-dim)]">
              Pending Escrow
            </h2>
            {fillsLoading ? (
              <p className="text-xs text-[var(--fg-dim)]">Loading...</p>
            ) : pendingFills.length === 0 ? (
              <p className="text-xs text-[var(--fg-dim)]">
                No pending fill requests.
              </p>
            ) : (
              <div className="space-y-2">
                {pendingFills.map((r) => {
                  const expired = isExpired(r);
                  const isBorrower = r.borrower === myAddr;
                  const isLender = r.lender === myAddr;
                  let action: { label: string; href: string } | null = null;
                  if (isBorrower && !expired)
                    action = { label: "Complete Fill", href: "/escrow" };
                  if (isLender && expired)
                    action = { label: "Cancel & Reclaim", href: "/escrow" };

                  return (
                    <div
                      key={r.objectId}
                      className={`pixel-border flex flex-wrap items-center justify-between gap-2 p-3 text-xs ${
                        expired
                          ? "border-yellow-500/50 bg-yellow-500/10"
                          : "bg-[var(--panel)]"
                      }`}
                    >
                      <div className="space-y-0.5">
                        <p>
                          <span className="text-[var(--fg-dim)]">
                            Request:
                          </span>{" "}
                          {r.objectId.slice(0, 12)}...
                        </p>
                        <p>
                          <span className="text-[var(--fg-dim)]">Amount:</span>{" "}
                          {r.fillAmount} MIST |{" "}
                          Role: {isBorrower ? "Borrower" : "Lender"}
                          {expired && " | EXPIRED"}
                        </p>
                      </div>
                      {action && (
                        <Link
                          href={action.href}
                          className="pixel-btn pixel-btn-accent"
                        >
                          {action.label}
                        </Link>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </WalletGate>
    </Layout>
  );
}
