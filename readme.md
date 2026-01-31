# 📌 Rain sui

**We fix fake P2P:** rate discovery and liquidation execution both use Sui’s DeepBook — no CEX dependency, no off-chain keepers.

---

# 1️⃣ PROBLEM (very clearly defined)

### The real problem (not marketing fluff)

Today’s “P2P lending” in crypto is **not truly peer-to-peer** — that’s the “fake P2P” Rain fixes.

Even when users lend/borrow from each other:

1. **Price discovery is centralized**

   * Interest rates, liquidation prices, and execution often depend on CEXs like Binance
   * These systems are opaque, censorable, and manipulable

2. **Liquidity is pooled**

   * Users lose individual control
   * Risk is socialized
   * Rates are averaged → inefficient capital allocation

3. **Custody is weakened**

   * Funds are controlled by protocols or centralized actors
   * Similar trust assumptions to Binance, just on-chain

4. **Liquidations rely on off-chain actors**

   * Keeper bots
   * Auctions
   * MEV extraction
   * Partial opacity

---

### Why this matters

A **single centralized venue** (or off-chain keepers) can:

* Halt withdrawals
* Freeze markets
* Manipulate prices
* Cascade liquidations

That’s the fake P2P we fix: Rain uses DeepBook for rate discovery and liquidation, so no CEX dependency and no off-chain keepers.

---

# 2️⃣ SOLUTION (one sentence)

> **Rain is a fully on-chain, non-custodial P2P lending marketplace on Sui: rate discovery and liquidation execution both run through DeepBook orderbooks, with no CEX dependency and no off-chain keepers; risk is secured using decentralized oracles.**

---

# 3️⃣ CORE DESIGN PRINCIPLES (how Rain fixes fake P2P)

1. **No pooled liquidity** — true P2P, no protocol-controlled pools
2. **User-owned vaults** — non-custodial; users keep control
3. **Orderbook-based rate discovery** — rates from DeepBook, not CEX or algo
4. **Oracle-based risk checks** — Pyth for LTV/liquidation, not centralized feeds
5. **On-chain liquidation execution** — via DeepBook; no keeper bots or off-chain logic
6. **Composable, censorship-resistant** — no single point of failure

---

# 4️⃣ ACTORS (ALL of them)

| Actor                  | Role in Rain                                       |
| ---------------------- | -------------------------------------------------- |
| Borrower               | Locks collateral, borrows assets                   |
| Lender                 | Supplies assets, earns yield                       |
| Liquidator             | Executes liquidations on-chain via DeepBook        |
| Oracle Provider (Pyth) | Secure price feeds for risk (no CEX dependency)    |
| DeepBook               | Rate discovery + matching + liquidation execution |
| Protocol Contracts     | Enforce rules (no custody, no relayers)            |
| Frontend (optional)    | UX only                                            |

No admin keys. No trusted relayers. No off-chain keepers.

---

# 5️⃣ SYSTEM ARCHITECTURE (HIGH LEVEL)

Rain: rate discovery and liquidation both go through DeepBook; oracles only for risk.

```
┌───────────────────────────────────────┐
│               Frontend                │
└───────────────┬───────────────────────┘
                │
┌───────────────▼───────────────────────┐
│      Rain Lending Marketplace         │
│  (Orderbook + Loan Coordination)       │
└───────────────┬───────────────────────┘
                │
     ┌──────────▼──────────┐
     │   User Vaults       │
     │ (Collateral & Debt) │
     └──────────┬──────────┘
                │
 ┌──────────────▼──────────────┐
 │ Risk & Liquidation Engine   │
 └───────┬─────────────┬───────┘
         │             │
┌────────▼──────┐ ┌────▼────────┐
│   Pyth Oracle │ │   DeepBook   │
│ (Risk Price)  │ │ (Execution) │
└───────────────┘ └─────────────┘
```

---

# 6️⃣ CONTRACTS (VERY IMPORTANT)

Rain has **7 core contracts/modules**.

---

## 1. `UserVault` (per-user, non-custodial)

### Purpose

Holds:

* Collateral
* Borrowed assets
* Debt accounting

### Responsibilities

* Lock collateral
* Track debt
* Allow withdrawals only if healthy

### Key State

```move
struct Vault {
    owner: address,
    collateral: Balance<SUI>,
    debt: Balance<USDC>,
    liquidation_threshold: u64,
}
```

### Interacts with

* RiskEngine
* Rain LendingMarketplace
* LiquidationEngine

---

## 2. `LendingMarketplace` (Rain core logic)

### Purpose

Coordinates:

* Loan creation
* Order placement
* Loan matching

### What it does

* Accepts borrow orders
* Accepts lend orders
* Forwards them to DeepBook

### Does NOT

* Hold funds
* Set prices
* Decide rates

### Interacts with

* DeepBook (rate discovery + execution)
* UserVault

---

## 3. `LoanOrder` (data structure)

### Purpose

Standardizes loan intents.

### Borrow Order

```move
struct BorrowOrder {
    borrower: address,
    asset: USDC,
    amount: u64,
    max_interest: u64,
    duration: u64,
}
```

### Lend Order

```move
struct LendOrder {
    lender: address,
    asset: USDC,
    amount: u64,
    min_interest: u64,
    duration: u64,
}
```

---

## 4. `DeepBookAdapter`

### Purpose

Acts as a **thin adapter**, not a relayer.

### Responsibilities

* Submits orders to DeepBook
* Reads matched results
* Settles trades

### Why needed

* Clean abstraction
* Replaceable
* Hackathon-friendly

### Interacts with

* DeepBook
* Rain LendingMarketplace

---

## 5. `RiskEngine`

### Purpose

Safety layer.

### Uses

* **Pyth Oracle prices**
* Not DeepBook prices

### Responsibilities

* Calculate LTV
* Check borrow limits
* Determine liquidation eligibility

### Formula

```
BorrowLimit = CollateralValue * LTV
```

### Interacts with

* UserVault
* OracleAdapter

---

## 6. `OracleAdapter`

### Purpose

Standard interface to price feeds.

### Uses

* Pyth
* Switchboard (optional)

### Why separate

* Replaceable
* Auditable
* Clean architecture

---

## 7. `LiquidationEngine`

### Purpose

Fully on-chain liquidation.

### Workflow

1. RiskEngine flags unhealthy vault
2. Liquidator calls `liquidate(vault)`
3. Collateral is sold via DeepBook
4. Debt is repaid
5. Bonus goes to liquidator

### Key feature (pitch-aligned)

* **DeepBook is the liquidation execution engine** — no CEX, no keeper bots, no off-chain logic
* No auctions; orderbook execution only

---

# 7️⃣ COMPLETE WORKFLOWS

---

## 🟢 Borrow Flow

1. User deposits collateral into `UserVault`
2. RiskEngine checks health
3. User submits BorrowOrder
4. Order goes to DeepBook
5. Lender order matches
6. Funds move directly lender → borrower
7. Vault debt updated

---

## 🔵 Lend Flow

1. Lender submits LendOrder
2. Funds locked temporarily
3. DeepBook matches with borrower
4. Loan created
5. Interest accrues over time

---

## 🔴 Repayment Flow

1. Borrower repays principal + interest
2. Vault debt cleared
3. Collateral unlocked
4. Lender receives funds

---

## ⚠️ Liquidation Flow (IMPORTANT)

1. Oracle price updates
2. RiskEngine detects unhealthy vault
3. Anyone can call `liquidate`
4. LiquidationEngine sells collateral on DeepBook
5. Best on-chain price used
6. Debt repaid
7. Liquidator rewarded

---

# 8️⃣ WHY RAIN IS DIFFERENT (fake P2P vs Rain)

| Feature          | Typical / SuiLend | Rain sui                          |
| ---------------- | ----------------- | --------------------------------- |
| Liquidity        | Pooled            | P2P                               |
| Rate discovery   | Algorithmic / CEX | DeepBook orderbook                |
| Execution        | Internal / CEX    | DeepBook                          |
| Custody          | Protocol          | User vault (non-custodial)        |
| Liquidations     | Auctions / keepers| On-chain via DeepBook             |
| CEX dependency   | Often yes         | No                                |
| Off-chain keepers| Often yes         | No                                |

---

# 9️⃣ WHY RAIN MAXIMIZES SUI

Rain’s pitch is built on Sui: **rate discovery and liquidation execution both use DeepBook — no CEX dependency, no off-chain keepers.**

✅ **DeepBook** — core infra for both rates and liquidation (not just “on Sui”)  
✅ **Parallel execution** — object-based vaults, no global lock  
✅ **No relayers, no keepers** — fully on-chain flows  
✅ **No centralized execution** — orderbook + oracles only  

This design is **not portable** to Ethereum in the same way; it’s Sui-native.
---

