"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  ConnectModal,
  useCurrentAccount,
  useDisconnectWallet,
} from "@mysten/dapp-kit";

function truncateAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export type ActivePage =
  | "home"
  | "dashboard"
  | "vaults"
  | "deposit"
  | "borrow"
  | "lend"
  | "marketplace"
  | "escrow"
  | "repay"
  | "withdraw"
  | "liquidate";

interface HeaderProps {
  activePage?: ActivePage;
}

interface DropdownItem {
  href: string;
  label: string;
  page: ActivePage;
}

const BORROW_ITEMS: DropdownItem[] = [
  { href: "/vaults", label: "Vaults", page: "vaults" },
  { href: "/deposit", label: "Deposit", page: "deposit" },
  { href: "/borrow", label: "Place Order", page: "borrow" },
  { href: "/repay", label: "Repay", page: "repay" },
  { href: "/withdraw", label: "Withdraw", page: "withdraw" },
];

const LEND_ITEMS: DropdownItem[] = [
  { href: "/lend", label: "Place Order", page: "lend" },
  { href: "/escrow", label: "Escrow Fill", page: "escrow" },
];

const BORROW_PAGES = new Set<ActivePage>(BORROW_ITEMS.map((i) => i.page));
const LEND_PAGES = new Set<ActivePage>(LEND_ITEMS.map((i) => i.page));

function NavDropdown({
  label,
  items,
  activePage,
  pathname,
}: {
  label: string;
  items: DropdownItem[];
  activePage?: ActivePage;
  pathname: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const isGroupActive = items.some(
    (i) => activePage === i.page || pathname === i.href,
  );

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`rounded-none border-2 px-2 py-1 text-[0.6rem] uppercase tracking-wider sm:px-3 sm:py-1.5 sm:text-xs ${
          isGroupActive
            ? "border-[var(--accent)] bg-[var(--accent)]/20 text-[var(--accent)]"
            : "border-[var(--border)] bg-transparent text-[var(--fg-dim)] hover:border-[var(--fg-dim)] hover:text-[var(--fg)]"
        }`}
      >
        {label} &#9662;
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 min-w-[140px] border-2 border-[var(--border)] bg-[var(--bg)] shadow-lg">
          {items.map((item) => {
            const isActive =
              activePage === item.page || pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`block px-3 py-2 text-[0.6rem] uppercase tracking-wider sm:text-xs ${
                  isActive
                    ? "bg-[var(--accent)]/20 text-[var(--accent)]"
                    : "text-[var(--fg-dim)] hover:bg-[var(--panel)] hover:text-[var(--fg)]"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function Header({ activePage }: HeaderProps) {
  const pathname = usePathname();
  const currentAccount = useCurrentAccount();
  const { mutate: disconnect } = useDisconnectWallet();
  const [connectOpen, setConnectOpen] = useState(false);

  const linkClass = (page: ActivePage, href: string) =>
    `rounded-none border-2 px-2 py-1 text-[0.6rem] uppercase tracking-wider sm:px-3 sm:py-1.5 sm:text-xs ${
      activePage === page || pathname === href
        ? "border-[var(--accent)] bg-[var(--accent)]/20 text-[var(--accent)]"
        : "border-[var(--border)] bg-transparent text-[var(--fg-dim)] hover:border-[var(--fg-dim)] hover:text-[var(--fg)]"
    }`;

  return (
    <header className="sticky top-0 z-50 pixel-border flex flex-wrap items-center justify-between gap-3 border-b-4 border-[var(--border)] bg-[var(--panel)] px-4 py-3">
      <div className="flex items-center gap-4">
        <Link
          href="/"
          className="flex shrink-0 items-center text-[var(--fg)] hover:opacity-90"
          aria-label="Rain – Home"
        >
          <span className="flex h-9 w-24 items-center justify-center overflow-hidden sm:h-10 sm:w-28">
            <Image
              src="/images/rain-logo.png"
              alt="Rain"
              width={280}
              height={100}
              className="h-[115%] w-auto scale-110 object-contain object-center"
              priority
              unoptimized
            />
          </span>
        </Link>
        <nav className="flex flex-wrap items-center gap-1 sm:gap-2">
          <NavDropdown
            label="Borrow"
            items={BORROW_ITEMS}
            activePage={activePage}
            pathname={pathname}
          />
          <NavDropdown
            label="Lend"
            items={LEND_ITEMS}
            activePage={activePage}
            pathname={pathname}
          />
          <Link href="/marketplace" className={linkClass("marketplace", "/marketplace")}>
            Order Book
          </Link>
          <Link href="/liquidate" className={linkClass("liquidate", "/liquidate")}>
            Liquidate
          </Link>
        </nav>
      </div>
      <div className="flex items-center gap-2 sm:gap-3">
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
        <Link
          href="/dashboard"
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded border-2 border-[var(--border)] text-[var(--fg-dim)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)] sm:h-9 sm:w-9"
          aria-label="Dashboard"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 sm:h-5 sm:w-5">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
          </svg>
        </Link>
      </div>
    </header>
  );
}
