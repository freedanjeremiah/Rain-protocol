"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { useCurrentAccount } from "@mysten/dapp-kit";

export function WalletGate({ children }: { children: ReactNode }) {
  const account = useCurrentAccount();
  if (!account) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-16 text-center">
        <p className="text-sm text-[var(--fg-dim)]">
          Connect your wallet to use this page.
        </p>
        <Link
          href="/"
          className="pixel-btn pixel-btn-accent"
        >
          Go home
        </Link>
      </div>
    );
  }
  return <>{children}</>;
}
