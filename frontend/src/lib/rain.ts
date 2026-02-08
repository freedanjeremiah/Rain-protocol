/**
 * Rain protocol config. Set NEXT_PUBLIC_RAIN_PACKAGE_ID and
 * NEXT_PUBLIC_LENDING_MARKETPLACE_ID after deploying contracts.
 */
const PACKAGE_ID = process.env.NEXT_PUBLIC_RAIN_PACKAGE_ID ?? "0x0";
const MARKETPLACE_ID =
  process.env.NEXT_PUBLIC_LENDING_MARKETPLACE_ID ?? "0x0";

export const RAIN = {
  packageId: PACKAGE_ID,
  marketplaceId: MARKETPLACE_ID,

  userVault: {
    module: "user_vault",
    type: `${PACKAGE_ID}::user_vault::UserVault`,
    createVault: `${PACKAGE_ID}::user_vault::create_vault`,
    depositCollateral: `${PACKAGE_ID}::user_vault::deposit_collateral`,
    requestRepaymentAuth: `${PACKAGE_ID}::user_vault::request_repayment_auth`,
  },

  custody: {
    type: `${PACKAGE_ID}::custody::CustodyVault`,
    releaseToOwner: `${PACKAGE_ID}::custody::release_to_owner`,
  },

  adjudicator: {
    repaymentAuthType: `${PACKAGE_ID}::adjudicator::RepaymentAuth`,
    authorizeLiquidation: `${PACKAGE_ID}::adjudicator::authorize_liquidation`,
  },

  marketplace: {
    type: `${PACKAGE_ID}::marketplace::LendingMarketplace`,
    borrowOrderType: `${PACKAGE_ID}::marketplace::BorrowOrder`,
    lendOrderType: `${PACKAGE_ID}::marketplace::LendOrder`,
    loanPositionType: `${PACKAGE_ID}::marketplace::LoanPosition`,
    createBorrowOrder: `${PACKAGE_ID}::marketplace::create_borrow_order`,
    submitBorrowOrder: `${PACKAGE_ID}::marketplace::submit_borrow_order`,
    createLendOrder: `${PACKAGE_ID}::marketplace::create_lend_order`,
    submitLendOrder: `${PACKAGE_ID}::marketplace::submit_lend_order`,
    fillOrder: `${PACKAGE_ID}::marketplace::fill_order`,
    repayPosition: `${PACKAGE_ID}::marketplace::repay_position`,
  },

  liquidation: {
    liquidate: `${PACKAGE_ID}::liquidation::liquidate`,
    sellCollateralAndSettle: `${PACKAGE_ID}::liquidation::sell_collateral_and_settle`,
  },
} as const;

/** Sui system clock shared object */
export const SUI_CLOCK = "0x6";

export function isRainConfigured(): boolean {
  return PACKAGE_ID !== "0x0";
}

export function isMarketplaceConfigured(): boolean {
  return MARKETPLACE_ID !== "0x0";
}
