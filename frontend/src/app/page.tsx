export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 font-sans text-zinc-100">
      <main className="flex max-w-2xl flex-col items-center gap-8 px-6 py-20 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Rain
        </h1>
        <p className="text-lg text-zinc-400">
          Fully on-chain, non-custodial P2P lending on Sui. Rate discovery and liquidation via DeepBook — no CEX dependency, no off-chain keepers.
        </p>
        <div className="flex flex-wrap justify-center gap-4 text-sm">
          <span className="rounded-full bg-zinc-800 px-4 py-2">Borrow</span>
          <span className="rounded-full bg-zinc-800 px-4 py-2">Lend</span>
          <span className="rounded-full bg-zinc-800 px-4 py-2">Vaults</span>
          <span className="rounded-full bg-zinc-800 px-4 py-2">Liquidate</span>
        </div>
      </main>
    </div>
  );
}
