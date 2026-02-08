
# 📌 Rain

**We fix fake P2P.** Most “P2P” lending still depends on CEXs for rates and keeper bots for liquidations. Rain runs rate discovery and liquidation execution on Sui’s DeepBook — no CEX, no off-chain keepers. Real peer-to-peer, on-chain.

---

# 1️⃣ PROBLEM (very clearly defined)

### The real problem (not marketing fluff)

Today’s “P2P lending” in crypto is **not truly peer-to-peer**.

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

A **single centralized venue** can:

* Halt withdrawals
* Freeze markets
* Manipulate prices
* Cascade liquidations

This breaks the promise of DeFi.

---

# 2️⃣ SOLUTION (one sentence)

> **Build a fully on-chain, non-custodial P2P lending marketplace on Sui where interest rates and liquidation execution are discovered through DeepBook orderbooks, while risk is secured using decentralized oracles. User funds are held in a custody contract and move only on rule satisfaction or adjudicator authorization (no protocol key can unilaterally move assets).**

---

# 3️⃣ CORE DESIGN PRINCIPLES

1. **No pooled liquidity**
2. **User-owned vaults**
3. **Custody + Adjudicator pattern** – assets held in a custody contract; movement only on rule satisfaction or adjudicator authorization (no protocol key can unilaterally move user funds)
4. **Orderbook-based rate discovery**
5. **Oracle-based risk checks**
6. **On-chain liquidation execution**
7. **Partial fills** – borrow and lend orders may be filled in multiple matches; each fill creates a loan position; vault debt is the sum of all positions
8. **Composable, censorship-resistant**

**Note:** DeepBook DEX integrations are on **mainnet**; Rain’s DeepBookAdapter and deployment config target mainnet for pool IDs and execution.

---

# 4️⃣ ACTORS (ALL of them)

| Actor                  | Role                                                                 |
| ---------------------- | -------------------------------------------------------------------- |
| Borrower               | Locks collateral, borrows assets                                    |
| Lender                 | Supplies assets, earns yield                                        |
| Liquidator             | Executes liquidations (via Adjudicator authorization)                |
| Oracle Provider (Pyth) | Provides secure price feeds                                         |
| DeepBook               | On-chain matching & execution                                       |
| **Escrow contract**    | Locks lender funds for async fill; borrower completes or lender reclaims after expiry        |
| **Custody contract**   | Holds collateral (and optional escrow); releases only on rules or Adjudicator authorization |
| **Adjudicator contract** | Authorizes releases (repayment, liquidation, disputes) from evidence; does not hold funds |
| Protocol Contracts     | Enforce rules (RiskEngine, LendingMarketplace, etc.)                  |
| Frontend (optional)    | UX only                                                              |

No admin keys. No trusted relayers.

---

# 5️⃣ SYSTEM ARCHITECTURE (HIGH LEVEL)

```
┌───────────────────────────────────────┐
│               Frontend                │
└───────────────┬───────────────────────┘
                │
┌───────────────▼───────────────────────┐
│         Lending Marketplace            │
│  (Orderbook + Loan Coordination)       │
└───────────────┬───────────────────────┘
                │
     ┌──────────▼──────────┐
     │   User Vaults        │
     │ (State & Accounting) │
     └──────────┬──────────┘
                │
     ┌──────────▼──────────┐      ┌─────────────────────┐
     │  Custody Contract    │◄─────│  Adjudicator        │
     │  (holds collateral;  │      │  (authorizes        │
     │   moves only on      │      │   releases from     │
     │   Adjudicator/rules) │      │   evidence; no      │
     └──────────┬──────────┘      │   custody)           │
                │                 └──────────┬──────────┘
 ┌──────────────▼──────────────┐             │
 │ Risk & Liquidation Engine   │─────────────┘
 └───────┬─────────────┬───────┘
         │             │
┌────────▼──────┐ ┌────▼────────┐
│   Pyth Oracle │ │   DeepBook   │
│ (Risk Price)  │ │ (Execution) │
└───────────────┘ └─────────────┘
```

---

# 6️⃣ CONTRACTS (VERY IMPORTANT)

You will have **10 core contracts/modules**.

---

## 1. `UserVault` (per-user, non-custodial)

### Purpose

Tracks **state and accounting** for a user’s position. Does **not** hold the actual collateral; the **Custody** contract holds assets. UserVault records:

* Collateral balance (reference to Custody)
* Borrowed assets / debt accounting
* Liquidation threshold

### Responsibilities

* Record lock/unlock of collateral (Custody performs the actual move on Adjudicator or rule satisfaction)
* Track debt
* Withdrawals only when healthy – enforced by Custody checking rules + optional Adjudicator attestation

### Key State

```move
struct Vault {
    owner: address,
    custody_id: ID,           // reference to Custody holding this vault’s collateral
    collateral_balance: u64,
    debt: Balance<USDC>,
    liquidation_threshold: u64,
}
```

### Interacts with

* Custody
* Adjudicator (indirectly via Custody)
* RiskEngine
* LendingMarketplace
* LiquidationEngine

---

## 2. `LendingMarketplace` (core logic)

### Purpose

Coordinates:

* Loan creation
* Order placement
* Loan matching
* **Partial fills** – orders are filled in one or more matches; each match creates a loan position

### What it does

* Accepts borrow orders and lend orders (with `amount`, `filled_amount`, `remaining`)
* Forwards orders to DeepBook; consumes fill results from DeepBook (or matches in Move)
* On each fill (full or partial): updates both orders’ `filled_amount`, creates a **LoanPosition** (borrower, lender, principal, rate, term), moves principal lender → borrower
* Vault debt = sum of all position principals (and accrued interest) for that vault

### Does NOT

* Hold funds
* Set prices
* Decide rates

### Interacts with

* DeepBook (mainnet)
* UserVault

---

## 3. `LoanOrder` (data structure)

### Purpose

Standardizes loan intents. Orders support **partial fills**: `filled_amount` and `remaining` are updated on each match until the order is fully filled or cancelled.

### Borrow Order

```move
struct BorrowOrder {
    borrower: address,
    asset: USDC,
    amount: u64,           // total size
    filled_amount: u64,    // sum of fills so far
    max_interest: u64,
    duration: u64,
}
// remaining = amount - filled_amount
```

### Lend Order

```move
struct LendOrder {
    lender: address,
    asset: USDC,
    amount: u64,
    filled_amount: u64,
    min_interest: u64,
    duration: u64,
}
```

### Loan position (per fill)

Each partial fill creates a **LoanPosition** (borrower, lender, principal = fill size, rate, term). Vault debt = sum of principals (and interest) of all positions for that vault.

---

## 4. `DeepBookAdapter`

### Purpose

Acts as a **thin adapter**, not a relayer. Integrates with **DeepBook on mainnet** (DEX integrations are mainnet).

### Responsibilities

* Submits orders to DeepBook
* Reads matched results and **partial fills** (each fill: size, price/counterparty)
* Settles trades; LendingMarketplace updates order `filled_amount` and creates LoanPosition per fill

### Why needed

* Clean abstraction
* Replaceable
* Hackathon-friendly

### Interacts with

* DeepBook (mainnet)
* LendingMarketplace

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

* UserVault (state for LTV / liquidation checks)
* OracleAdapter
* Adjudicator (liquidation evidence is derived from RiskEngine output)

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

Fully on-chain liquidation. Does **not** move collateral directly; it requests **Adjudicator** authorization, then **Custody** performs the release.

### Workflow

1. RiskEngine flags unhealthy vault (oracle price + LTV)
2. Liquidator calls `liquidate(vault)`
3. LiquidationEngine submits evidence (oracle price, vault state) to **Adjudicator**
4. Adjudicator attests **liquidate** → authorizes Custody to release collateral to liquidator
5. Custody releases collateral; LiquidationEngine sells it via DeepBook
6. Debt repaid; bonus to liquidator

### Key feature

* **DeepBook is the execution engine**
* **Custody + Adjudicator** – no protocol key moves funds; only Adjudicator authorization
* No auctions, no keepers, no off-chain logic

### Interacts with

* Adjudicator
* Custody (via Adjudicator authorization)
* RiskEngine
* DeepBookAdapter

---

## 8. `Custody` (per-user or per-vault)

### Purpose

**Holds** user collateral (and optionally escrowed loan principal). Does **not** compute LTV or decide liquidations. Moves assets **only** when:

* **Rules:** owner withdraw when vault is healthy (e.g. debt zero or rule-based check), or
* **Adjudicator authorization:** release to owner (repayment verified), to liquidator (liquidation allowed), or to borrower (loan matched).

### Responsibilities

* Accept collateral deposits from owner
* Release collateral **only** on (1) rule satisfaction (e.g. healthy withdraw), or (2) valid **Adjudicator** authorization
* No admin key; no protocol key can unilaterally move funds

### Does NOT

* Compute LTV or liquidation eligibility
* Hold any business logic beyond “release iff rules or Adjudicator say so”

### Interacts with

* Adjudicator (reads authorizations)
* UserVault (state reference)

---

## 9. `Adjudicator`

### Purpose

**Authorizes** releases from Custody. Does **not** hold any assets. Consumes **evidence** (oracle price, vault state, repayment proof, dispute submissions) and outputs **authorizations** (e.g. “release collateral to owner,” “release to liquidator”).

### Responsibilities

* **Repayment:** On repayment proof (e.g. debt cleared in LendingMarketplace) → authorize “release collateral to owner”
* **Liquidation:** On Pyth price + vault state showing LTV above threshold → authorize “release collateral to liquidator”
* **Disputes (optional):** On evidence from both sides → authorize release to rightful party

### Does NOT

* Hold funds
* Act as a relayer or keeper

### Interacts with

* Custody (issues authorizations)
* RiskEngine / LiquidationEngine (submit evidence for liquidation)
* OracleAdapter (price evidence)

---

## 10. `Escrow` (escrow-based fill)

### Purpose

Provides an alternative fill path where the **lender locks funds first** and the **borrower completes the fill later**. This removes the need for off-chain coordination between lender and borrower.

### Why needed

The standard fill flow (`marketplace::fill_order`) requires the borrower to sign the transaction with their vault in real time. This means both parties must coordinate off-chain. The escrow flow decouples them: the lender commits funds on their own schedule, and the borrower completes when ready.

### Workflow

1. **Lender commits:** Calls `lender_commit_fill` with a borrow order, their lend order, and the fill amount. The function validates order compatibility (rate, remaining capacity), splits the fill amount from the lender's coin, and creates a shared `FillRequest` object with the locked funds and an expiry timestamp.
2. **Borrower completes:** Calls `borrower_complete_fill` before expiry. The function drains the escrow balance, delegates to `marketplace::execute_fill` (which creates a `LoanPosition`, transfers principal to borrower, updates vault debt), and marks the request as COMPLETED.
3. **Lender cancels (if expired):** If the borrower does not complete before expiry, the lender calls `lender_cancel_fill` to reclaim the locked funds. The request is marked CANCELLED.

### Key State

```move
struct FillRequest has key, store {
    id: UID,
    borrow_order_id: ID,
    lend_order_id: ID,
    fill_amount: u64,
    lender: address,
    borrower: address,
    vault_id: ID,
    expiry_ms: u64,
    locked_balance: Balance<SUI>,
    status: u8,    // 0=PENDING, 1=COMPLETED, 2=CANCELLED
}
```

### Interacts with

* LendingMarketplace (reads orders for validation, calls `execute_fill` on completion)
* UserVault (borrower's vault passed to `execute_fill`)
* Pyth Oracle (price check during `execute_fill`)

---

# 7️⃣ COMPLETE WORKFLOWS

---

## 🟢 Borrow Flow

1. User deposits collateral into **Custody** (linked to UserVault)
2. RiskEngine checks health
3. User submits BorrowOrder (amount, max_interest, duration)
4. Order goes to DeepBook (mainnet)
5. Lender order(s) match – **partial fills enabled**: each fill updates both orders’ `filled_amount`, creates a **LoanPosition**, moves principal lender → borrower
6. Vault debt = sum of all position principals (and interest); repeat until order fully filled or cancelled

---

## 🔵 Lend Flow

1. Lender submits LendOrder (amount, min_interest, duration)
2. Funds locked temporarily (Custody or escrow as designed)
3. DeepBook (mainnet) matches with borrower(s) – **partial fills**: lend order can fill across multiple borrow orders
4. Each fill creates a LoanPosition; interest accrues per position over time

---

## 🔴 Repayment Flow

1. Borrower repays principal + interest
2. Vault debt cleared in LendingMarketplace / UserVault
3. **Adjudicator** attests repayment → authorizes **Custody** to release collateral to owner
4. Custody releases collateral; lender receives funds

---

## 🟡 Escrow Fill Flow

Rain supports two fill paths:

* **Direct Fill (Order Book):** The borrower signs the fill transaction with their vault in one step. Both parties must be present.
* **Escrow Fill:** The lender locks funds first; the borrower completes when ready. No off-chain coordination.

### Escrow steps

1. Lender calls `lender_commit_fill` — funds locked in a shared `FillRequest` with an expiry
2. Borrower sees the pending request and calls `borrower_complete_fill` before expiry
3. Escrow drains into `marketplace::execute_fill` — `LoanPosition` created, principal transferred, vault debt updated
4. If borrower does not complete before expiry, lender calls `lender_cancel_fill` to reclaim funds

---

## ⚠️ Liquidation Flow (IMPORTANT)

1. Oracle price updates
2. RiskEngine detects unhealthy vault
3. Anyone calls `liquidate`; LiquidationEngine submits evidence to **Adjudicator**
4. **Adjudicator** attests liquidation allowed → authorizes **Custody** to release collateral to liquidator
5. Custody releases; LiquidationEngine sells collateral on DeepBook
6. Best on-chain price used; debt repaid; liquidator rewarded

---

# 8️⃣ WHY THIS IS DIFFERENT FROM SuiLend

| Feature          | SuiLend      | Your Protocol                    |
| ---------------- | ------------ | -------------------------------- |
| Liquidity        | Pooled       | P2P                              |
| Rates            | Algorithmic  | Market-discovered                |
| Execution        | Internal     | DeepBook                         |
| Custody          | Protocol     | Custody contract + Adjudicator   |
| Liquidations     | Auctions     | Orderbook + Adjudicator auth     |
| Price dependency | Oracles only | Oracle + DeepBook                |

---

# 9️⃣ WHY THIS MAXIMIZES SUI CAPABILITIES

✅ DeepBook as core infra (mainnet)
✅ Partial fills for borrow/lend orders
✅ Escrow fill flow (async lender-first fills via shared objects)
✅ Parallel execution
✅ Object-based vaults
✅ No relayers
✅ No centralized actors

This is **not portable** to Ethereum easily.

---

# 🔟 DEPLOYED CONTRACT

**Network:** Sui Testnet

| Key | Value |
|-----|-------|
| Original Package ID | `0x46866743cab6b7174895be4848c598db76101dddef61962223971b853a3f0701` |
| Latest Package ID | `0x40303a5f8f5e84d5769523dad6c5ca8334974112026eb3374572d8e25d8af01b` |
| LendingMarketplace (shared) | `0x0dfb245d338b3568c00e45e313d412685b5159251d5ed1dea6ca708c8f93fc28` |
| UpgradeCap | `0xa0302a33ae12a8aa1a40ba76ff429fc49c4df0b58bd4f0a73f8681a4e96aef2d` |

> **Note on upgrades:** After a Sui package upgrade, struct types on objects always reference the **original** package ID, while function call targets must use the **latest** package ID. The frontend uses `NEXT_PUBLIC_RAIN_PACKAGE_ID` (latest) for transaction calls and `NEXT_PUBLIC_RAIN_ORIGINAL_PACKAGE_ID` (original) for type queries.


