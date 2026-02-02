import Layout from "@/components/common/Layout";

export default function LendPage() {
  return (
    <Layout activePage="lend">
      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-16 text-center">
        <h1 className="text-2xl uppercase tracking-wider sm:text-3xl">
          Lend
        </h1>
        <p className="max-w-md text-xs text-[var(--fg-dim)]">
          Submit a lend order. DeepBook matches with borrowers. Interest accrues
          over time. Coming soon.
        </p>
      </div>
    </Layout>
  );
}
