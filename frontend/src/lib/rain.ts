/**
 * Rain protocol config. Set NEXT_PUBLIC_RAIN_PACKAGE_ID after deploying contracts.
 * Uses UserVault (with linked CustodyVault) and risk engine; create_vault and deposit_collateral live in user_vault.
 */
const PACKAGE_ID = process.env.NEXT_PUBLIC_RAIN_PACKAGE_ID ?? "0x0";

export const RAIN = {
  packageId: PACKAGE_ID,
  userVault: {
    module: "user_vault",
    type: `${PACKAGE_ID}::user_vault::UserVault`,
    createVault: `${PACKAGE_ID}::user_vault::create_vault`,
    depositCollateral: `${PACKAGE_ID}::user_vault::deposit_collateral`,
  },
  custody: {
    type: `${PACKAGE_ID}::custody::CustodyVault`,
  },
} as const;

export function isRainConfigured(): boolean {
  return PACKAGE_ID !== "0x0";
}
