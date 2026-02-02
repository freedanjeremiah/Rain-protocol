import Layout from "@/components/common/Layout";

export default function VaultsPage() {
  return (
    <Layout activePage="vaults">
      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-16 text-center">
        <h1 className="text-2xl uppercase tracking-wider sm:text-3xl">
          Vaults
        </h1>
        <p className="max-w-md text-xs text-[var(--fg-dim)]">
          Your non-custodial vault: collateral, borrowed assets, debt
          accounting. Withdraw only when healthy. Coming soon.
        </p>
      </div>
    </Layout>
  );
}
