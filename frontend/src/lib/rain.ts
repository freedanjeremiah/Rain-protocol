/**
 * Rain protocol config. Set NEXT_PUBLIC_RAIN_PACKAGE_ID and
 * NEXT_PUBLIC_LENDING_MARKETPLACE_ID after deploying contracts.
 */
const PACKAGE_ID = process.env.NEXT_PUBLIC_RAIN_PACKAGE_ID ?? "0x0";
const MARKETPLACE_ID =
  process.env.NEXT_PUBLIC_LENDING_MARKETPLACE_ID ?? "0x0";
const PYTH_SUI_USD_PRICE_OBJECT =
  process.env.NEXT_PUBLIC_PYTH_SUI_USD_PRICE_OBJECT_ID ?? "";
const DEEPBOOK_SUI_USDC_POOL =
  process.env.NEXT_PUBLIC_DEEPBOOK_SUI_USDC_POOL_ID ?? "";
const DEEP_COIN_TYPE =
  process.env.NEXT_PUBLIC_DEEP_COIN_TYPE ??
  "0x36dbef866a1d62bf7328989a10fb2f07d769f4ee587c0de4a0a256e57e0a58a8::deep::DEEP";
const DBUSDC_COIN_TYPE =
  process.env.NEXT_PUBLIC_DBUSDC_COIN_TYPE ??
  "0xf7152c05930480cd740d7311b5b8b45c6f488e3a53a11c3f74a6fac36a52e0d7::DBUSDC::DBUSDC";

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

  pyth: {
    suiUsdPriceObjectId: PYTH_SUI_USD_PRICE_OBJECT,
    /** SUI/USD feed ID (hex, with 0x for SDK) */
    suiUsdFeedId:
      "50c67b3fd225db8912a424dd4baed60ffdde625ed2feaaf283724f9608fea266",
    /** Testnet only: Pyth pull oracle – update price in same tx as fill (no env object ID needed) */
    testnet: {
      hermesUrl: "https://hermes-beta.pyth.network",
      pythStateId:
        "0x243759059f4c3111179da5878c12f68d612c21a8d54d85edc86164bb18be1c7c",
      wormholeStateId:
        "0x31358d198147da50db32eda2562951d53973a0c0ad5ed738e9b17d88b213d790",
    },
  },

  deepbook: {
    suiUsdcPoolId: DEEPBOOK_SUI_USDC_POOL,
    deepCoinType: DEEP_COIN_TYPE,
    dbUsdcCoinType: DBUSDC_COIN_TYPE,
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
