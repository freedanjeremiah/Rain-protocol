"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ConnectModal,
  useCurrentAccount,
  useDisconnectWallet,
} from "@mysten/dapp-kit";

function truncateAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

type ActivePage = "home" | "vaults" | "deposit" | "borrow" | "lend" | "marketplace" | "repay" | "withdraw" | "liquidate";

interface HeaderProps {
  activePage?: ActivePage;
}

const NAV_LINKS: { href: string; label: string; page: ActivePage }[] = [
  { href: "/", label: "Home", page: "home" },
  { href: "/vaults", label: "Vaults", page: "vaults" },
  { href: "/deposit", label: "Deposit", page: "deposit" },
  { href: "/borrow", label: "Borrow", page: "borrow" },
  { href: "/lend", label: "Lend", page: "lend" },
  { href: "/marketplace", label: "Orders", page: "marketplace" },
  { href: "/repay", label: "Repay", page: "repay" },
  { href: "/withdraw", label: "Withdraw", page: "withdraw" },
  { href: "/liquidate", label: "Liquidate", page: "liquidate" },
];

export default function Header({ activePage }: HeaderProps) {
  const pathname = usePathname();
  const currentAccount = useCurrentAccount();
  const { mutate: disconnect } = useDisconnectWallet();
  const [connectOpen, setConnectOpen] = useState(false);

  const isActive = (page: ActivePage, href: string) =>
    activePage === page || (page !== "home" && pathname === href);

  return (
    <header className="pixel-border flex flex-wrap items-center justify-between gap-3 border-b-4 border-[var(--border)] bg-[var(--panel)] px-4 py-3">
      <div className="flex items-center gap-4">
        <Link
          href="/"
          className="text-xs font-medium uppercase tracking-wider text-[var(--fg)] hover:text-[var(--accent)]"
        >
          Rain · Sui
        </Link>
        <nav className="flex flex-wrap gap-1 sm:gap-2">
          {NAV_LINKS.map(({ href, label, page }) => (
            <Link
              key={href}
              href={href}
              className={`rounded-none border-2 px-2 py-1 text-[0.6rem] uppercase tracking-wider sm:px-3 sm:py-1.5 sm:text-xs ${
                isActive(page, href)
                  ? "border-[var(--accent)] bg-[var(--accent)]/20 text-[var(--accent)]"
                  : "border-[var(--border)] bg-transparent text-[var(--fg-dim)] hover:border-[var(--fg-dim)] hover:text-[var(--fg)]"
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="flex items-center gap-3">
        {currentAccount ? (
          <>
            <span
              className="hidden text-xs text-[var(--fg)] sm:inline"
              title={currentAccount.address}
            >
              {truncateAddress(currentAccount.address)}
            </span>
            <button
              type="button"
              className="pixel-btn pixel-btn-accent"
              onClick={() => {
                disconnect();
                setConnectOpen(false);
              }}
            >
              Disconnect
            </button>
          </>
        ) : (
          <ConnectModal
            trigger={
              <button
                type="button"
                className="pixel-btn pixel-btn-accent"
                onClick={() => setConnectOpen(true)}
              >
                Connect
              </button>
            }
            open={connectOpen}
            onOpenChange={setConnectOpen}
          />
        )}
      </div>
    </header>
  );
}
