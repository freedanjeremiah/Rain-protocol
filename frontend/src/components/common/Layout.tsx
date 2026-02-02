"use client";

import { ReactNode } from "react";
import Header from "./Header";

type ActivePage = "home" | "borrow" | "lend" | "vaults" | "liquidate";

interface LayoutProps {
  children: ReactNode;
  activePage?: ActivePage;
}

export default function Layout({ children, activePage = "home" }: LayoutProps) {
  return (
    <div className="flex min-h-screen flex-col">
      <Header activePage={activePage} />
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
