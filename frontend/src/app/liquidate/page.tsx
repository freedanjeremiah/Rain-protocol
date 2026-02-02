import Layout from "@/components/common/Layout";

export default function LiquidatePage() {
  return (
    <Layout activePage="liquidate">
      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-16 text-center">
        <h1 className="text-2xl uppercase tracking-wider sm:text-3xl">
          Liquidate
        </h1>
        <p className="max-w-md text-xs text-[var(--fg-dim)]">
          Execute liquidations on-chain via DeepBook. No keeper bots; anyone
          can call liquidate. Collateral sold on DeepBook, debt repaid,
          liquidator rewarded. Coming soon.
        </p>
      </div>
    </Layout>
  );
}
