import Layout from "@/components/common/Layout";

export default function BorrowPage() {
  return (
    <Layout activePage="borrow">
      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-16 text-center">
        <h1 className="text-2xl uppercase tracking-wider sm:text-3xl">
          Borrow
        </h1>
        <p className="max-w-md text-xs text-[var(--fg-dim)]">
          Lock collateral in your vault, submit a borrow order. DeepBook matches
          with lenders. Coming soon.
        </p>
      </div>
    </Layout>
  );
}
