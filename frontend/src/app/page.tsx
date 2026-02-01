"use client";

import { useState } from "react";
import {
  ConnectModal,
  useCurrentAccount,
  useDisconnectWallet,
} from "@mysten/dapp-kit";

function truncateAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function Home() {
  const currentAccount = useCurrentAccount();
  const { mutate: disconnect } = useDisconnectWallet();
  const [connectOpen, setConnectOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header with wallet */}
      <header className="pixel-border flex items-center justify-between border-b-4 border-[var(--border)] bg-[var(--panel)] px-4 py-3">
        <span className="text-xs uppercase tracking-wider text-[var(--fg-dim)]">
          Rain · Sui
        </span>
        <div className="flex items-center gap-3">
          {currentAccount ? (
            <>
              <span
                className="text-xs text-[var(--fg)]"
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

      {/* Main content - 8-bit style */}
      <main className="flex flex-1 flex-col items-center justify-center gap-8 px-6 py-16 text-center">
        <h1 className="text-3xl uppercase tracking-wider sm:text-4xl">
          Rain
        </h1>
        <p className="max-w-xl text-xs leading-relaxed text-[var(--fg-dim)] sm:text-sm">
          Fully on-chain, non-custodial P2P lending on Sui. Rate discovery and
          liquidation via DeepBook — no CEX dependency, no off-chain keepers.
        </p>
        <div className="flex flex-wrap justify-center gap-3 text-xs">
          <span className="pixel-border rounded-none bg-[var(--panel)] px-4 py-2 uppercase">
            Borrow
          </span>
          <span className="pixel-border rounded-none bg-[var(--panel)] px-4 py-2 uppercase">
            Lend
          </span>
          <span className="pixel-border rounded-none bg-[var(--panel)] px-4 py-2 uppercase">
            Vaults
          </span>
          <span className="pixel-border rounded-none bg-[var(--panel)] px-4 py-2 uppercase">
            Liquidate
          </span>
        </div>
      </main>
    </div>
  );
}
