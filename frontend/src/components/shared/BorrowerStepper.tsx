"use client";

import Link from "next/link";

const STEPS = [
  { label: "Vault", shortLabel: "1", href: "/vaults" },
  { label: "Deposit", shortLabel: "2", href: "/deposit" },
  { label: "Borrow", shortLabel: "3", href: "/borrow" },
  { label: "Get Filled", shortLabel: "4", href: "/escrow" },
  { label: "Repay", shortLabel: "5", href: "/repay" },
  { label: "Withdraw", shortLabel: "6", href: "/withdraw" },
] as const;

interface BorrowerStepperProps {
  currentStep: 1 | 2 | 3 | 4 | 5 | 6;
}

export default function BorrowerStepper({ currentStep }: BorrowerStepperProps) {
  return (
    <div className="mb-6 flex items-center gap-0 overflow-x-auto">
      {STEPS.map((step, i) => {
        const stepNum = i + 1;
        const isActive = stepNum === currentStep;
        const isComplete = stepNum < currentStep;

        return (
          <div key={step.href} className="flex items-center">
            <Link
              href={step.href}
              className={`flex items-center gap-1.5 whitespace-nowrap px-2 py-1.5 text-[0.55rem] uppercase tracking-wider transition-colors sm:px-3 sm:text-[0.65rem] ${
                isActive
                  ? "bg-[var(--accent)]/20 text-[var(--accent)]"
                  : isComplete
                    ? "text-[var(--accent)]/60"
                    : "text-[var(--fg-dim)]/50"
              }`}
            >
              <span
                className={`flex h-4 w-4 items-center justify-center border text-[0.5rem] sm:h-5 sm:w-5 ${
                  isActive
                    ? "border-[var(--accent)] bg-[var(--accent)]/20"
                    : isComplete
                      ? "border-[var(--accent)]/40"
                      : "border-[var(--border)]"
                }`}
              >
                {stepNum}
              </span>
              <span className="hidden sm:inline">{step.label}</span>
            </Link>
            {i < STEPS.length - 1 && (
              <span
                className={`inline-block w-3 text-center text-[0.5rem] sm:w-6 ${
                  isComplete ? "text-[var(--accent)]/40" : "text-[var(--fg-dim)]/30"
                }`}
              >
                &rarr;
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
